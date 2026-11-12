/**
 * Small, dependency-free security helpers for server route handlers.
 *
 * The in-memory rate limiter is intentionally simple. On multi-instance
 * deployments it protects each instance only; use a shared store (Redis/Neon
 * advisory locks) when platform-wide throttling is required.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowSeconds: number, now = Date.now()): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}

/** Same-origin check for state-changing cookie-authenticated endpoints. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // Native clients and same-origin fetches may omit it.
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function requireSameOrigin(req: Request): Response | null {
  if (isSameOrigin(req)) return null;
  return Response.json(
    { message: 'طلب غير موثوق', code: 'ORIGIN_MISMATCH', statusCode: 403 },
    { status: 403 },
  );
}

export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { message: 'محاولات كثيرة، حاول بعد قليل', code: 'RATE_LIMITED', statusCode: 429 },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds), 'Cache-Control': 'no-store' } },
  );
}

export function noStoreJson(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}
