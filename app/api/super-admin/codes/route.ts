import { NextResponse } from 'next/server';
import { requireSuperAdmin, applySuperAdminRefreshCookies } from '@/src/server/super-admin/guard';
import {
  listChurchCreationCodes,
  createChurchCreationCode,
} from '@/src/server/super-admin/codes';
import { getRequestIp, requireSameOrigin } from '@/src/server/security';

export async function GET(req: Request) {
  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const codes = await listChurchCreationCodes();
    const res = NextResponse.json(
      { data: codes },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    return applySuperAdminRefreshCookies(res, auth.newTokens);
  } catch (error: unknown) {
    console.error('List creation codes error:', error);
    return NextResponse.json(
      { message: 'فشل جلب رموز إنشاء الكنائس', code: 'LIST_CODES_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  let body: { note?: string; maxUses?: number; expiresInDays?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const ip = getRequestIp(req);

  try {
    const code = await createChurchCreationCode({
      note: body.note,
      maxUses: body.maxUses,
      expiresInDays: body.expiresInDays,
      ip,
    });

    const res = NextResponse.json(
      {
        success: true,
        code: code.code, // Returned only this one time
        codePrefix: code.codePrefix,
        id: code.id,
        expiresAt: code.expiresAt,
        maxUses: code.maxUses,
        note: code.note,
        message: 'تم توليد رمز إنشاء الكنيسة بنجاح. احفظ هذا الرمز الآن.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );

    return applySuperAdminRefreshCookies(res, auth.newTokens);
  } catch (error: unknown) {
    console.error('Create creation code error:', error);
    return NextResponse.json(
      { message: 'تعذر توليد رمز إنشاء الكنيسة', code: 'CREATE_CODE_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
