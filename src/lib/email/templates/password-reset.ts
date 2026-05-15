/**
 * E-Mail-Template: Passwort zurücksetzen
 *
 * Wird bei Self-Service "Forgot Password" sowie admin-initiiertem Reset versendet.
 */

export interface PasswordResetTemplateData {
  recipientName: string;
  recipientEmail: string;
  resetUrl: string;
  expiresInMinutes?: number;
  initiatedByAdmin?: boolean;
}

export function renderPasswordResetEmail(data: PasswordResetTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const expiresInMinutes = data.expiresInMinutes ?? 60;
  const subject = 'Passwort zurücksetzen – Plexaro';

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
    .cta { text-align: center; margin: 32px 0; }
    .cta a { background: #18181b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; }
    .warning { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 24px; }
    .note { font-size: 13px; color: #6b7280; margin-top: 16px; }
    .footer { padding: 24px 40px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Plexaro</h1>
    </div>
    <div class="body">
      <h2>Passwort zurücksetzen</h2>
      <p>
        Hallo ${escapeHtml(data.recipientName)},
      </p>
      <p>
        ${data.initiatedByAdmin
          ? 'Ein Administrator hat einen Passwort-Reset für deinen Account angefordert.'
          : 'Du (oder jemand anderes) hat einen Passwort-Reset für diesen Account angefordert.'}
        Klicke auf den folgenden Button, um ein neues Passwort zu setzen.
      </p>

      <div class="cta">
        <a href="${data.resetUrl}">Neues Passwort setzen</a>
      </div>

      <div class="warning">
        <strong>Achtung:</strong> Dieser Link ist nur <strong>${expiresInMinutes} Minuten</strong> gültig
        und kann nur einmal verwendet werden.
      </div>

      <p class="note">
        Falls du keinen Passwort-Reset angefordert hast, kannst du diese E-Mail ignorieren.
        Dein Passwort bleibt unverändert.
      </p>
    </div>
    <div class="footer">
      Diese E-Mail wurde automatisch generiert. Bitte nicht antworten.
      &copy; ${new Date().getFullYear()} Plexaro
    </div>
  </div>
</body>
</html>`;

  const text = `Passwort zurücksetzen – Plexaro

Hallo ${data.recipientName},

${data.initiatedByAdmin
  ? 'Ein Administrator hat einen Passwort-Reset für deinen Account angefordert.'
  : 'Du (oder jemand anderes) hat einen Passwort-Reset für diesen Account angefordert.'}

Klicke auf den folgenden Link, um ein neues Passwort zu setzen:
${data.resetUrl}

Dieser Link ist nur ${expiresInMinutes} Minuten gültig und kann nur einmal verwendet werden.

Falls du keinen Passwort-Reset angefordert hast, kannst du diese E-Mail ignorieren.

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
