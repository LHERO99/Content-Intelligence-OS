# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

---

# Content Intelligence OS (Plexaro)

> Multi-Tenant SEO-Content-Orchestrierungsplattform. Deckt den kompletten Workflow von Keyword-Planung über KI-gestützte Content-Erstellung bis Publishing & Performance-Monitoring ab. Zielgruppe: Agenturen/Teams, die SEO-Content für mehrere Mandanten (Tenants) verwalten. Produktname in der UI: **Plexaro**, deutsche UI ist per Du.

## Stack

| Schicht | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.2 |
| UI-Library | React | 19.2.4 |
| Sprache | TypeScript (strict) | 5.9 |
| DB | PostgreSQL via Drizzle ORM | drizzle-orm 0.45, drizzle-kit 0.31 |
| Auth | NextAuth.js (Credentials + JWT) | 4.24 |
| Styling | Tailwind CSS 4 + shadcn (Style `base-nova`) + `@base-ui/react` | |
| Icons | lucide-react | |
| Rich-Text-Editor | Tiptap | 3.x |
| Flow-/Node-Editor | `@xyflow/react` (Agent-Workflow-Builder) | 12.x |
| Drag & Drop | `@dnd-kit/*` | |
| Charts | recharts | 3.x |
| Tabellen | `@tanstack/react-table` | 8.x |
| E-Mail | nodemailer + eigener SMTP-Client (pro Tenant konfigurierbar) | |
| Datei-Upload | `@vercel/blob` | |
| Hosting | Vercel (inkl. Vercel Cron via `vercel.json`) | |
| i18n | Eigenes Dictionary-Pattern (`de`/`en`, Default `de`), kein next-intl | |
| Tests | **Kein Test-Framework eingerichtet** — es existiert kein `npm test` | — |

**Nicht mehr genutzt (Legacy, siehe [Landminen](#landminen)):** Airtable, n8n.

## Befehle

```bash
npm install              # Dependencies installieren
npm run dev               # Dev-Server (Next.js)
npm run build              # Production-Build
npm start                  # Production-Server starten
npm run lint                # ESLint (eslint-config-next, flat config)
npx tsc --noEmit            # Type-Check (kein eigenes Script, aber vor jedem Deploy sauber halten)

npm run db:generate          # Drizzle-Migration aus schema.ts generieren
npm run db:migrate            # Migrationen gegen DATABASE_URL ausführen
npm run db:studio             # Drizzle Studio (DB-Browser)
```

Es gibt **kein** `npm test`. Änderungen werden über `tsc --noEmit`, `npm run lint` und manuelles Testen im Dev-Server verifiziert.

## Regeln

- [MUST] **Nie selbst `git commit`, `git push` oder `git pull` ausführen** — das macht der User ausschließlich selbst. Änderungen im Arbeitsverzeichnis vornehmen und dem User überlassen, wann/wie committed, gepusht oder gepullt wird. Lesende Git-Befehle (`git status`, `git log`, `git diff`, `git show`) sind unproblematisch.
- [MUST] Vor jeder Next.js-spezifischen Änderung (Routing, Server Actions, Caching, Data Fetching) die passende Doku in `node_modules/next/dist/docs/` lesen — diese Version weicht vom Trainingsstand ab.
- [MUST] Strict TypeScript, `tsc --noEmit` muss vor Abschluss einer Aufgabe sauber durchlaufen.
- [MUST] **Tenant-Isolation:** `tenantId` ausschließlich aus der Session (`session.user.tenantId`) oder einer DB-Row ableiten, **nie** aus Client-Input (Request-Body/Query) übernehmen. DB-Zugriffe über `withTenant(tenantId, ...)` (`src/lib/db/index.ts`) kapseln, das setzt `app.tenant_id` transaktionslokal für die Postgres-RLS-Policies.
- [MUST] Für Foreign Keys auf `users` immer `session.user.id` (UUID) verwenden, nie `session.user.email`. E-Mail nur für Versand/Anzeige.
- [MUST] Security-Checks (Cron-Secrets, API-Keys) nie hinter einem Feature-Flag verstecken, das bei fehlender Konfiguration einen kompletten Bypass erlaubt — fehlende Konfiguration muss hart ablehnen (503/401), nicht durchwinken.
- [MUST] Nutzergenerierten/KI-generierten HTML-Content vor `dangerouslySetInnerHTML` durch `src/lib/sanitize.ts` (sanitize-html) schicken.
- [MUST] Neue i18n-Strings immer in **beiden** `src/i18n/messages/de.ts` und `en.ts` ergänzen (`de` ist Default, per Du).
- [MUST] Neue Routen, die für **alle** Rollen zugänglich sein sollen (nicht nur SuperAdmin), in `SUPER_ADMIN_EXEMPT_PREFIXES` (`src/app/authenticated-layout.tsx`) UND im Middleware-Matcher/`authorized`-Callback (`src/middleware.ts`) berücksichtigen.
- [MUST] Bei neuen `@base-ui/react`-basierten UI-Komponenten: kein `asChild` (existiert nicht in Base UI, stattdessen `render`-Prop), `DropdownMenuLabel` braucht zwingend einen `DropdownMenuGroup`-Parent.
- [SHOULD] UI-Gating (z. B. „Content angeliefert" anzeigen) auf semantische, exakte Event-Labels (`process_events`/`Event_Label`) stützen, nicht auf abgeleitete/berechnete Felder wie `Version`.
- [SHOULD] Keine Größen-Defaults (`max-w-*` etc.) in UI-Basiskomponenten (`src/components/ui/*`) setzen — Breite wird vom Aufrufer via `className` bestimmt.
- [SHOULD] Kleine, fokussierte Commits; DB-Schema-Änderungen immer über `drizzle-kit generate` + Migration, nie manuell in der DB.
- [SHOULD] Bei Schema-Änderungen die „Offene Punkte" in `docs/memory/domain-notes.md` prüfen — im Projekt gab es mehrfach den Fall „Migration generiert, aber noch nicht gegen DB ausgeführt".
- [SHOULD] Historie/Bugfix-Verlauf über `git log`/Commit-Messages nachschlagen statt in `docs/memory/` zu suchen — dort steht nur noch kuratiertes, nicht-chronologisches Domänenwissen, kein Changelog. Neue dauerhaft gültige Erkenntnisse dort themenbasiert ergänzen statt chronologisch anzuhängen.

## Struktur

```text
src/
  app/                      # Next.js App Router: Seiten + API-Routen (Route Handlers)
    api/                    # Backend-Endpunkte, nach Domäne gruppiert (planning/, creation/, monitoring/, admin/, super-admin/, cron/, agent-webhook/, agent-workflows-v2/)
    <feature>/page.tsx      # Seiten je Top-Level-Feature (planning, creation, monitoring, super-admin, ...)
  features/                 # Feature-spezifische Komponenten/Hooks/Services (planning, agent-workflow-v2, admin, shared)
  domain/                   # Domain-Modelle (aktuell nur agent-workflow-v2 — DDD-Schnitt, kein projektweites Pattern)
  application/               # Anwendungslogik/Ports (aktuell nur agent-workflow-v2)
  infrastructure/            # Adapter-Implementierungen (aktuell nur agent-workflow-v2; airtable-repositories.ts ist Legacy-Rest)
  lib/                       # Zentrale Logik & Integrationen
    db/                      # Drizzle: schema.ts, index.ts (Connection + withTenant), migrations/, queries/
    postgres.ts               # Zentrale DB-Query-Funktionen (aktive Datenschicht)
    email/                     # SMTP-Client + E-Mail-Templates
    alerts/                     # Alert-Regel-Engine, Benachrichtigungen
    sanitize.ts                  # HTML-Sanitizing (sanitize-html)
    sync-performance.ts, sync-jobs.ts, dataforseo.ts, sistrix.ts, google-search-console.ts  # externe Ranking-/Performance-Integrationen
  components/
    ui/                       # shadcn/Base-UI-Basiskomponenten
    providers/                 # LanguageProvider, BrandingProvider
  i18n/                        # Dictionary-Pattern (de.ts/en.ts), useI18n Hook
  hooks/                        # geteilte React-Hooks
  scripts/                       # einmalige Wartungs-/Debug-Skripte (ts-node/tsx)
scripts/                          # Repo-Root-Skripte (u. a. Airtable-Migrationsskript, Legacy)
plans/                              # historische Planungsdokumente (siehe Landminen — teils veraltet)
docs/memory/                        # themenbasiertes Domänenwissen, das nicht aus dem Code ersichtlich ist (domain-notes.md) — kein Changelog, dafür `git log`
```

*Legt sich hier von selbst mit dem Projekt an — nicht vorab spekulativ ausbauen. Das `domain/application/infrastructure`-Schema existiert bewusst nur für `agent-workflow-v2`; es ist kein projektweiter Zwang, für andere Features ebenfalls diese Schichtung einzuführen.*

## Was wohin gehört

| Aufgabe | Ordner |
|---|---|
| Neuer API-Endpunkt | `src/app/api/<domäne>/route.ts` |
| Neue DB-Tabelle/-Spalte | `src/lib/db/schema.ts` + `npm run db:generate` |
| Neue DB-Query-Funktion | `src/lib/postgres.ts` |
| Neue Business-Logik (Planning) | `src/features/planning/services/` |
| Neue UI-Komponente (generisch) | `src/components/ui/` |
| Neue UI-Komponente (feature-spezifisch) | `src/features/<feature>/components/` |
| Agent-Workflow-Builder-Logik | `src/domain|application|infrastructure/agent-workflow-v2/` + `src/features/agent-workflow-v2/` |
| Neuer Cron-Job | `src/app/api/cron/<name>/route.ts` + Eintrag in `vercel.json` |
| Neuer i18n-String | `src/i18n/messages/de.ts` + `en.ts` |
| E-Mail-Template | `src/lib/email/templates/` |
| Externe Integration (Ranking/SEO-Daten) | `src/lib/<provider>.ts` (z. B. `dataforseo.ts`, `sistrix.ts`) |

## Landminen

*Dinge, die die KI nicht aus dem Code allein erraten kann.*

- **Airtable und n8n werden nicht mehr genutzt**, obwohl das Projekt ursprünglich darauf ausgelegt war und entsprechender Code noch im Repo liegt: `src/lib/airtable.ts`, `src/lib/airtable-types.ts`, `src/lib/n8n.ts`, `src/lib/db-adapter.ts`, `src/infrastructure/agent-workflow-v2/airtable-repositories.ts`, `src/app/api/n8n/*`, `src/app/api/test-airtable/*`, `src/app/api/debug/airtable/*`, `scripts/migrate-from-airtable.ts`, `AIRTABLE_SETUP.md`. **Keine neuen Features darauf aufbauen** — aktive Datenschicht ist Postgres/Drizzle (`src/lib/postgres.ts`), aktiver Orchestrierungs-/Webhook-Pfad ist `src/app/api/agent-webhook/*` bzw. der interne `agent-workflow-v2`.
- `plans/architecture.md` beschreibt die **alte** Airtable+n8n-Architektur und ist veraltet — nicht als aktuelle Referenz verwenden. Aktuellen Stand stattdessen aus `docs/memory/technical_decisions.md` und `docs/memory/project_status.md` ziehen.
- `src/lib/postgres-legacy.ts.bak` und `src/lib/postgres-old-backup.ts.bak` sind bewusst deaktivierter toter Code (TypeScript-Fehler) — nicht reaktivieren.
- **Multi-Tenant über RLS + App-Layer doppelt abgesichert:** Postgres Row-Level-Security (`0001_add_row_level_security.sql`) ist die zweite Schutzschicht, ersetzt aber nicht die App-seitige `tenantId`-Filterung. Kein `FORCE ROW LEVEL SECURITY` gesetzt — der Table Owner umgeht RLS (nötig für SuperAdmin-Queries über Tenants hinweg).
- Integrations-Secrets (z. B. `EXTERNAL_AGENT_WEBHOOK_SECRET`, DataForSEO/Sistrix/GSC-Keys) liegen **pro Tenant in der DB** (`admin-integrations.ts`/Config), nicht als env vars — nur globale Infra-Secrets (`DATABASE_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET`, `SMTP_*`, `N8N_API_KEY` als Legacy-Fallback) stehen in env vars.
- `content_log.Version` (`v1`/`v2`) ist **kein DB-Feld**, sondern wird berechnet (`hasBody ? 'v2' : 'v1'`). UI-Gating für „Content angeliefert" läuft strikt über den exakten String `Event_Label === "Content angeliefert"`, nicht über `Version`.
- `execution_versions` ist Append-Only: jeder Save (Agent-Delivery, manuelle Edits, KI-Refinement) erzeugt eine **neue** Version, nie ein Überschreiben. `Cycle_Id` (FK zu `execution_cycles`) und `Commission_Log_Id` (`process_events.id`, für UI-Mapping) sind zwei unterschiedliche Dinge — nicht verwechseln.
- NextAuth: **keine** Custom-Cookie-Namen in `authOptions` setzen — `withAuth` aus `next-auth/middleware` (`src/middleware.ts`) kennt `authOptions` nicht, das führt zu einem Redirect-Loop auf Vercel.
- `BOOTSTRAP_ENABLED=true` nur temporär für das initiale Setup setzen (erlaubt Selbst-Registrierung als erster Admin), danach wieder entfernen.
- Bei neuen öffentlichen API-Routen (kein Auth nötig) müssen sowohl der `matcher` in `src/middleware.ts` als auch die `authorized`-Callback-Whitelist angepasst werden — sonst 401/Redirect trotz gewollter Öffentlichkeit.
- `package.json` → `"name": "temp-next"` ist eine Altlast von `create-next-app` und hat keine funktionale Bedeutung.
- Root-Level-Dateien `test.txt`, `kw_data.json` (leer), `ai-editor-workspace-changes.patch`, `page-changes.patch`, `AIRTABLE_SETUP.md`, `performance-migration.sql`, `setup.sql` sind historische/Ad-hoc-Artefakte, keine gepflegte Doku oder aktiver Code-Pfad.
- `docs/memory/domain-notes.md` ist bewusst **kein** Changelog mehr (war es früher, wurde aufgeräumt) — nur noch aktuelles, themenbasiertes Domänenwissen. Vor größeren Änderungen an URL-zentrischer Architektur, Agent-Workflow-V2 oder Ranking-Logik dort nachschlagen; neue Erkenntnisse dort ergänzen, nicht chronologisch anhängen.

---

**Unterordner-`agents.md` nur anlegen, wenn ein Ordner wiederholt eigene Konventionen braucht, die hier oben nicht abgedeckt sind — nicht vorab für jede Schicht.** Minimal-Vorlage dafür:

```markdown
# [Ordnername]

Erbt von [Pfad zur übergeordneten agents.md]. Nur Overrides/Ergänzungen unten.

## Regeln
- [MUST] ...

## Override
- [Welche Parent-Regel wird hier gebrochen, und warum]
```
