# Technical Decisions

## Middleware and Proxying
- **Decision**: Merged middleware logic into [`src/proxy.ts`](src/proxy.ts).
- **Rationale**: Centralizing proxying and request handling logic simplifies the architecture and ensures consistent behavior across different environments.

## Airtable Query Handling
- **Decision**: Implemented explicit timeouts for all Airtable queries in [`src/lib/airtable.ts`](src/lib/airtable.ts).
- **Rationale**: Prevents long-running requests from blocking the application and improves overall responsiveness.

## Route Protection
- **Decision**: Using `withAuth` HOC and NextAuth.js for route protection.
- **Rationale**: Provides a standardized way to secure pages and API routes, ensuring only authenticated users can access sensitive data and features.

## Authentication Flow
- **Decision**: Implemented "First User as Admin" logic in [`src/app/api/auth/[...nextauth]/route.ts`](src/app/api/auth/[...nextauth]/route.ts).
- **Rationale**: Simplifies initial setup by allowing the first person to sign in to automatically become the administrator, removing the need for hardcoded mock credentials.
- **Decision**: Removed mock credentials from the sign-in page UI.
- **Rationale**: Enhances security and provides a cleaner user experience for production-ready environments.

## UI Framework
- **Decision**: Using Tailwind CSS and Radix UI (via shadcn/ui) for the component library.
- **Rationale**: Enables rapid development of accessible and responsive UI components with a consistent design language.

## State Management
- **Decision**: Leveraging React Context and Hooks for local and global state management (e.g., `AlertsProvider`, `AuthProvider`).
- **Rationale**: Minimizes boilerplate and provides a clean, declarative way to manage application state.
