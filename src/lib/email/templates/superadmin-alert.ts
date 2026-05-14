/**
 * E-Mail-Template: SuperAdmin-Digest-Alert
 *
 * Wird als Digest nach einem Cron-Lauf versendet, wenn Fehler aufgetreten sind.
 */

export interface CronErrorEntry {
  tenantId: string;
  tenantName?: string;
  cronJob: string;
  error: string;
}

export interface SuperAdminDigestTemplateData {
  errors: CronErrorEntry[];
  runAt: string;  // ISO timestamp
  appUrl: string;
}

export function renderSuperAdminDigestEmail(data: SuperAdminDigestTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const errorCount = data.errors.length;
  const subject = `[SuperAdmin Alert] ${errorCount} Cron-Fehler – ${new Date(data.runAt).toLocaleDateString('de-DE')}`;

  const rowsHtml = data.errors.map(e => `
    <tr>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; font-size:13px; color:#374151;">${escapeHtml(e.cronJob)}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; font-size:13px; color:#374151;">${escapeHtml(e.tenantName ?? e.tenantId)}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; font-size:13px; color:#dc2626; word-break:break-word;">${escapeHtml(e.error)}</td>
    </tr>`).join('');

  const rowsText = data.errors.map(e =>
    `  [${e.cronJob}] Tenant: ${e.tenantName ?? e.tenantId}\n  Fehler: ${e.error}`
  ).join('\n\n');

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .wrapper { max-width: 680px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #7c3aed; padding: 32px 40px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
    .header p { color: #ddd6fe; margin: 6px 0 0; font-size: 13px; }
    .body { padding: 40px; color: #374151; line-height: 1.6; }
    .body h2 { margin-top: 0; font-size: 18px; color: #111827; }
    .summary { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 16px 20px; margin: 24px 0; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    thead th { background: #f3f4f6; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; text-align: left; border-bottom: 2px solid #e5e7eb; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a { background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; }
    .footer { padding: 24px 40px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Cron-Fehler Digest</h1>
      <p>SuperAdmin Benachrichtigung · ${escapeHtml(new Date(data.runAt).toLocaleString('de-DE'))}</p>
    </div>
    <div class="body">
      <h2>${errorCount} Fehler im letzten Cron-Lauf</h2>
      <div class="summary">
        <strong>${errorCount} Fehler</strong> wurden während des Cron-Laufs festgestellt.
        Bitte überprüfe die betroffenen Tenants und Cron-Jobs im Health-Dashboard.
      </div>

      <table>
        <thead>
          <tr>
            <th>Cron-Job</th>
            <th>Tenant</th>
            <th>Fehlermeldung</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="cta">
        <a href="${data.appUrl}/super-admin/health">Health-Dashboard öffnen</a>
      </div>
    </div>
    <div class="footer">
      Diese E-Mail wurde automatisch generiert und an alle SuperAdmin-Adressen gesendet.
      &copy; ${new Date().getFullYear()} Plexaro
    </div>
  </div>
</body>
</html>`;

  const text = `[SuperAdmin Alert] Cron-Fehler Digest
Zeitpunkt: ${new Date(data.runAt).toLocaleString('de-DE')}
Fehler gesamt: ${errorCount}

${rowsText}

Health-Dashboard: ${data.appUrl}/super-admin/health

---
Diese E-Mail wurde automatisch generiert.`;

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
