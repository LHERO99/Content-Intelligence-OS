/**
 * Alert Notifications
 *
 * Orchestriert die Alert-Auswertung für einen Tenant:
 * 1. Aktive Regeln laden
 * 2. Jede Regel auswerten (via alert-rules-engine)
 * 3. Bei Auslösung: E-Mail versenden
 * 4. lastTriggeredAt aktualisieren (Cooldown-Schutz)
 * 5. Ergebnis in audit_logs schreiben
 */

import { getEnabledAlertRules, updateAlertRuleTriggeredAt } from '@/lib/db/queries/alert-rules';
import { evaluateRule, isInCooldown } from '@/lib/alerts/alert-rules-engine';
import { sendEmail } from '@/lib/email/send-email';
import { renderAlertEmail } from '@/lib/email/templates/alert';
import { createAuditLog } from '@/lib/postgres';
import type { AlertMetric, AlertOperator } from '@/lib/email/templates/alert';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AlertRunResult {
  ruleId: string;
  ruleName: string;
  status: 'triggered' | 'ok' | 'cooldown' | 'error';
  detail?: string;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Wertet alle aktiven Alert-Regeln eines Tenants aus und versendet bei
 * Auslösung eine E-Mail an die konfigurierten Empfänger.
 *
 * @param tenantId   - Tenant-ID
 * @param tenantName - Anzeigename des Tenants (für E-Mail-Templates)
 * @returns          - Array mit Ergebnissen pro Regel
 */
export async function evaluateAndNotify(
  tenantId: string,
  tenantName: string
): Promise<AlertRunResult[]> {
  const rules = await getEnabledAlertRules(tenantId);
  const results: AlertRunResult[] = [];

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://content-intelligence-os-sigma.vercel.app';
  const dashboardUrl = `${baseUrl}/monitoring`;

  for (const rule of rules) {
    // Cooldown-Check: nicht öfter als 1x/24h auslösen
    if (isInCooldown(rule)) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'cooldown',
        detail: `Letzter Alert: ${rule.lastTriggeredAt?.toISOString()}`,
      });
      continue;
    }

    try {
      const evalResult = await evaluateRule(rule, tenantId);

      if (!evalResult.triggered) {
        results.push({ ruleId: rule.id, ruleName: rule.name, status: 'ok' });
        continue;
      }

      // E-Mail versenden
      const { subject, html, text } = renderAlertEmail({
        tenantName,
        ruleName: rule.name,
        metric: rule.metric as AlertMetric,
        operator: rule.operator as AlertOperator,
        threshold: rule.threshold,
        currentValue: evalResult.currentValue,
        affectedEntity: evalResult.affectedEntity,
        windowDays: rule.windowDays,
        dashboardUrl,
      });

      const emailResult = await sendEmail(
        { to: rule.notifyEmails, subject, html, text },
        tenantId
      );

      // lastTriggeredAt aktualisieren (Cooldown)
      await updateAlertRuleTriggeredAt(rule.id, tenantId);

      // Audit-Log
      await createAuditLog(
        emailResult.success ? 'alert:triggered:email:ok' : 'alert:triggered:email:error',
        {
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          currentValue: evalResult.currentValue,
          threshold: rule.threshold,
          affectedEntity: evalResult.affectedEntity,
          emailError: emailResult.error,
        },
        tenantId
      );

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'triggered',
        detail: emailResult.success
          ? `E-Mail gesendet an: ${rule.notifyEmails.join(', ')}`
          : `Auslösung erkannt, E-Mail-Versand fehlgeschlagen: ${emailResult.error}`,
      });
    } catch (err: any) {
      const errMsg = err.message ?? 'Unbekannter Fehler';
      console.error(`[Alerts] Fehler bei Regel "${rule.name}" (${rule.id}):`, errMsg);

      await createAuditLog(
        'alert:eval:error',
        { ruleId: rule.id, ruleName: rule.name, error: errMsg },
        tenantId
      ).catch(() => {});

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'error',
        detail: errMsg,
      });
    }
  }

  return results;
}
