import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./app/lib/session";

/**
 * Routes that render the public experience. `/` is special: authenticated
 * visitors skip the landing page and go straight to the dashboard.
 */
const AUTH_ENTRY_PATHS = new Set(["/", "/login", "/register"]);

/**
 * Routes that require a session. The proxy is the first line of defence; every
 * API behind these pages still validates the signed access token server-side.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/analytics",
  "/attendance",
  "/children",
  "/classes",
  "/follow-ups",
  "/friday-prep",
  "/news",
  "/notifications",
  "/profile",
  "/servants",
  "/app",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (hasSession && AUTH_ENTRY_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!hasSession && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
