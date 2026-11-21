import { NextResponse } from 'next/server';
import { requireSuperAdmin, applySuperAdminRefreshCookies } from '@/src/server/super-admin/guard';

export async function GET(req: Request) {
  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const res = NextResponse.json(
    {
      authenticated: true,
      role: 'super_admin',
      sessionId: auth.user?.sessionId,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );

  return applySuperAdminRefreshCookies(res, auth.newTokens);
}
