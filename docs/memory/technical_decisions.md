# Technical Decisions

## Middleware and Proxying
- **Decision**: Merged middleware logic into [`src/proxy.ts`](src/proxy.ts).
- **Rationale**: Centralizing proxying and request handling logic simplifies the architecture and ensures consistent behavior across different environments.
- **Decision**: Simplified middleware redirection logic to prevent infinite loops.
- **Rationale**: Authenticated users are now correctly redirected away from the sign-in page, and unauthenticated users are redirected to sign-in for protected routes, resolving a bug where valid sessions were being ignored by the middleware.

## Airtable Query Handling
- **Decision**: Implemented explicit timeouts for all Airtable queries in [`src/lib/airtable.ts`](src/lib/airtable.ts).
- **Rationale**: Prevents long-running requests from blocking the application and improves overall responsiveness.
- **Decision**: Enforced server-only execution for Airtable logic and extracted types.
- **Rationale**: To prevent sensitive Airtable API keys and logic from leaking to the client, [`src/lib/airtable.ts`](src/lib/airtable.ts) is now marked with `server-only`. Shared types were moved to [`src/lib/airtable-types.ts`](src/lib/airtable-types.ts) to allow client components to use types without importing the server-side logic.
- **Decision**: Centralized Airtable error handling with specific 403/401/404 logic.
- **Rationale**: To improve developer and user experience, a unified `handleAirtableError` function in [`src/lib/airtable.ts`](src/lib/airtable.ts:38) now intercepts all Airtable API errors. It provides specific troubleshooting steps for 403 (Authorization/Scopes) and 401 (Invalid Key) errors, making it easier to diagnose configuration issues.
- **Decision**: Centralized table name management via a `TABLES` constant and removed resilient matching logic.
- **Rationale**: To ensure consistency and prevent runtime errors due to table name mismatches, all table names are now explicitly defined in a centralized `TABLES` constant in [`src/lib/airtable.ts`](src/lib/airtable.ts:27). This replaces previous "resilient matching" logic with explicit, predictable naming that matches the actual Airtable base structure.

## Route Protection
- **Decision**: Using `withAuth` HOC and NextAuth.js for route protection.
- **Rationale**: Provides a standardized way to secure pages and API routes, ensuring only authenticated users can access sensitive data and features.

## Authentication Flow
- **Decision**: Implemented "First User as Admin" logic in [`src/app/api/auth/[...nextauth]/route.ts`](src/app/api/auth/[...nextauth]/route.ts).
- **Rationale**: Simplifies initial setup by allowing the first person to sign in to automatically become the administrator, removing the need for hardcoded mock credentials.
- **Decision**: Removed mock credentials from the sign-in page UI.
- **Rationale**: Enhances security and provides a cleaner user experience for production-ready environments.
- **Decision**: Configured dynamic cookie settings for NextAuth.
- **Rationale**: To ensure compatibility across different environments (local development vs. production), NextAuth is configured to use secure cookies only when `NEXTAUTH_URL` starts with `https`. This resolves session persistence issues in non-HTTPS environments.

## UI Framework
- **Decision**: Using Tailwind CSS and Radix UI (via shadcn/ui) for the component library.
- **Rationale**: Enables rapid development of accessible and responsive UI components with a consistent design language.
- **Decision**: Full UI localization to German.
- **Rationale**: To align with the primary user base and the DocMorris brand context, the entire application interface has been localized to German.

## User Onboarding & Invite System
- **Decision**: Implemented a temporary password and invite link generation system for user onboarding in [`src/app/api/admin/invite/route.ts`](src/app/api/admin/invite/route.ts).
- **Rationale**: Provides a secure and controlled way to add new users without requiring an immediate SMTP setup. Admins generate a unique link containing the temporary password, which the user can use for their first login.
- **Decision**: Forced password change for new users via `PasswordChangeModal`.
- **Rationale**: To ensure account security, users invited with a temporary password are required to change it upon their first successful login. This is enforced by checking a `requiresPasswordChange` flag in the user session.
- **Decision**: Implemented a dedicated Profile page for user self-service.
- **Rationale**: Allows users to manage their own account details and update their password independently, reducing administrative overhead.
- **Decision**: Implemented user management API routes ([`/api/admin/users/[id]`](src/app/api/admin/users/[id]/route.ts)) for editing and deleting users.
- **Rationale**: To provide full administrative control over the user lifecycle, allowing admins to update user roles, details, or remove access as needed.
- **Decision**: Using `crypto.randomBytes(8).toString("hex")` for temporary passwords.
- **Rationale**: Ensures high entropy and sufficient complexity for initial credentials while remaining easy for admins to copy and share.

## Data Management & Import
- **Decision**: Using client-side CSV parsing with `papaparse` in [`src/app/planning/keyword-import.tsx`](src/app/planning/keyword-import.tsx).
- **Rationale**: Offloading parsing to the client reduces server load and allows for immediate validation of the CSV structure before sending data to the API.
- **Decision**: Implemented bulk Airtable updates in chunks of 10 in [`src/lib/airtable.ts`](src/lib/airtable.ts:332).
- **Rationale**: Airtable's API limits batch operations to 10 records per call. The `bulkCreateKeywords` function automatically handles chunking to ensure reliable imports of larger datasets while staying within API limits.
- **Decision**: Enforced mandatory "Keyword" and "Target_URL" fields for all data entry methods (manual and import).
- **Rationale**: To ensure data integrity and prevent incomplete records in the planning workspace, these two fields are now strictly required. Manual entry forms and CSV import logic both validate for these fields before submission.
- **Decision**: Implementation of a dedicated Blacklist view in the Planning module.
- **Rationale**: To maintain content quality and focus, a separate management interface for excluded keywords was added, allowing users to explicitly mark and manage terms that should not be targeted.

## State Management
- **Decision**: Leveraging React Context and Hooks for local and global state management (e.g., `AlertsProvider`, `AuthProvider`).
- **Rationale**: Minimizes boilerplate and provides a clean, declarative way to manage application state.
