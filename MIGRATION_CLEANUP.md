# Datenbank-Cleanup nach URL-Centric Migration

## Problem
Die `tenant_id` wurde in mehreren Funktionen nicht korrekt weitergegeben, was zu SQL-Fehlern beim Import und Speichern von Daten führte.

## Behobene Fehler

### 1. Keyword-Import Fehler
**Ursache:** `tenant_id` wurde nicht an Performance-Sync-Funktionen weitergegeben

**Behoben in:**
- `src/lib/sync-performance.ts`:
  - `syncGscForUrls()` - akzeptiert jetzt `tenantId` Parameter
  - `syncSistrixForUrls()` - akzeptiert jetzt `tenantId` Parameter  
  - `syncDataForSeoForKeywords()` - akzeptiert jetzt `tenantId` Parameter
  - Alle Aufrufstellen aktualisiert

### 2. Admin Panel Config Speichern Fehler
**Ursache:** `getUserByEmail()` gab `TenantId` nicht zurück, was zu leerem `tenantId` in der Session führte

**Behoben in:**
- `src/lib/postgres.ts` Zeile 1240-1249: `getUserByEmail()` gibt jetzt `TenantId` zurück

### 3. Bug in `getExistingRankingDates()`
**Ursache:** Funktion gab `keywordId|date` zurück, aber Prüfung erwartete nur `keywordId`

**Behoben in:**
- `src/lib/postgres.ts` Zeile 1107: Gibt jetzt nur `keywordId` zurück

## Datenbank-Cleanup

### Alte Tabellen entfernen

Nach erfolgreicher Migration zu URL-Centric Architecture können folgende alte Tabellen entfernt werden:

**Zu entfernen:**
- `keyword_map` → migriert zu `urls` + `url_keywords`
- `keyword_map_editors` → migriert zu `url_keyword_editors`
- `content_log` → migriert zu `execution_cycles` + `process_events`
- `content_log_body` → migriert zu `execution_versions`
- `keyword_ranking_history` → migriert zu `keyword_rankings`
- `blacklist` → migriert zu `blacklisted_keywords` + `blacklisted_urls`

**Migration ausführen:**

```bash
# Option 1: Mit Drizzle (empfohlen)
npm run db:migrate

# Option 2: Manuell mit psql
psql $DATABASE_URL -f src/lib/db/migrations/0008_cleanup_old_tables.sql
```

**WICHTIG:** Führen Sie die Cleanup-Migration erst aus, nachdem Sie verifiziert haben, dass:
1. Migration 0007 erfolgreich gelaufen ist
2. Alle Daten korrekt migriert wurden
3. Die Anwendung mit dem neuen Schema funktioniert

### Alte Code-Dateien entfernen

Folgende Dateien werden nicht mehr verwendet und können entfernt werden:

```bash
# Airtable-bezogene Dateien (nicht mehr verwendet)
rm src/lib/airtable.ts
rm src/lib/airtable-types.ts
rm src/infrastructure/agent-workflow-v2/airtable-repositories.ts
rm scripts/migrate-from-airtable.ts
rm docs/migration-airtable-to-postgresql-agent-workflows.md
```

## Nächste Schritte

1. **Testen Sie die Fixes:**
   - Starten Sie die Anwendung neu
   - Versuchen Sie, Keywords zu importieren
   - Versuchen Sie, Config im Admin Panel zu speichern
   - Beide sollten jetzt ohne Fehler funktionieren

2. **Verifizieren Sie die Migration:**
   ```sql
   -- Prüfen Sie, dass die neuen Tabellen Daten enthalten
   SELECT COUNT(*) FROM urls;
   SELECT COUNT(*) FROM url_keywords;
   SELECT COUNT(*) FROM execution_cycles;
   ```

3. **Backup erstellen:**
   ```bash
   pg_dump $DATABASE_URL > backup_before_cleanup.sql
   ```

4. **Cleanup-Migration ausführen:**
   ```bash
   npm run db:migrate
   ```

5. **Alte Code-Dateien entfernen** (optional, wenn Sie sicher sind)

## Rollback

Falls etwas schief geht, können Sie die alten Tabellen wiederherstellen:

```sql
-- Wiederherstellen aus Backup
psql $DATABASE_URL < backup_before_cleanup.sql
```
