/**
 * SMTP Client
 *
 * Erstellt und verwaltet den Nodemailer-Transporter.
 * Konfiguration via Umgebungsvariablen:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user ?? 'noreply@example.com';
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const secure = port === 465;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Please set SMTP_HOST, SMTP_USER and SMTP_PASS environment variables.'
    );
  }

  return { host, port, secure, user, pass, from };
}

/**
 * Erstellt einen Nodemailer-Transporter mit den aktuellen Umgebungsvariablen.
 * Wird bei jedem Aufruf neu erzeugt, damit Config-Änderungen sofort wirken.
 */
export function createTransporter() {
  const config = getSmtpConfig();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

/**
 * Gibt die konfigurierte Absender-Adresse zurück.
 */
export function getFromAddress(): string {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@example.com';
  return from;
}

/**
 * Testet die SMTP-Verbindung.
 * Wirft einen Fehler wenn die Verbindung nicht hergestellt werden kann.
 */
export async function testSmtpConnection(): Promise<void> {
  const transporter = createTransporter();
  await transporter.verify();
}

/**
 * Gibt zurück ob SMTP konfiguriert ist (alle Pflichtfelder gesetzt).
 */
export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}
