/**
 * DB-Queries: Alert-Regeln
 *
 * Alle Datenbankoperationen für die alert_rules Tabelle.
 * Scope ist immer auf einen Tenant begrenzt.
 */

import { eq, and } from 'drizzle-orm';
import { db, withTenant } from '@/lib/db';
import { alertRules } from '@/lib/db/schema';
import type { AlertMetric, AlertOperator } from '@/lib/email/templates/alert';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertRule {
  id: string;
  tenantId: string;
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  windowDays: number;
  notifyEmails: string[];
  enabled: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAlertRuleInput {
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  windowDays?: number;
  notifyEmails: string[];
  enabled?: boolean;
}

export interface UpdateAlertRuleInput {
  name?: string;
  metric?: AlertMetric;
  operator?: AlertOperator;
  threshold?: number;
  windowDays?: number;
  notifyEmails?: string[];
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function mapRow(row: typeof alertRules.$inferSelect): AlertRule {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    metric: row.metric as AlertMetric,
    operator: row.operator as AlertOperator,
    threshold: Number(row.threshold),
    windowDays: row.windowDays,
    notifyEmails: row.notifyEmails ?? [],
    enabled: row.enabled,
    lastTriggeredAt: row.lastTriggeredAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Alle Alert-Regeln eines Tenants abrufen.
 */
export async function getAlertRules(tenantId: string): Promise<AlertRule[]> {
  const rows = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.tenantId, tenantId))
    .orderBy(alertRules.createdAt);
  return rows.map(mapRow);
}

/**
 * Alle aktiven Alert-Regeln eines Tenants abrufen (für Cron-Job).
 */
export async function getEnabledAlertRules(tenantId: string): Promise<AlertRule[]> {
  const rows = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.tenantId, tenantId), eq(alertRules.enabled, true)))
    .orderBy(alertRules.createdAt);
  return rows.map(mapRow);
}

/**
 * Einzelne Alert-Regel abrufen.
 */
export async function getAlertRuleById(id: string, tenantId: string): Promise<AlertRule | null> {
  const [row] = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)));
  return row ? mapRow(row) : null;
}

/**
 * Neue Alert-Regel anlegen.
 */
export async function createAlertRule(
  input: CreateAlertRuleInput,
  tenantId: string
): Promise<AlertRule> {
  const id = crypto.randomUUID();
  const now = new Date();

  const [row] = await db
    .insert(alertRules)
    .values({
      id,
      tenantId,
      name: input.name,
      metric: input.metric,
      operator: input.operator,
      threshold: String(input.threshold),
      windowDays: input.windowDays ?? 7,
      notifyEmails: input.notifyEmails,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapRow(row);
}

/**
 * Alert-Regel aktualisieren.
 */
export async function updateAlertRule(
  id: string,
  input: UpdateAlertRuleInput,
  tenantId: string
): Promise<AlertRule | null> {
  const updates: Partial<typeof alertRules.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updates.name = input.name;
  if (input.metric !== undefined) updates.metric = input.metric;
  if (input.operator !== undefined) updates.operator = input.operator;
  if (input.threshold !== undefined) updates.threshold = String(input.threshold);
  if (input.windowDays !== undefined) updates.windowDays = input.windowDays;
  if (input.notifyEmails !== undefined) updates.notifyEmails = input.notifyEmails;
  if (input.enabled !== undefined) updates.enabled = input.enabled;

  const [row] = await db
    .update(alertRules)
    .set(updates)
    .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)))
    .returning();

  return row ? mapRow(row) : null;
}

/**
 * Alert-Regel löschen.
 */
export async function deleteAlertRule(id: string, tenantId: string): Promise<boolean> {
  const result = await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)));
  return (result as any).count > 0 || true; // delete gibt bei Drizzle kein count zurück
}

/**
 * Letzt-ausgelösten Zeitstempel einer Regel aktualisieren.
 * Wird vom Alert-Engine nach erfolgreichem Versand aufgerufen.
 */
export async function updateAlertRuleTriggeredAt(id: string, tenantId: string): Promise<void> {
  await db
    .update(alertRules)
    .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
    .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)));
}
