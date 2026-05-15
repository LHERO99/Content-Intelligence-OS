import { NextResponse } from 'next/server';
import {
  createKeyword,
  getKeywordMap,
  updateKeyword,
  deleteKeyword,
  bulkDeleteKeywords,
  AirtableValidationError,
  createContentLog,
  getAllUsers,
} from '@/lib/postgres';
import { triggerN8nWorkflow } from '@/lib/n8n';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { calculatePriorityScore, resolvePrioritizationWeights } from '@/lib/prioritization-utils';
import { getConfig } from '@/lib/postgres';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;
    const keywords = await getKeywordMap(tenantId);
    return NextResponse.json(keywords);
  } catch (error: any) {
    console.error('[API] Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Keywords', details: error.message },
      { status: 500 }
    );
  }
}

async function enrichWithPriorityScore<T extends Record<string, any>>(keyword: T, tenantId?: string): Promise<T> {
  const config = await getConfig(tenantId);
  const weights = resolvePrioritizationWeights(config);
  const score = calculatePriorityScore(keyword as any, weights);
  return {
    ...keyword,
    Priority_Score: score,
  };
}

function isAssignedEditorParseError(error: any): boolean {
  const message = String(error?.message || '');
  const raw = String(error?.error || '');
  return (
    message.includes('Assigned_Editor') ||
    message.includes('INVALID_VALUE_FOR_COLUMN') ||
    raw.includes('INVALID_VALUE_FOR_COLUMN')
  );
}

async function updateKeywordWithEditorFallback(id: string, updates: Record<string, any>, tenantId?: string) {
  try {
    return await updateKeyword(id, updates, tenantId);
  } catch (error: any) {
    if (!isAssignedEditorParseError(error) || updates.Assigned_Editor === undefined) {
      throw error;
    }

    const rawAssigned = updates.Assigned_Editor;
    const assignedValues = Array.isArray(rawAssigned)
      ? rawAssigned.filter((value) => typeof value === 'string' && value.trim() !== '')
      : typeof rawAssigned === 'string' && rawAssigned.trim() !== ''
        ? [rawAssigned]
        : [];

    if (assignedValues.length === 0) {
      return await updateKeyword(id, { ...updates, Assigned_Editor: undefined }, tenantId);
    }

    const firstValue = String(assignedValues[0]);
    const users = await getAllUsers(tenantId);
    const matchedUser = users.find((user) => user.id === firstValue || user.Email === firstValue);

    const fallbackCandidates: Array<any> = [firstValue];
    if (matchedUser?.Email) fallbackCandidates.push(matchedUser.Email);
    if (matchedUser?.Name) fallbackCandidates.push(matchedUser.Name);

    let lastError: any = error;
    for (const candidate of fallbackCandidates) {
      try {
        return await updateKeyword(id, {
          ...updates,
          Assigned_Editor: candidate ? [candidate] : undefined,
        }, tenantId);
      } catch (candidateError: any) {
        lastError = candidateError;
      }
    }

    throw lastError;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;

    const body = await request.json();
    const { 
      Keyword, 
      Target_URL, 
      Search_Volume, 
      Difficulty, 
      Status, 
      Editorial_Deadline, 
      Assigned_Editor,
      Main_Keyword,
      Article_Count,
      Avg_Product_Value,
      Page_Type
    } = body;

    let result = await createKeyword({
      Keyword,
      Target_URL,
      Search_Volume: Search_Volume ? Number(Search_Volume) : undefined,
      Difficulty: Difficulty ? Number(Difficulty) : undefined,
      Status: Status || 'Backlog',
      Editorial_Deadline,
      Assigned_Editor,
      Main_Keyword: Main_Keyword || 'N',
      Article_Count: Article_Count ? Number(Article_Count) : undefined,
      Avg_Product_Value: Avg_Product_Value ? Number(Avg_Product_Value) : undefined,
      Action_Type: 'Erstellung',
      Page_Type: Page_Type || 'Kategorie',
    }, tenantId);

    if (result) {
      const enriched = await enrichWithPriorityScore(result as any, tenantId);
      const updatedWithScore = await updateKeyword(result.id, { Priority_Score: enriched.Priority_Score }, tenantId);
      if (updatedWithScore) {
        result = updatedWithScore;
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Keywords in Airtable.' },
        { status: 500 }
      );
    }

    // --- Add Logging for Creation ---
    try {
      const editor = session?.user?.id ? [session.user.id] : undefined;
      
      // 1. Base Log: Added to tool
      await createContentLog({
        Keyword_ID: [result.id],
        Target_URL: result.Target_URL,
        Logged_URL: result.Target_URL,
        Action_Type: result.Action_Type || 'Erstellung',
        Page_Type: result.Page_Type || 'Kategorie',
        Event_Label: 'URL wurde dem Tool hinzugefügt',
        Editor: editor
      }, tenantId);

        // 2. Conditional Log: Added to Suggestions Tab (if Status=Backlog and Main_Keyword=Y)
        if (result.Status === 'Backlog' && result.Main_Keyword === 'Y') {
          await createContentLog({
            Keyword_ID: [result.id],
            Target_URL: result.Target_URL,
            Logged_URL: result.Target_URL,
            Action_Type: result.Action_Type || 'Erstellung',
            Page_Type: result.Page_Type || 'Kategorie',
            Event_Label: "URL wurde dem Tab 'Vorschläge' hinzugefügt",
            Editor: editor
          }, tenantId);
        }

        // 3. Trigger n8n Performance Data (History) Webhook in background
        triggerN8nWorkflow({
          action: 'IMPORT_DATA',
          data: {
            keywordId: result.id,
            MainKeyword: result.Keyword,
            targetUrl: result.Target_URL
          },
          userId: session?.user?.email || 'unknown',
          timestamp: new Date().toISOString()
        }).catch(err => {
          console.error('[Background Trigger] Error calling n8n for keyword:', result.id, err);
        });
      } catch (logErr) {
        console.error('[API Keyword POST] Error in post-creation tasks:', logErr);
      }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API] Error creating keyword:', error);
    
    if (error instanceof AirtableValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;

    const body = await request.json();
    let { id, ...updates } = body;

    // Support both flat structure and Airtable-style nested fields
    if (updates.fields) {
      updates = { ...updates, ...updates.fields };
      delete updates.fields;
    }

    if (!id && updates.id) id = updates.id as string;

    if (!id) {
      return NextResponse.json(
        { error: "ID ist erforderlich für Updates." },
        { status: 400 }
      );
    }

    // 1. Fetch current record to check for status transitions
    const currentKeywords = await getKeywordMap(tenantId);
    const currentKeyword = currentKeywords.find(k => k.id === id);

    if (!currentKeyword) {
      console.error(`[API] Keyword not found for ID: ${id}`);
      return NextResponse.json(
        { error: 'Keyword nicht gefunden.' },
        { status: 404 }
      );
    }

    // 2. Convert numeric fields if they exist in updates
    if (updates.Search_Volume !== undefined) updates.Search_Volume = Number(updates.Search_Volume);
    if (updates.Difficulty !== undefined) updates.Difficulty = Number(updates.Difficulty);
    if (updates.Article_Count !== undefined) updates.Article_Count = Number(updates.Article_Count);
    if (updates.Avg_Product_Value !== undefined) updates.Avg_Product_Value = Number(updates.Avg_Product_Value);

    console.log(`[API] Updating keyword ${id} with:`, updates);

    const nextPayload = { ...updates };
    if (
      updates.Search_Volume !== undefined ||
      updates.Difficulty !== undefined ||
      updates.Article_Count !== undefined ||
      updates.Avg_Product_Value !== undefined ||
      updates.Policy !== undefined ||
      updates.Ranking !== undefined ||
      updates.Last_Published !== undefined ||
      updates.Status !== undefined
    ) {
      const mergedForScoring = {
        ...currentKeyword,
        ...nextPayload,
      };
      const enriched = await enrichWithPriorityScore(mergedForScoring as any, tenantId);
      nextPayload.Priority_Score = enriched.Priority_Score;
    }

    const result = await updateKeywordWithEditorFallback(id, nextPayload, tenantId);

    // 3. Status Transition Logging
    if (result && updates.Status && updates.Status !== currentKeyword.Status) {
      try {
        const editor = session?.user?.id ? [session.user.id] : undefined;

        if (updates.Status === 'Planned') {
          await createContentLog({
            Keyword_ID: [id],
            Target_URL: result.Target_URL,
            Action_Type: result.Action_Type,
            Page_Type: result.Page_Type,
            Event_Label: 'URL wurde der Redaktionsplanung hinzugefügt',
            Editor: editor
          }, tenantId);
        } else if (updates.Status === 'Published') {
          await createContentLog({
            Keyword_ID: [id],
            Target_URL: result.Target_URL,
            Action_Type: result.Action_Type,
            Page_Type: result.Page_Type,
            Event_Label: 'Content veröffentlicht',
            Editor: editor
          }, tenantId);
        }
      } catch (logErr) {
        console.error('[API] Error creating transition log:', logErr);
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren des Keywords in Airtable.' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error updating keyword:', error);

    if (error instanceof AirtableValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.user?.tenantId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const idsParam = searchParams.get('ids');
    const softDelete = searchParams.get('soft') === 'true';

    if (idsParam) {
      const ids = idsParam.split(',');
      if (softDelete) {
        // Soft delete: Reset planning fields instead of deleting the record
        try {
          for (const recordId of ids) {
            await updateKeyword(recordId, {
              Status: 'Backlog',
              Editorial_Deadline: undefined,
              Assigned_Editor: undefined,
            }, tenantId);
          }
          return NextResponse.json({ success: true });
        } catch (error: any) {
          console.error('[API] Error bulk soft-deleting keywords:', error);
          return NextResponse.json(
            { error: 'Fehler beim Entfernen der Einträge aus der Planung', details: error.message },
            { status: 500 }
          );
        }
      } else {
        await bulkDeleteKeywords(ids, tenantId);
      }
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID oder IDs sind erforderlich für Deletion.' },
        { status: 400 }
      );
    }

    if (softDelete) {
      // Soft delete: Reset planning fields
      try {
        await updateKeyword(id, {
          Status: 'Backlog',
          Editorial_Deadline: undefined,
          Assigned_Editor: undefined,
        }, tenantId);
        return NextResponse.json({ success: true });
      } catch (error: any) {
        console.error('[API] Error soft-deleting keyword:', error);
        return NextResponse.json(
          { error: 'Fehler beim Entfernen aus der Planung', details: error.message },
          { status: 500 }
        );
      }
    } else {
      await deleteKeyword(id, tenantId);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error deleting keyword:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Keywords', details: error.message },
      { status: 500 }
    );
  }
}
