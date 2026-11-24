import { NextResponse } from 'next/server';
import { requireSuperAdmin, applySuperAdminRefreshCookies } from '@/src/server/super-admin/guard';
import {
  type ChurchCodePurpose,
  revokeChurchJoinCode,
  rotateChurchJoinCode,
} from '@/src/server/super-admin/church-join-codes';
import { getRequestIp, requireSameOrigin } from '@/src/server/security';

type RouteContext = { params: Promise<{ churchId: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PURPOSES = new Set<ChurchCodePurpose>(['join', 'admin', 'priest']);

function isChurchCodePurpose(value: unknown): value is ChurchCodePurpose {
  return typeof value === 'string' && CODE_PURPOSES.has(value as ChurchCodePurpose);
}

export async function PATCH(req: Request, context: RouteContext) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const { churchId } = await context.params;
  if (!UUID_PATTERN.test(churchId)) {
    return NextResponse.json(
      { message: 'معرّف الكنيسة غير صالح', code: 'INVALID_CHURCH_ID' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { message: 'بيانات الطلب غير صالحة', code: 'INVALID_REQUEST' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json(
      { message: 'بيانات الطلب غير صالحة', code: 'INVALID_REQUEST' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const body = payload as { action?: unknown; purpose?: unknown };
  if (body.action !== 'rotate' || (body.purpose !== undefined && !isChurchCodePurpose(body.purpose))) {
    return NextResponse.json(
      { message: 'الإجراء غير صالح', code: 'INVALID_ACTION' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const purpose = isChurchCodePurpose(body.purpose) ? body.purpose : 'join';

  try {
    const code = await rotateChurchJoinCode(churchId, getRequestIp(req), purpose);
    if (!code) {
      return NextResponse.json(
        { message: 'الكنيسة غير موجودة أو مؤرشفة', code: 'CHURCH_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return applySuperAdminRefreshCookies(
      NextResponse.json({ success: true, code }, { headers: { 'Cache-Control': 'no-store' } }),
      auth.newTokens,
    );
  } catch (error: unknown) {
    console.error('Rotate church code failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { message: 'تعذر تدوير الرمز', code: 'ROTATE_CHURCH_CODE_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const { churchId } = await context.params;
  if (!UUID_PATTERN.test(churchId)) {
    return NextResponse.json(
      { message: 'معرّف الكنيسة غير صالح', code: 'INVALID_CHURCH_ID' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const rawPurpose = new URL(req.url).searchParams.get('purpose');
    if (rawPurpose !== null && !isChurchCodePurpose(rawPurpose)) {
      return NextResponse.json(
        { message: 'نوع الرمز غير صالح', code: 'INVALID_CODE_PURPOSE' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const purpose = isChurchCodePurpose(rawPurpose) ? rawPurpose : 'join';
    const revoked = await revokeChurchJoinCode(churchId, getRequestIp(req), purpose);
    if (!revoked) {
      return NextResponse.json(
        { message: 'لا يوجد رمز فعّال من هذا النوع لهذه الكنيسة', code: 'CHURCH_CODE_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return applySuperAdminRefreshCookies(
      NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } }),
      auth.newTokens,
    );
  } catch (error: unknown) {
    console.error('Revoke church join code failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { message: 'تعذر إلغاء الرمز', code: 'REVOKE_CHURCH_CODE_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
