# Updated Implementation Plan: Content Commissioning Workflow

This plan outlines the implementation of a "Content Commissioning" (Content beauftragen) workflow, linking the Editorial Planning with the existing Content Creation interface.

## 1. Data Model Updates

### 1.1 Keyword Status
Update `KeywordStatus` in [`src/lib/airtable-types.ts`](src/lib/airtable-types.ts:1) to include 'Beauftragt'.
- `export type KeywordStatus = 'Backlog' | 'Planned' | 'Beauftragt' | 'In Progress' | 'Published';`

## 2. Editorial Planning Enhancements

### 2.1 Table Column
Add an "Aktion" column to the `columns` definition in [`src/app/planning/editorial-planning.tsx`](src/app/planning/editorial-planning.tsx).
- **Button**: "Content beauftragen"
- **Icon**: `Zap`
- **Condition**: Only show if status is 'Planned'.

### 2.2 Commissioning Handler
Implement `handleCommissionContent` in [`src/app/planning/editorial-planning.tsx`](src/app/planning/editorial-planning.tsx).
- Calls `PATCH /api/planning/keywords` with `{ id, Status: 'Beauftragt' }`.
- Shows a success toast: "Content beauftragt. In wenigen Minuten im Tab 'Content-Erstellung' einsehbar."
- Triggers a data refresh.

## 3. Content Creation Page Updates ([`src/app/creation/page.tsx`](src/app/creation/page.tsx))

### 3.1 Layout Transformation
Modify the existing page to use a split-screen layout.

#### Left Side: Commission List (Aufträge)
- Replace or enhance the current keyword selector with a table named "Aufträge".
- Show all keywords where `Status` is 'Beauftragt' or 'In Progress'.
- Columns: Keyword, Status, Timestamp (derived from `Content-Log` or `Created_At`).

#### Right Side: Editor & Preview
- Keep the existing `AIEditorWorkspace`, `ScoringEngine`, and `ReasoningPanel`.
- Ensure they load data based on the selection from the "Aufträge" table.
- Show a loading spinner or "Waiting for AI..." placeholder if no `v2` log entry exists yet for a 'Beauftragt' keyword.

## 4. Implementation Steps

### Phase 1: Types & API
- [ ] Update `KeywordStatus` in `src/lib/airtable-types.ts`.
- [ ] Verify `PATCH /api/planning/keywords` handles the new status.

### Phase 2: Editorial Planning UI
- [ ] Add "Aktion" column to `columns` in `src/app/planning/editorial-planning.tsx`.
- [ ] Implement `handleCommissionContent` logic.
- [ ] Add "Beauftragt" to the status dropdown in `EditEditorialModal`.

### Phase 3: Content Creation Page Refactor
- [ ] Modify `src/app/creation/page.tsx` to implement the split-screen layout.
- [ ] Implement the "Aufträge" table on the left side.
- [ ] Connect the table selection to the existing editor/preview components on the right.
- [ ] Add placeholder/loading states for keywords without generated content.
