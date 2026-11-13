import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeRefreshToken } from "@/src/server/auth";
import { SESSION_COOKIE, SESSION_COOKIE_PATH } from "../lib/session";

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * Server-side logout. Clearing the httpOnly cookies here guarantees the proxy
 * stops treating the browser as authenticated even if client code is stale.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch {
      // Logout must still clear local cookies if token revocation fails.
    }
  }

  const destination = next ? `/login?next=${encodeURIComponent(next)}` : "/";
  const response = NextResponse.redirect(new URL(destination, request.url));
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/auth",
    expires: new Date(0),
  });
  response.cookies.set("tenant_slug", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: SESSION_COOKIE_PATH,
    expires: new Date(0),
  });

  return response;
}
