import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeRefreshToken } from "@/src/server/auth";
import { safeNextPath } from "../lib/safe-next";
import { SESSION_COOKIE, SESSION_COOKIE_PATH } from "../lib/session";

/**
 * Server-side logout. Clearing the httpOnly cookies here guarantees the proxy
 * stops treating the browser as authenticated even if client code is stale.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"), null);

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
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";
  const base = host ? `${proto}://${host}` : request.url;
  const response = NextResponse.redirect(new URL(destination, base));
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
  // Clear the legacy cookie scope used by older deployments.
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
