import { NextResponse } from "next/server";
import { sanitizePublicSuccess } from "@/src/server/public-response";

import type { ChurchRegistrationInput } from "@/src/server/platform/churches";

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

  const contentType = request.headers.get("content-type");
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

  const apiOrigin = (process.env.NEST_API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  if (!apiOrigin) {
    if (request.method === "POST" && path === "church-registrations") {
      const { getRequestIp, rateLimit, rateLimitedResponse } = await import("@/src/server/security");
      const { registerChurch } = await import("@/src/server/platform/churches");
      const ip = getRequestIp(request);
      const limit = rateLimit(`church-registrations:${ip}`, 5, 15 * 60);
      if (!limit.allowed) {
        return rateLimitedResponse(limit.retryAfterSeconds);
      }
      let payload: Record<string, unknown> | null = null;
      try {
        const parsed: unknown = body ? JSON.parse(new TextDecoder().decode(body)) : {};
        payload = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
        if (!payload) throw new Error("invalid shape");
      } catch {
        return NextResponse.json({ message: "بيانات غير صالحة", code: "INVALID_REQUEST" }, { status: 400 });
      }
      try {
        const result = await registerChurch({ ...(payload as unknown as ChurchRegistrationInput), ip });
        return NextResponse.json({ jobId: result.jobId, provisioningToken: result.provisioningToken });
      } catch (err: unknown) {
        const status = (err as { status?: number }).status || 400;
        const message = err instanceof Error ? err.message : "فشل التسجيل";
        const code = (err as { code?: string }).code || "REGISTRATION_FAILED";
        return NextResponse.json({ message, code }, { status });
      }
    }

    const matchStatus = path.match(/^church-registrations\/([0-9a-f-]{36})\/status$/i);
    if (request.method === "GET" && matchStatus) {
      const { platformQueryOne } = await import("@/src/server/platform/db");
      const { sha256Hex } = await import("@/src/server/platform/crypto");
      const jobId = matchStatus[1];
      const provisioningToken = (request.headers.get("x-provisioning-token") || "").trim();
      if (!provisioningToken) {
        return NextResponse.json({ code: "PROVISIONING_TOKEN_REQUIRED" }, { status: 401 });
      }
      // The token hash binds this read to the caller that started the job, so a
      // leaked or guessed job ID alone never reveals the church invitation code.
      const job = await platformQueryOne<{ status: string; currentStep: string }>(
        `SELECT "status", "currentStep" FROM "provisioning_jobs"
         WHERE "id" = $1 AND "provisioningTokenHash" = $2 LIMIT 1`,
        [jobId, sha256Hex(provisioningToken)],
      );
      if (!job) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
      const church = await platformQueryOne<{ code: string }>(
        `SELECT cc."code" FROM "church_codes" cc
         JOIN "provisioning_jobs" pj ON pj."churchId" = cc."churchId"
         WHERE pj."id" = $1 AND cc."revoked" = false LIMIT 1`,
        [jobId],
      );
      return NextResponse.json({
        status: job.status,
        progress: job.status === "succeeded" ? 100 : job.status === "running" ? 50 : 20,
        churchCode: church?.code || undefined,
      });
    }

    if (request.method === "GET" && path === "preview") {
      const { getPreviewStatus } = await import("@/src/server/platform/preview");
      const preview = await getPreviewStatus();
      return NextResponse.json(preview);
    }

    if (request.method === "GET" && path === "churches") {
      const { listChurches } = await import("@/src/server/platform/churches");
      const search = new URL(request.url).searchParams.get("search");
      const result = await listChurches({ search, page: 1, limit: 100 });
      return NextResponse.json({
        data: result.data.map((c) => ({
          slug: c.slug,
          name: c.name,
          city: c.city,
          publicDescription: c.legalName,
          verificationStatus: c.verificationStatus,
        })),
      });
    }

    return NextResponse.json(
      { code: "PUBLIC_API_UNAVAILABLE", message: "The public platform service is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${apiOrigin}/api/public/${path}${incomingUrl.search}`);
  const headers = new Headers({ Accept: "application/json" });
  if (contentType) headers.set("Content-Type", contentType);
  for (const name of ["authorization", "x-provisioning-token"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
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
