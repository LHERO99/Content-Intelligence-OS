/**
 * E-Mail-Template: Einladung
 *
 * Wird beim Anlegen eines neuen Nutzers versendet.
 * Enthält temporäres Passwort und direkten Login-Link.
 */

export interface InvitationTemplateData {
  recipientName: string;
  recipientEmail: string;
  tenantName: string;
  tempPassword: string;
  loginUrl: string;
  invitedByName?: string;
}

export function renderInvitationEmail(data: InvitationTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Einladung zu ${data.tenantName} – Plexaro`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #18181b; padding: 32px 40px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 40px; color: #374151; line-height: 1.6; }
    .body h2 { margin-top: 0; font-size: 18px; color: #111827; }
    .credentials { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px 24px; margin: 24px 0; }
    .credentials p { margin: 6px 0; font-size: 14px; }
    .credentials .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .credentials .value { font-weight: 600; color: #111827; font-size: 15px; font-family: monospace; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a { background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; }
    .warning { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 24px; }
    .footer { padding: 24px 40px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Plexaro</h1>
    </div>
    <div class="body">
      <h2>Willkommen, ${escapeHtml(data.recipientName)}!</h2>
      <p>
        ${data.invitedByName ? `<strong>${escapeHtml(data.invitedByName)}</strong> hat dich` : 'Du wurdest'}
        zum <strong>${escapeHtml(data.tenantName)}</strong> Workspace in Plexaro eingeladen.
        Mit den untenstehenden Zugangsdaten kannst du dich direkt anmelden.
      </p>

      <div class="credentials">
        <p class="label">E-Mail-Adresse</p>
        <p class="value">${escapeHtml(data.recipientEmail)}</p>
        <br />
        <p class="label">Temporäres Passwort</p>
        <p class="value">${escapeHtml(data.tempPassword)}</p>
      </div>

      <div class="cta">
        <a href="${data.loginUrl}">Jetzt anmelden</a>
      </div>

      <div class="warning">
        <strong>Wichtig:</strong> Bitte ändere dein Passwort nach der ersten Anmeldung.
        Du wirst direkt dazu aufgefordert.
      </div>
    </div>
    <div class="footer">
      Diese E-Mail wurde automatisch generiert. Bitte nicht antworten.
      &copy; ${new Date().getFullYear()} Plexaro
    </div>
  </div>
</body>
</html>`;

  const text = `Willkommen bei ${data.tenantName}!

${data.invitedByName ? `${data.invitedByName} hat dich` : 'Du wurdest'} zum ${data.tenantName} Workspace in Plexaro eingeladen.

Deine Zugangsdaten:
  E-Mail:              ${data.recipientEmail}
  Temporäres Passwort: ${data.tempPassword}

Jetzt anmelden: ${data.loginUrl}

Bitte ändere dein Passwort nach der ersten Anmeldung.

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
