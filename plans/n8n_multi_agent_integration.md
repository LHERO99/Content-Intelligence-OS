# Implementation Plan: Multi-Agent n8n Integration

This plan outlines the integration of the n8n Multi-Agent system for automated content generation upon commissioning.

## 1. n8n Webhook Configuration

### 1.1 Webhook URL
The system will trigger the following webhook:
`https://n8n.heromarketing.de/webhook-test/23daa68a-287a-41b6-8d82-d6a61bea537c`

### 1.2 Payload Structure
The payload sent to n8n will include:
- `keywordId`: The Airtable record ID.
- `keyword`: The keyword text.
- `targetUrl`: The target URL (if available).
- `action`: 'COMMISSION_CONTENT'
- `timestamp`: ISO string.

## 2. Backend Integration

### 2.1 Update `src/lib/n8n.ts`
- Add `COMMISSION_CONTENT` to `N8nActionType`.
- Ensure the utility can handle the specific webhook URL if needed, or use the environment variable.

### 2.2 Update `handleCommissionContent` in `src/app/planning/editorial-planning.tsx`
- After updating the status to `In Progress` and logging the history, trigger the n8n action.
- Call `triggerN8nAction('COMMISSION_CONTENT', { ... })`.

## 3. UI Updates

### 3.1 Content Creation Page (`src/app/creation/page.tsx`)
- Ensure keywords with status `In Progress` (and a commissioning log) are displayed in the "Aufträge" list.
- Display status as "In Arbeit" for these items.
- Show the loading spinner on the right side until the n8n agent writes the `v2` content back to Airtable.

## 4. Implementation Steps

### Phase 1: n8n Utility Update
- [ ] Add `COMMISSION_CONTENT` to `N8nActionType` in `src/lib/airtable-types.ts` or `src/lib/n8n.ts`.
- [ ] Update `.env.local` with the new n8n webhook URL (if applicable) or hardcode for testing as requested.

### Phase 2: Trigger Integration
- [ ] Update `handleCommissionContent` in `src/app/planning/editorial-planning.tsx` to call the n8n webhook.
- [ ] Pass relevant keyword data (ID, Keyword, URL) to the webhook.

### Phase 3: Content Creation UI Refinement
- [ ] Update the "Aufträge" list to show "In Arbeit" for commissioned items.
- [ ] Verify that the loading state correctly handles the period between commissioning and AI completion.
