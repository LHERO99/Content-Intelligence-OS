import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If authenticated and on sign-in page, redirect to home
    if (path.startsWith("/auth/signin") && token) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        
        // Public paths
        if (
          path.startsWith("/auth/signin") || 
          path.startsWith("/api/auth") ||
          path.startsWith("/api/n8n/callback") ||
          path.startsWith("/api/monitoring/import") ||
          path.startsWith("/api/auth/google/gsc/callback") ||
          path.startsWith("/api/cron/")
        ) {
          return true;
        }
        
        // Require authentication for all other matched paths
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - api/monitoring/import (n8n import)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (png, svg)
     */
    "/((?!api/auth|api/monitoring/import|api/auth/google/gsc/callback|api/cron|_next/static|_next/image|favicon.ico|.*\.svg|.*\.png).*)",
  ],
};
