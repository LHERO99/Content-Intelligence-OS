/**
 * SuperAdmin Notifications
 *
 * Versendet einen Digest-Alert an alle SuperAdmin-E-Mails wenn Cron-Fehler
 * aufgetreten sind. Enthält einen 24h-Cooldown basierend auf audit_logs.
 *
 * Empfänger werden via SUPERADMIN_ALERT_EMAILS (kommagetrennt) konfiguriert.
 * Schreibt den Versand-Status in audit_logs (tenantId = 'system').
 */

import 'server-only';
import { sendEmail } from '@/lib/email/send-email';
import { renderSuperAdminDigestEmail, type CronErrorEntry } from '@/lib/email/templates/superadmin-alert';
import { db } from '@/lib/db/index';
import { auditLogs as auditLogsTable } from '@/lib/db/schema';
import { eq, desc, gte } from 'drizzle-orm';

const SYSTEM_TENANT = 'system';
const COOLDOWN_HOURS = 24;
const DIGEST_ACTION = 'superadmin:cron-digest:sent';

// ---------------------------------------------------------------------------
// Cooldown check
// ---------------------------------------------------------------------------

async function wasDigestSentRecently(): Promise<boolean> {
  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

  try {
    const rows = await db
      .select({ id: auditLogsTable.id })
      .from(auditLogsTable)
      .where(
        // Use raw SQL-safe approach: filter by action and recent timestamp
        // We can't use withTenant here (system tenant may not have RLS row)
        // so we query directly (no RLS needed for system logs)
        eq(auditLogsTable.action, DIGEST_ACTION)
      )
      .orderBy(desc(auditLogsTable.timestamp))
      .limit(1);

    if (rows.length === 0) return false;

    // Check timestamp manually since we can't add gte filter without withTenant
    const latest = await db
      .select({ timestamp: auditLogsTable.timestamp })
      .from(auditLogsTable)
      .where(eq(auditLogsTable.action, DIGEST_ACTION))
      .orderBy(desc(auditLogsTable.timestamp))
      .limit(1);

    if (latest.length === 0) return false;
    return latest[0].timestamp >= cutoff;
  } catch {
    return false; // on error, allow sending
  }
}

async function writeSentLog(errorCount: number): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      tenantId: SYSTEM_TENANT,
      action: DIGEST_ACTION,
      rawPayload: { errorCount },
    });
  } catch (err) {
    console.error('[SuperAdmin] Failed to write digest audit log:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Versendet einen Digest-Alert an alle SuperAdmin-Empfänger.
 * Wird von Cron-Jobs aufgerufen nachdem alle Tenants verarbeitet wurden.
 *
 * @param errors - Gesammelte Fehler aus dem Cron-Lauf
 * @returns true wenn eine Mail versendet wurde
 */
export async function notifySuperAdminDigest(errors: CronErrorEntry[]): Promise<boolean> {
  if (errors.length === 0) return false;

  const recipients = (process.env.SUPERADMIN_ALERT_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.warn('[SuperAdmin] SUPERADMIN_ALERT_EMAILS not configured – skipping digest');
    return false;
  }

  const inCooldown = await wasDigestSentRecently();
  if (inCooldown) {
    console.log('[SuperAdmin] Digest cooldown active – skipping');
    return false;
  }

  const appUrl = process.env.NEXTAUTH_URL ?? 'https://content-intelligence-os-sigma.vercel.app';
  const runAt = new Date().toISOString();

  const { subject, html, text } = renderSuperAdminDigestEmail({ errors, runAt, appUrl });

  const result = await sendEmail(
    { to: recipients, subject, html, text },
    SYSTEM_TENANT
  );

  if (result.success) {
    await writeSentLog(errors.length);
    console.log(`[SuperAdmin] Digest sent to ${recipients.join(', ')} (${errors.length} errors)`);
  } else {
    console.error('[SuperAdmin] Digest send failed:', result.error);
  }

  return result.success;
}
