/**
 * E-Mail-Template: Alert-Benachrichtigung
 *
 * Wird versendet wenn eine Alert-Regel ausgelöst wird.
 */

export type AlertMetric = 'gsc_clicks_drop' | 'keyword_rank_drop';
export type AlertOperator = 'lt' | 'gt' | 'pct_drop';

const METRIC_LABELS: Record<AlertMetric, string> = {
  gsc_clicks_drop: 'GSC-Klicks',
  keyword_rank_drop: 'Keyword-Ranking',
};

const OPERATOR_LABELS: Record<AlertOperator, string> = {
  lt: 'gefallen unter',
  gt: 'gestiegen über',
  pct_drop: 'um mehr als',
};

export interface AlertTemplateData {
  tenantName: string;
  ruleName: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  currentValue: number;
  affectedEntity?: string;   // z.B. URL oder Keyword
  windowDays: number;
  dashboardUrl: string;
}

export function renderAlertEmail(data: AlertTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const metricLabel = METRIC_LABELS[data.metric] ?? data.metric;
  const operatorLabel = OPERATOR_LABELS[data.operator] ?? data.operator;
  const thresholdDisplay = data.operator === 'pct_drop'
    ? `${data.threshold}%`
    : String(data.threshold);
  const currentDisplay = data.operator === 'pct_drop'
    ? `${data.currentValue.toFixed(1)}%`
    : String(data.currentValue);

  const subject = `[Alert] ${data.ruleName} – ${data.tenantName}`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #dc2626; padding: 32px 40px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
    .header p { color: #fecaca; margin: 6px 0 0; font-size: 13px; }
    .body { padding: 40px; color: #374151; line-height: 1.6; }
    .body h2 { margin-top: 0; font-size: 18px; color: #111827; }
    .rule-info { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 20px 24px; margin: 24px 0; }
    .rule-info p { margin: 6px 0; font-size: 14px; }
    .rule-info .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .rule-info .value { font-weight: 600; color: #111827; font-size: 15px; }
    .rule-info .value.alert { color: #dc2626; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a { background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; }
    .footer { padding: 24px 40px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Alert ausgelöst</h1>
      <p>${escapeHtml(data.tenantName)} · Plexaro</p>
    </div>
    <div class="body">
      <h2>${escapeHtml(data.ruleName)}</h2>
      <p>
        Eine Alert-Regel hat angeschlagen. Bitte überprüfe die betroffenen Daten im Dashboard.
      </p>

      <div class="rule-info">
        <p class="label">Metrik</p>
        <p class="value">${escapeHtml(metricLabel)}</p>

        ${data.affectedEntity ? `
        <br />
        <p class="label">Betroffene Entität</p>
        <p class="value">${escapeHtml(data.affectedEntity)}</p>
        ` : ''}

        <br />
        <p class="label">Bedingung</p>
        <p class="value">${escapeHtml(metricLabel)} ${escapeHtml(operatorLabel)} ${escapeHtml(thresholdDisplay)}</p>

        <br />
        <p class="label">Aktueller Wert</p>
        <p class="value alert">${escapeHtml(currentDisplay)}</p>

        <br />
        <p class="label">Beobachtungszeitraum</p>
        <p class="value">${data.windowDays} Tage</p>
      </div>

      <div class="cta">
        <a href="${data.dashboardUrl}">Im Dashboard ansehen</a>
      </div>
    </div>
    <div class="footer">
      Diese E-Mail wurde automatisch generiert. Du kannst die Alert-Regel im Admin-Bereich
      anpassen oder deaktivieren.
      &copy; ${new Date().getFullYear()} Plexaro
    </div>
  </div>
</body>
</html>`;

  const text = `[Alert] ${data.ruleName}
Workspace: ${data.tenantName}

Eine Alert-Regel hat angeschlagen:

  Metrik:    ${metricLabel}
  ${data.affectedEntity ? `Entität:   ${data.affectedEntity}\n  ` : ''}Bedingung: ${metricLabel} ${operatorLabel} ${thresholdDisplay}
  Aktueller Wert: ${currentDisplay}
  Zeitraum:  ${data.windowDays} Tage

Im Dashboard ansehen: ${data.dashboardUrl}

---
Diese E-Mail wurde automatisch generiert.
Alert-Regeln können im Admin-Bereich angepasst werden.`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
