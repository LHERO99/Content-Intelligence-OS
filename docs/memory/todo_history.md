# Todo History

## Resolved Tasks - 2026-03-31

### Authentication & Security
- [x] Fixed authentication flow to prevent redirect loops.
- [x] Implemented `withAuth` for route protection.
- [x] Configured NextAuth.js with custom sign-in page.
- [x] Added password hashing script for user management.
- [x] Resolved "Signing in..." hang with client-side timeouts and `finally` blocks.
- [x] Secured Airtable logic with `server-only` and extracted types to prevent client-side leaks.
- [x] Added session debug route to troubleshoot authentication state.
- [x] Implemented mandatory password change flow for new users.
- [x] Created `PasswordChangeModal` component for forced security updates.
- [x] Developed User Profile page ([`src/app/profile/page.tsx`](src/app/profile/page.tsx)) for account management.
- [x] Added API route for password changes ([`src/app/api/user/change-password/route.ts`](src/app/api/user/change-password/route.ts)).

### UI & Branding
- [x] Integrated DocMorris logo into the sidebar and sign-in page.
- [x] Developed core UI components (Button, Card, Input, etc.) using shadcn/ui.
- [x] Implemented responsive sidebar with mobile support.
- [x] Created global alerts system for user feedback.
- [x] Fully localized the application UI to German.
- [x] Reorganized sidebar navigation:
  - [x] Moved Admin Panel link to the sidebar footer.
  - [x] Linked user identity block directly to the Profile page.
- [x] Resolved 404 errors by creating the missing Admin page and fixing sidebar navigation logic.
- [x] Implemented Admin Panel features:
  - [x] User list with role badges.
  - [x] Invite system with temporary password and link generation.
  - [x] Advanced user management: **Edit** and **Delete** users via [`src/app/api/admin/users/[id]/route.ts`](src/app/api/admin/users/[id]/route.ts).
  - [x] Invitation management: **Cancel** pending invitations.
  - [x] Role-based access control for the Admin route.

### Data & API
- [x] Established Airtable connection with timeout handling.
- [x] Aligned Airtable table names in the codebase with the actual base structure using a centralized `TABLES` constant in [`src/lib/airtable.ts`](src/lib/airtable.ts:27).
- [x] Removed resilient matching logic in favor of explicit table naming.
- [x] Resolved Airtable 403 Authorization errors by implementing centralized error handling and troubleshooting logic in [`src/lib/airtable.ts`](src/lib/airtable.ts:38).
- [x] Fixed `TypeError: Cannot read properties of undefined (reading 'startsWith')` on the dashboard by adding defensive null/undefined checks for Airtable field accesses in [`src/app/page.tsx`](src/app/page.tsx:95).
- [x] Implemented n8n trigger API for workflow automation.
- [x] Created debug routes for simulating data drops, counting users, and verifying Airtable connectivity.
- [x] Developed Keyword Table and Trend Radar components for the Planning module.
- [x] Restructured Planning workspace with a tabbed interface:
  - [x] **Redaktions-Planung**: Primary view for editorial scheduling.
  - [x] **Keyword-Map**: For strategic keyword management.
  - [x] **Trend-Radar**: For identifying new potentials.
  - [x] **Blacklist**: For managing excluded keywords.
- [x] Implemented unified "Add Entry" FAB ([`src/app/planning/add-entry-fab.tsx`](src/app/planning/add-entry-fab.tsx)):
  - [x] Centralized entry point for Keywords, Trends, and Blacklist items.
  - [x] Context-aware type selection based on active tab.
  - [x] Removed redundant manual entry forms to streamline the UI.
- [x] Enhanced Keyword Import:
  - [x] Added validation for mandatory "Keyword" and "Target_URL" columns.
  - [x] Improved error reporting for malformed CSV files.
- [x] Implemented CSV/Excel keyword import:
  - [x] Client-side parsing with `papaparse`.
  - [x] Bulk Airtable creation with 10-record chunking in [`src/lib/airtable.ts`](src/lib/airtable.ts:326).
  - [x] Dedicated API route for imports ([`src/app/api/planning/import/route.ts`](src/app/api/planning/import/route.ts)).

### Infrastructure
- [x] Configured ESLint and PostCSS for code quality and styling.
- [x] Set up project structure with clear separation of concerns (app, components, lib, hooks).
- [x] Created initial architecture and implementation plans.

## Debugging Steps Taken
- **Airtable 403 Authorization**: Investigated persistent 403 errors during Airtable operations. Identified that generic error messages made it difficult to distinguish between incorrect Base IDs, missing scopes in Personal Access Tokens, and invalid API keys. Resolved by implementing `handleAirtableError` in [`src/lib/airtable.ts`](src/lib/airtable.ts:28) to provide specific troubleshooting guidance for 403 and 401 status codes.
- **Dashboard Crash (startsWith)**: Investigated a `TypeError` on the dashboard. Identified that `AuditLog.Action` could be `undefined` when records are incomplete in Airtable, causing `.startsWith()` to fail. Resolved by adding optional chaining (`?.`) and fallback values to all string operations on Airtable data in [`src/app/page.tsx`](src/app/page.tsx:95) and [`src/app/planning/keyword-table.tsx`](src/app/planning/keyword-table.tsx:82).
- **404 Errors & Routing**: Investigated 404 errors occurring when navigating to the Admin Panel. Resolved by creating the missing [`src/app/admin/page.tsx`](src/app/admin/page.tsx) and correcting the conditional rendering logic in [`src/components/app-sidebar.tsx`](src/components/app-sidebar.tsx:82).
- **Auth Redirect Loop**: Investigated middleware and NextAuth configuration to identify the cause of the loop. Fixed by ensuring correct session handling and redirect logic.
- **Sign-in Hangs**: Identified that the `signIn` promise could hang indefinitely. Added a 10-second timeout and ensured the loading state is reset in a `finally` block.
- **Airtable Client Leak**: Discovered Airtable logic being imported into client components. Fixed by marking `airtable.ts` as `server-only` and extracting types to a separate file.
- **Airtable Timeouts**: Monitored API response times and implemented explicit timeouts to prevent request hanging.
- **Logo Rendering**: Verified file paths and component usage to ensure the DocMorris logo displays correctly across different screen sizes.
