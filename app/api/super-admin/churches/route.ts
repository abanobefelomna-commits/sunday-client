import { NextResponse } from 'next/server';
import { requireSuperAdmin, applySuperAdminRefreshCookies } from '@/src/server/super-admin/guard';
import { listChurches, getPlatformStats } from '@/src/server/platform/churches';

export async function GET(req: Request) {
  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const search = url.searchParams.get('search');
  const status = url.searchParams.get('status');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  try {
    const [churchesResult, stats] = await Promise.all([
      listChurches({ search, status, page, limit }),
      getPlatformStats().catch(() => null),
    ]);

    const res = NextResponse.json(
      {
        data: churchesResult.data,
        meta: churchesResult.meta,
        stats,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );

    return applySuperAdminRefreshCookies(res, auth.newTokens);
  } catch (error: unknown) {
    console.error('List churches for super admin error:', error);
    return NextResponse.json(
      { message: 'فشل جلب قائمة الكنائس', code: 'LIST_CHURCHES_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
