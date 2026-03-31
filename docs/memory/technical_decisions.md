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
- **Rationale**: To improve developer and user experience, a unified `handleAirtableError` function in [`src/lib/airtable.ts`](src/lib/airtable.ts:28) now intercepts all Airtable API errors. It provides specific troubleshooting steps for 403 (Authorization/Scopes) and 401 (Invalid Key) errors, making it easier to diagnose configuration issues.

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

## State Management
- **Decision**: Leveraging React Context and Hooks for local and global state management (e.g., `AlertsProvider`, `AuthProvider`).
- **Rationale**: Minimizes boilerplate and provides a clean, declarative way to manage application state.
