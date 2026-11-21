import { NextResponse } from 'next/server';
import { requireSuperAdmin, applySuperAdminRefreshCookies } from '@/src/server/super-admin/guard';
import {
  revokeChurchCreationCode,
  rotateChurchCreationCode,
} from '@/src/server/super-admin/codes';
import { getRequestIp, requireSameOrigin } from '@/src/server/security';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const ip = getRequestIp(req);

  try {
    const success = await revokeChurchCreationCode(id, ip);
    if (!success) {
      return NextResponse.json(
        { message: 'الرمز غير موجود أو ملغي مسبقاً', code: 'CODE_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const res = NextResponse.json(
      { success: true, message: 'تم إلغاء رمز إنشاء الكنيسة بنجاح.' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    return applySuperAdminRefreshCookies(res, auth.newTokens);
  } catch (error: unknown) {
    console.error('Revoke creation code error:', error);
    return NextResponse.json(
      { message: 'تعذر إلغاء رمز إنشاء الكنيسة', code: 'REVOKE_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { errorResponse, auth } = await requireSuperAdmin(req);
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const ip = getRequestIp(req);

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    if (body.action === 'rotate') {
      const newCode = await rotateChurchCreationCode(id, ip);
      if (!newCode) {
        return NextResponse.json(
          { message: 'الرمز المراد تدويره غير موجود', code: 'CODE_NOT_FOUND' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const res = NextResponse.json(
        {
          success: true,
          code: newCode.code,
          codePrefix: newCode.codePrefix,
          id: newCode.id,
          expiresAt: newCode.expiresAt,
          maxUses: newCode.maxUses,
          note: newCode.note,
          message: 'تم تدوير رمز إنشاء الكنيسة بنجاح وإلغاء الرمز السابق.',
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
      return applySuperAdminRefreshCookies(res, auth.newTokens);
    }

    // Default patch action is revoke
    const success = await revokeChurchCreationCode(id, ip);
    const res = NextResponse.json(
      { success, message: success ? 'تم إلغاء الرمز بنجاح.' : 'الرمز غير موجود.' },
      { status: success ? 200 : 404, headers: { 'Cache-Control': 'no-store' } },
    );
    return applySuperAdminRefreshCookies(res, auth.newTokens);
  } catch (error: unknown) {
    console.error('Update creation code error:', error);
    return NextResponse.json(
      { message: 'تعذر تعديل رمز إنشاء الكنيسة', code: 'UPDATE_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
