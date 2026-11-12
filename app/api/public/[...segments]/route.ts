import { NextResponse } from "next/server";
import { sanitizePublicSuccess } from "@/src/server/public-response";

type RouteContext = { params: Promise<{ segments: string[] }> };

function allowedPath(method: string, path: string): boolean {
  if (method === "GET") {
    return path === "churches" || path === "preview" || /^church-registrations\/[0-9a-f-]{36}\/status$/i.test(path);
  }
  if (method === "POST") {
    return path === "church-registrations" || path === "church-code/lookup" || path === "join-requests";
  }
  return false;
}

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { segments } = await context.params;
  const path = segments.join("/");
  if (!allowedPath(request.method, path)) {
    return NextResponse.json({ code: "PUBLIC_ROUTE_NOT_FOUND" }, { status: 404 });
  }

  if (request.method === "GET") {
    const search = new URL(request.url).searchParams.get("search");
    if (search && search.length > 120) {
      return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
  }

  const apiOrigin = (process.env.NEST_API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  if (!apiOrigin) {
    return NextResponse.json(
      { code: "PUBLIC_API_UNAVAILABLE", message: "The public platform service is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${apiOrigin}/api/public/${path}${incomingUrl.search}`);
  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  for (const name of ["authorization", "x-provisioning-token"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body: ArrayBuffer | undefined;
  if (request.method === "POST") {
    if (!contentType?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 415, headers: { "Cache-Control": "no-store" } });
    }
    const incomingBody = await request.arrayBuffer();
    if (incomingBody.byteLength > 64_000) {
      return NextResponse.json({ code: "REQUEST_TOO_LARGE" }, { status: 413, headers: { "Cache-Control": "no-store" } });
    }
    body = incomingBody;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    });
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) responseHeaders.set("Retry-After", retryAfter);
    if (!upstream.ok) {
      return NextResponse.json(
        { code: "PUBLIC_REQUEST_FAILED" },
        { status: upstream.status, headers: responseHeaders },
      );
    }
    const upstreamBody = await upstream.json().catch(() => null) as unknown;
    const safeBody = sanitizePublicSuccess(request.method, path, upstreamBody);
    if (!safeBody) {
      return NextResponse.json(
        { code: "PUBLIC_API_INVALID_RESPONSE" },
        { status: 502, headers: responseHeaders },
      );
    }
    return NextResponse.json(safeBody, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json(
      { code: "PUBLIC_API_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
