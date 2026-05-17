# Plan: Main Keyword Deletion Warning

## Übersicht

Derzeit wird in der Keyword-Map Tab eine Warnung angezeigt, wenn ein Main Keyword für eine URL zur Blacklist hinzugefügt werden soll. Die gleiche Warnung soll auch erscheinen, wenn ein Main Keyword für eine URL gelöscht werden soll.

## Zusammenfassung der Änderungen

- ✅ Frontend-Validierung in `KeywordFilterBar.tsx` hinzufügen
- ✅ Backend-Validierung in `keywords/route.ts` hinzufügen (empfohlen)
- ✅ Fehlermeldung analog zur Blacklist-Warnung
- ✅ `EditorialFilterBar.tsx` wird NICHT angepasst (soft delete betrifft Main Keywords nicht)

## Aktuelle Situation

### Blacklist-Warnung (bereits implementiert)
- **Datei**: `src/features/planning/components/blacklist-reason-modal.tsx`
- **Zeilen**: 54-59
- **Logik**: Prüft, ob eines der ausgewählten Keywords ein Main Keyword ist (`Main_Keyword === 'Y'`) und zeigt Fehlermeldung an:
  > "Ein Main Keyword kann nicht einzeln blacklisted werden. Bitte blackliste entweder die gesamte URL oder vergib vorher ein neues Main Keyword für diese URL."

### Lösch-Funktion (ohne Warnung)
- **Frontend**: `src/features/planning/components/KeywordFilterBar.tsx` (Zeilen 92-111, 219-244)
- **Backend**: `src/app/api/planning/keywords/route.ts` (Zeilen 331-402)
- **Service**: `src/features/planning/services/planning-service.ts`
- Aktuell wird keine Prüfung durchgeführt, ob ein Main Keyword gelöscht werden soll

## Erforderliche Änderungen

### 1. Frontend: Warnung vor dem Löschen hinzufügen

**Datei**: `src/features/planning/components/KeywordFilterBar.tsx`

**Änderung in der `bulkDelete` Funktion (Zeilen 92-111)**:
- Vor dem API-Aufruf prüfen, ob eines der zu löschenden Keywords ein Main Keyword ist
- Wenn ja, Fehlermeldung anzeigen und Löschvorgang abbrechen
- Die Fehlermeldung sollte identisch zur Blacklist-Warnung sein

**Implementierung**:
```typescript
const bulkDelete = async (ids: string[]) => {
  try {
    setIsBulkDeleting(true);
    
    // Neue Validierung: Prüfe, ob Main Keywords gelöscht werden sollen
    const rowsToDelete = selectedRows.map((r: any) => r.original);
    const hasMainKeyword = rowsToDelete.some((row: any) => row.Main_Keyword === 'Y');
    
    if (hasMainKeyword) {
      addAlert({
        title: tr("Main Keyword kann nicht gelöscht werden", "Cannot delete Main Keyword"),
        message: tr(
          "Ein Main Keyword kann nicht einzeln gelöscht werden. Bitte vergib vorher ein neues Main Keyword für diese URL.",
          "A Main Keyword cannot be deleted individually. Please assign a new Main Keyword for this URL first."
        ),
        type: "error",
      });
      setIsBulkDeleting(false);
      return;
    }
    
    await PlanningService.deleteKeywords(ids, false);
    
    addAlert({
      message: tr(`${ids.length} Keywords wurden erfolgreich gelöscht.`, `${ids.length} keywords were deleted successfully.`),
      type: "success",
    });
    table.resetRowSelection();
  } catch (error: any) {
    addAlert({
      title: tr("Fehler beim Bulk-Löschen", "Error while bulk deleting"),
      message: (error as Error).message,
      type: "error",
    });
  } finally {
    setIsBulkDeleting(false);
  }
};
```

### 2. Backend: Zusätzliche Validierung (optional, empfohlen)

**Datei**: `src/app/api/planning/keywords/route.ts`

**Änderung in der DELETE-Route (vor Zeile 363)**:
- Backend-Validierung hinzufügen als zusätzliche Sicherheitsebene
- Prüfe, ob gelöschte Keywords Main Keywords sind
- Wenn ja, gebe Fehler zurück

**Implementierung** (nach Zeile 342, vor dem Bulk-Delete):
```typescript
if (idsParam) {
  const ids = idsParam.split(',');
  
  // Prüfe, ob Main Keywords betroffen sind (nur bei Hard Delete)
  if (!softDelete) {
    const keywordsToCheck = await Promise.all(
      ids.map(id => getKeyword(id, tenantId))
    );
    
    const hasMainKeyword = keywordsToCheck.some(
      kw => kw && kw.Main_Keyword === 'Y'
    );
    
    if (hasMainKeyword) {
      return NextResponse.json(
        { 
          error: 'Ein Main Keyword kann nicht einzeln gelöscht werden. Bitte vergib vorher ein neues Main Keyword für diese URL.' 
        },
        { status: 400 }
      );
    }
  }
  
  // Rest der bestehenden Logik...
  if (softDelete) {
    // ... bestehender Code
  } else {
    await bulkDeleteKeywords(ids, tenantId);
  }
  return NextResponse.json({ success: true });
}
```

**Hinweis**: Die Funktion `getKeyword(keywordId: string, tenantId?: string)` existiert bereits in `src/lib/postgres.ts` und kann verwendet werden.

### 3. Editorial-Plan Tab prüfen

**Datei**: `src/features/planning/components/EditorialFilterBar.tsx`

Die `EditorialFilterBar` hat ebenfalls eine `bulkDelete` Funktion (Zeilen 90-109), die jedoch mit `soft: true` arbeitet (nur aus Planung entfernen, nicht löschen). 

**Wichtig**: Diese Funktion sollte **NICHT** die Main Keyword Validierung erhalten, da sie nur die Planungsfelder zurücksetzt (`Status: 'Backlog'`, `Editorial_Deadline: undefined`, `Assigned_Editor: undefined`) und das Keyword nicht tatsächlich löscht. Das Main Keyword bleibt in der Keyword-Map bestehen.

## Vorteile des Ansatzes

1. **Konsistenz**: Gleiche Warnung für Blacklist und Löschen
2. **Zweistufige Validierung**: Frontend (UX) + Backend (Sicherheit)
3. **Benutzerfreundlich**: Klare Fehlermeldung mit Anleitung
4. **Datenschutz**: Verhindert versehentliches Löschen wichtiger Main Keywords

## Fehlermeldungen

### Blacklist (bereits implementiert)
- **DE**: "Ein Main Keyword kann nicht einzeln blacklisted werden. Bitte blackliste entweder die gesamte URL oder vergib vorher ein neues Main Keyword für diese URL."
- **EN**: Wird über die `tr()` Funktion benötigt

### Löschen (neu)
- **DE**: "Ein Main Keyword kann nicht einzeln gelöscht werden. Bitte vergib vorher ein neues Main Keyword für diese URL."
- **EN**: "A Main Keyword cannot be deleted individually. Please assign a new Main Keyword for this URL first."

**Hinweis**: Die Lösch-Warnung ist etwas kürzer als die Blacklist-Warnung, da die "gesamte URL blacklisten" Option beim Löschen nicht relevant ist.

## Betroffene Dateien

1. `src/features/planning/components/KeywordFilterBar.tsx` - Hauptänderung
2. `src/app/api/planning/keywords/route.ts` - Backend-Validierung (optional)
3. `src/lib/postgres.ts` - Ggf. neue Hilfsfunktion (falls benötigt)

## Testfälle

Nach der Implementierung sollten folgende Szenarien getestet werden:

1. ✅ Versuch, ein Main Keyword zu löschen → Warnung wird angezeigt
2. ✅ Versuch, mehrere Keywords inkl. Main Keyword zu löschen → Warnung wird angezeigt
3. ✅ Löschen von Nicht-Main Keywords → Funktioniert normal
4. ✅ Blacklist eines Main Keywords → Bestehende Warnung funktioniert weiterhin
5. ✅ Backend-Validierung greift, falls Frontend umgangen wird

## Implementierungsreihenfolge

1. **Frontend-Validierung in KeywordFilterBar.tsx** (Priorität: Hoch)
   - Benutzer bekommt sofortige Rückmeldung
   - Verhindert unnötige API-Aufrufe
   
2. **Backend-Validierung in route.ts** (Priorität: Mittel)
   - Zusätzliche Sicherheitsebene
   - Schützt vor API-Manipulation

3. **Tests** (Priorität: Hoch)
   - Manuelle Tests der verschiedenen Szenarien
   - Sicherstellen, dass EditorialFilterBar nicht betroffen ist

## Offene Fragen

1. ✅ **Gelöst**: Gibt es einzelne Keyword-Löschungen? → Nein, nur Bulk-Delete über `KeywordFilterBar`
2. ✅ **Gelöst**: Gibt es eine `getKeyword` Funktion? → Ja, in `src/lib/postgres.ts`
3. **Offen**: Soll die Backend-Validierung implementiert werden oder reicht die Frontend-Prüfung?
   - **Empfehlung**: Ja, aus Sicherheitsgründen beide Ebenen implementieren
