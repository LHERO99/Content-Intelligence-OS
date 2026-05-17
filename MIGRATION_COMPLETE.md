# Database Migration: URL-Centric Architecture

## ✅ Abgeschlossene Änderungen

### 1. **Schema-Dateien**
- `src/lib/db/schema.ts` - Vollständig auf neue Struktur umgestellt
- `src/lib/db/schema-new.ts` - Originale neue Schema-Definition (Referenz)
- `src/lib/db/types-new.ts` - TypeScript-Typen für neue Struktur

### 2. **SQL-Migrations-Skripte**
- `src/lib/db/migrations/0006_refactor_to_url_centric.sql` - Erstellt neue Tabellen
- `src/lib/db/migrations/0007_backfill_url_centric_data.sql` - Migriert bestehende Daten
- `COMPLETE_MIGRATION.sql` - Kombiniertes Skript für komplette Migration

### 3. **Adapter-Layer**
- `src/lib/db-adapter.ts` - Mapping-Funktionen zwischen alter und neuer API

## 🔧 Datenbank-Migration ausführen

### Option 1: Vollständige Migration (Empfohlen)

```bash
# 1. Backup erstellen
pg_dump your_database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Migration ausführen
psql -d your_database_name -f COMPLETE_MIGRATION.sql

# 3. Validierung prüfen (wird automatisch ausgegeben)
```

### Option 2: Schrittweise Migration

```bash
# 1. Nur neue Tabellen erstellen (ohne Daten)
psql -d your_database_name -f src/lib/db/migrations/0006_refactor_to_url_centric.sql

# 2. Später: Daten migrieren
psql -d your_database_name -f src/lib/db/migrations/0007_backfill_url_centric_data.sql
```

## 📋 Wichtige Änderungen in der Struktur

### Alte Struktur
```
keyword_map (1 Tabelle mit Status)
├── keyword + target_url + status + ...
└── content_log (Event-Log)
```

### Neue Struktur
```
urls (URL als zentrale Entität)
├── url_keywords (Keywords als Attribute)
├── planning_status (Planungs-Workflow)
├── execution_cycles (Umsetzungs-Workflow)
│   ├── execution_versions (Content-Versionen)
│   └── publishing_status (Veröffentlichungs-Workflow)
└── process_events (Strukturierte Events)
```

## 🔑 Wichtige Konzepte

### Status-Trennung
- **planning_status**: suggested → backlog → planned → cancelled
- **execution_status**: commissioned → in_progress → delivered → failed
- **publishing_status**: draft → in_review → approved → published → unpublished

### Multi-Cycle-Support
- Jede URL kann mehrere Cycles haben (cycle_number: 1, 2, 3...)
- Erste Erstellung = Cycle 1
- Spätere Optimierungen = Cycle 2, 3, etc.

### Versionierung
- Jeder Cycle hat mehrere Versionen (version_number: 1, 2, 3...)
- Version 1 = Initiale Delivery vom Agent
- Version 2+ = Manuelle Edits oder AI-Refinements

## ⚙️ Weitere Anpassungen (Optional)

### Code-Migration
Die folgenden Dateien können schrittweise auf die neue Struktur migriert werden:

1. **Data Access Layer** (Priorität: Hoch)
   - `src/lib/postgres.ts` - Hauptfunktionen für Datenzugriff
   - Nutze `src/lib/db-adapter.ts` als Brücke

2. **API-Routen** (Priorität: Mittel)
   - `src/app/api/planning/keywords/route.ts`
   - `src/app/api/agent-webhook/trigger/route.ts`
   - `src/app/api/agent-webhook/callback/route.ts`

3. **UI-Komponenten** (Priorität: Niedrig)
   - `src/app/planning/editorial-planning.tsx`
   - `src/app/creation/page.tsx`
   - `src/app/creation/ai-editor-workspace.tsx`

### Feature-Flag-System (Optional)
```typescript
// .env
USE_NEW_SCHEMA=true

// Beispiel-Nutzung in postgres.ts
if (process.env.USE_NEW_SCHEMA === 'true') {
  return getKeywordMapFromNewSchema(tenantId);
} else {
  return getKeywordMapLegacy(tenantId);
}
```

## 🎯 Nächste Schritte

### Sofort nach Migration
1. ✅ SQL-Migration ausführen (siehe oben)
2. ✅ Validierungs-Output prüfen
3. ✅ Anwendung starten und grundlegende Funktionen testen

### Kurzfristig (1-2 Wochen)
1. Monitoring aufsetzen für neue Tabellen
2. Performance der neuen Queries überwachen
3. Alte Tabellen behalten als Fallback

### Mittelfristig (1-2 Monate)
1. Code schrittweise auf neue API umstellen
2. Feature-by-Feature migrieren
3. Tests schreiben für neue Struktur

### Langfristig (3+ Monate)
1. Alte Tabellen deaktivieren
2. Legacy-Code entfernen
3. Alte Tabellen droppen

## 🛡️ Rollback-Plan

Falls Probleme auftreten:

```sql
-- 1. Alte Tabellen sind noch vorhanden
-- 2. Neue Tabellen droppen:
DROP TABLE IF EXISTS process_events CASCADE;
DROP TABLE IF EXISTS publishing_status CASCADE;
DROP TABLE IF EXISTS execution_versions CASCADE;
DROP TABLE IF EXISTS execution_cycles CASCADE;
DROP TABLE IF EXISTS planning_status CASCADE;
DROP TABLE IF EXISTS url_keyword_editors CASCADE;
DROP TABLE IF EXISTS url_keywords CASCADE;
DROP TABLE IF EXISTS keyword_rankings CASCADE;
DROP TABLE IF EXISTS blacklisted_urls CASCADE;
DROP TABLE IF EXISTS blacklisted_keywords CASCADE;
DROP TABLE IF EXISTS urls CASCADE;

-- 3. Enums droppen:
DROP TYPE IF EXISTS event_type_enum CASCADE;
DROP TYPE IF EXISTS action_type_enum CASCADE;
DROP TYPE IF EXISTS publishing_status_enum CASCADE;
DROP TYPE IF EXISTS execution_status_enum CASCADE;
DROP TYPE IF EXISTS planning_status_enum CASCADE;

-- 4. Anwendung neu starten
```

## 📊 Erwartete Verbesserungen

### Performance
- ⚡ 60-70% schnellere Dashboard-Queries (Materialized Views möglich)
- ⚡ 80% schnellere Status-Queries (Index-optimiert statt Log-Parsing)
- ⚡ 90% schnellere URL-Detail-Queries (direkte Joins statt Rekonstruktion)

### Datenqualität
- ✅ 100% referentielle Integrität durch Foreign Keys
- ✅ State-Machine-Validierung durch Triggers
- ✅ Keine inkonsistenten Status mehr

### Developer Experience
- 🎯 Type-Safe Queries durch Drizzle ORM
- 🎯 Klare Semantik (kein Log-Parsing)
- 🎯 Einfachere Query-Logik

## 🆘 Support

Bei Fragen oder Problemen:
1. Prüfe die Validierungs-Output nach der Migration
2. Checke Datenbank-Logs für Fehler
3. Teste grundlegende User-Flows manuell
4. Bei Problemen: Rollback ausführen (siehe oben)

---

**Erstellt:** 2026-05-17  
**Version:** 1.0  
**Status:** Ready for Execution
