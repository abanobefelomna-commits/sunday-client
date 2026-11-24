import { NextResponse } from 'next/server';
import { processPendingProvisioningJobs } from '@/src/server/platform/provisioning';
import { getRequestIp, rateLimit } from '@/src/server/security';
import { safeEqual } from '@/src/server/platform/crypto';
import { getSuperAdminAuth } from '@/src/server/super-admin/guard';

/**
 * POST /api/super-admin/provision
 *
 * Secure trigger for the provisioning worker. Called by:
 *   - Vercel Cron (Authorization: Bearer <PROVISIONING_CRON_SECRET>)
 *   - Super-admin dashboard or authenticated Super Admin session
 *
 * Guards:
 *   - Bearer token compared with timing-safe equality OR valid Super Admin session
 *   - IP-based rate limit (5 req / 60 s) to prevent abuse
 *   - Concurrency is handled inside processPendingProvisioningJobs /
 *     claimJob via a DB-level UPDATE … WHERE predicate; calling this
 *     endpoint multiple times is safe.
 *   - Never activates a church without tenant identity verification
 *     (enforced inside provisionChurch).
 */
export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const limit = rateLimit(`provision-trigger:${ip}`, 5, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'Too many requests', code: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(limit.retryAfterSeconds ?? 60),
        },
      },
    );
  }

  const secret = (process.env.PROVISIONING_CRON_SECRET || process.env.CRON_SECRET || '').trim();
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  let isAuthorized = false;
  if (secret && token && safeEqual(token, secret)) {
    isAuthorized = true;
  } else {
    const adminAuth = await getSuperAdminAuth(req);
    if (adminAuth.authenticated && adminAuth.user) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    if (!secret) {
      return NextResponse.json(
        { message: 'Provisioning trigger is not configured', code: 'NOT_CONFIGURED' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { message: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get('limit');
  const jobLimit = rawLimit ? Math.max(1, Math.min(10, parseInt(rawLimit, 10) || 5)) : 5;

  try {
    const results = await processPendingProvisioningJobs(jobLimit);

    const summary = {
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      details: results.map((r) => ({
        jobId: r.jobId,
        churchId: r.churchId,
        status: r.status,
        ...(r.error ? { errorCode: r.error.code } : {}),
      })),
    };

    console.log('[ProvisioningCron] run complete', JSON.stringify(summary));

    return NextResponse.json(
      { ok: true, ...summary },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    // Log only the error name/code — never raw messages that could leak DB info.
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.error('[ProvisioningCron] unexpected error:', name);
    return NextResponse.json(
      { message: 'Provisioning run failed', code: 'PROVISIONING_RUN_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

// Vercel Cron handler alias (GET is called by Vercel cron jobs).
// We keep POST as the primary handler; GET validates the same secret.
export async function GET(req: Request) {
  return POST(req);
}
