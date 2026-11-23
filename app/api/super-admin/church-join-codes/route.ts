import { NextResponse } from 'next/server';
import { requireSuperAdmin, applySuperAdminRefreshCookies } from '@/src/server/super-admin/guard';
import { listChurchJoinCodes } from '@/src/server/super-admin/church-join-codes';

export async function GET(req: Request) {
  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const data = await listChurchJoinCodes();
    return applySuperAdminRefreshCookies(
      NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } }),
      auth.newTokens,
    );
  } catch (error: unknown) {
    console.error('List church join codes failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { message: 'تعذر جلب رموز الانضمام', code: 'LIST_JOIN_CODES_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
