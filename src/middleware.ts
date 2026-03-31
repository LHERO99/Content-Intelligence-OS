import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin only routes
    if (path.startsWith("/admin") && token?.role !== "Admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // All other app routes require at least Editor
    // (Dashboard, Planning, Creation, Monitoring)
    // We assume everything except /auth and public assets is protected
    const protectedRoutes = ["/", "/planning", "/creation", "/monitoring"];
    const isProtectedRoute = protectedRoutes.some(route => path === route || path.startsWith(route + "/"));
    
    if (isProtectedRoute && !token?.role) {
        // next-auth/middleware handles redirect to signin automatically if authorized returns false
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - auth/signin (Login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!api/auth|auth/signin|_next/static|_next/image|favicon.ico|.*\\.svg).*)",
  ],
};
