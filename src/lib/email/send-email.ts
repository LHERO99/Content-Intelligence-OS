/**
 * E-Mail-Versand
 *
 * Zentrale Funktion zum Versenden von E-Mails via SMTP.
 * Schreibt Ergebnis in audit_logs (sofern tenantId angegeben).
 */

import { createTransporter, getFromAddress, isSmtpConfigured } from './smtp-client';
import { createAuditLog } from '@/lib/postgres';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sendet eine E-Mail via konfiguriertem SMTP-Transporter.
 *
 * @param payload  - Empfänger, Betreff, HTML- und optionaler Plaintext-Body
 * @param tenantId - Optionale Tenant-ID für Audit-Logging
 * @returns        - Ergebnis mit success-Flag und ggf. messageId oder Fehlertext
 */
export async function sendEmail(
  payload: EmailPayload,
  tenantId?: string
): Promise<SendEmailResult> {
  if (!isSmtpConfigured()) {
    const error = 'SMTP nicht konfiguriert – E-Mail wurde nicht gesendet.';
    console.warn('[Email]', error);
    if (tenantId) {
      await createAuditLog('email:send:skipped', { reason: error, to: payload.to }, tenantId).catch(() => {});
    }
    return { success: false, error };
  }

  try {
    const transporter = createTransporter();
    const from = getFromAddress();

    const info = await transporter.sendMail({
      from,
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    console.log(`[Email] Gesendet: ${info.messageId} → ${payload.to}`);

    if (tenantId) {
      await createAuditLog(
        'email:send:ok',
        { messageId: info.messageId, to: payload.to, subject: payload.subject },
        tenantId
      ).catch(() => {});
    }

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    const error = err.message ?? 'Unbekannter SMTP-Fehler';
    console.error('[Email] Fehler beim Senden:', error);

    if (tenantId) {
      await createAuditLog(
        'email:send:error',
        { error, to: payload.to, subject: payload.subject },
        tenantId
      ).catch(() => {});
    }

    return { success: false, error };
  }
}
