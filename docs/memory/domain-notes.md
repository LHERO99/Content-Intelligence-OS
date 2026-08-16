# Domain-Notizen

> Themenbasiertes Nachschlagewerk für Architektur-/Domänenwissen, das nicht aus dem Code allein ersichtlich ist. **Kein chronologisches Log** — für Feature-Historie und abgeschlossene Bugfixes ist `git log` die Quelle der Wahrheit, nicht diese Datei. Projektweite Regeln stehen in [AGENTS.md](../../AGENTS.md), hier steht nur, was zu spezifisch/selten gebraucht wird, um dort auto-geladen zu werden.

## URL-zentrische Architektur

- URLs sind die zentrale Entität, Keywords sind Attribute (`urls` + `url_keywords`, ersetzt das alte `keyword_map`).
- Drei unabhängige State-Machines pro URL, jede mit eigener Tabelle:
  - **Planning** (`planning_status`): suggested → backlog → planned → published → cancelled
  - **Execution** (`execution_cycles`): commissioned → in_progress → delivered → failed → cancelled, mit `cycle_number` für native Multi-Cycle-Unterstützung (Cycle 1 = Erstellung, Cycle 2+ = Re-Optimierungen)
  - **Publishing** (`publishing_status`): draft → in_review → approved → published → unpublished
- `execution_versions` ist Append-Only pro Cycle (`UNIQUE(cycle_id, version_number)`): Version 1 = Agent-Delivery, Version 2+ = manuelle Edits/KI-Refinements (siehe auch AGENTS.md-Landmine zu Append-Only-Versionierung).
- `process_events` ist das Event-Log mit typisierten Enums statt Freitext-Labels; polymorphe FK zu allen Entitäten, JSONB für Event-spezifische Daten.
- `Commission_Log_Id` (= `process_events.id` des `cycle_commissioned`-Events) und `Cycle_Id` (= `execution_cycles.id`) sind unterschiedliche IDs für unterschiedliche Zwecke (DB-Integrität vs. Frontend-Mapping Beauftragung↔Delivery). Fehlt `commissionLogId` im externen Callback, wird es automatisch über das jüngste `cycle_commissioned`-Event des Cycles aufgelöst.
- `content_log.page_type` ist bewusste Denormalisierung (Snapshot des Seitentyps zum Log-Zeitpunkt), wird in `monitoring/detail` für Kostenberechnung genutzt und bleibt auch erhalten, wenn die zugehörige Keyword-Row gelöscht wird (`onDelete: set null`).

## Agent-Workflow V2 (Node-Builder)

- Serielles Parent-Orchestrierungsmodell: Parent-Node → ein Subagent → Ergebnis zurück an Parent (kein paralleles Multi-Agent-Fan-out).
- Parent-Decision-Contract-Felder: `finalize`, `summary`, `finalHtml`, `next.targetNodeId`, `objective`, `memoryPatch`.
- Runs werden **ausschließlich extern getriggert** (über den Commissioning-Flow) — bewusst **keine** manuellen Run-Controls im Builder-UI.
- Execution Panel sitzt als Side-Panel in der linken Sidebar unterhalb der Node-Palette.

## Ranking- & Performance-Daten

- Keywords ohne Top-100-Ranking erhalten den Sonderwert `Ranking: 101` (statt `null`); UI zeigt dafür `>100`. Betrifft `sync-performance.ts` und alle Ranking-Charts/-Achsen.
- Aktive Tabellen: `keyword_rankings` (ersetzt das alte `keyword_ranking_history`) und `url_performance`.

## Audit-Log-Namenskonvention (System Health)

- Cron-Jobs: `cron:sync-<provider>:success|error|skipped`
- Integrations-Checks: `integration:check:<provider>:ok|error|skipped`
- Connectivity-Check und Datensync-Status nie in einem Job-Eintrag zusammenfassen: ein leerer Datensync (0 URLs verarbeitet, keine API-Calls) ist `:skipped`, kein `:success` — sonst überschreibt ein leerer Sync-Lauf einen echten `:error` aus dem vorherigen Integrations-Check.

## i18n

- `useI18n()` gibt `{ locale, setLocale, t }` zurück; Strings über `t("dashboard.systemHealth.title")` (Dictionary-Pattern in `de.ts`/`en.ts`).
- Locale-Persistenz über `localStorage`, Default `"de"`.

## Base UI Eigenheiten (`@base-ui/react`)

- Kein `asChild` — stattdessen `render`-Prop oder direktes `onClick` (siehe auch AGENTS.md).
- `DropdownMenuLabel` braucht zwingend einen `DropdownMenuGroup`-Parent, sonst Base-UI-Error #31.
- `<SelectValue>` zeigt keinen Text automatisch an, wenn die zugehörigen `SelectItem`-Children über `t()` gerendert werden — explizite Kinder setzen, z. B. `<SelectValue>{form.type === "feature" ? t(...) : t(...)}</SelectValue>`.

## HTML-Sanitizing

- `sanitize-html` statt `isomorphic-dompurify` — Letzteres ist ab v3 ESM-only (`jsdom` v29 → `@exodus/bytes`) und inkompatibel mit Next.js/Turbopack. `sanitize-html` ist CJS-kompatibel und läuft ohne DOM auch serverseitig. Config: `src/lib/sanitize.ts`, Allowlist-basiert (`script`/`style`/`iframe`/`form` geblockt).

## Offene Punkte

> Stand der letzten Prüfung: 21.05.2026 — vor Nutzung gegen aktuelle DB verifizieren, da diese Notiz seitdem nicht mehr aktualisiert wurde.

- [ ] Unique Index `cost_config_tenant_page_action_uniq ON cost_config (tenant_id, page_type, action_type)` — Voraussetzung für `seedDefaultCostConfig()` (ON CONFLICT); zum Zeitpunkt der letzten Notiz noch nicht gegen DB ausgeführt.
- [ ] Migration `0002_lowly_medusa.sql` (`feature_requests.is_public`) — zum Zeitpunkt der letzten Notiz noch nicht gegen DB ausgeführt.
