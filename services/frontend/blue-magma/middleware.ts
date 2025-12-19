import { NextRequest, NextResponse } from "next/server";

	const protectedRoutes = [
	  "/dashboard",
	  "/account",
	  "/subscription",
	  "/billing",
	  "/credits",
	  "/integrations",
	  "/knowledge-base",
	  "/trust",
	]; // Add all protected routes here
const publicRoutes = [
  "/login",
  "/signup",
  "/auth/github/callback",
  "/api/auth/github/callback",
  "/auth/google/callback",
  "/api/auth/google/callback",
]; // Public routes that don't require auth

export function middleware(req: NextRequest) {
  const token =
    req.cookies.get("access_token")?.value ||
    req.headers.get("authorization")?.split(" ")[1];

  // Allow public routes
  if (publicRoutes.some((route) => req.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (protectedRoutes.includes(req.nextUrl.pathname) && !token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// Configure middleware to only run on specific routes to avoid bundling issues
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
