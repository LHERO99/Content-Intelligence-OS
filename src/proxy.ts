import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const isAuthPage = path.startsWith("/auth/signin");

    // If user is authenticated and tries to access signin page, redirect to /planning
    if (isAuthPage && token) {
      return NextResponse.redirect(new URL("/planning", req.url));
    }

    // Admin only routes
    if (path.startsWith("/admin") && token?.role !== "Admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        
        // Always allow auth pages and API auth routes
        if (path.startsWith("/auth/signin") || path.startsWith("/api/auth")) {
          return true;
        }
        
        // Require token for everything else matched by the config
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (png, svg)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png).*)",
  ],
};
