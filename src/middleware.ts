import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth/signin");

    if (isAuthPage) {
      if (token) {
        return NextResponse.redirect(new URL("/planning", req.url));
      }
      return null;
    }

    if (!token) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isAuthPage = req.nextUrl.pathname.startsWith("/auth/signin");
        const isApiAuthPage = req.nextUrl.pathname.startsWith("/api/auth");
        
        if (isAuthPage || isApiAuthPage) {
          return true;
        }
        
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
