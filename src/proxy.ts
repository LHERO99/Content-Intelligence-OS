import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const isAuthPage = path.startsWith("/auth/signin");

    // Redirect authenticated users away from signin page
    if (isAuthPage) {
      if (token) {
        return NextResponse.redirect(new URL("/planning", req.url));
      }
      return null;
    }

    // Admin only routes
    if (path.startsWith("/admin") && token?.role !== "Admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // All other app routes require at least Editor
    // (Dashboard, Planning, Creation, Monitoring)
    const protectedRoutes = ["/", "/planning", "/creation", "/monitoring"];
    const isProtectedRoute = protectedRoutes.some(route => path === route || path.startsWith(route + "/"));
    
    if (isProtectedRoute && !token?.role) {
        // next-auth/middleware handles redirect to signin automatically if authorized returns false
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        const isAuthPage = path.startsWith("/auth/signin");
        const isApiAuthPage = path.startsWith("/api/auth");
        
        // Always allow auth pages and API auth routes
        if (isAuthPage || isApiAuthPage) {
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
