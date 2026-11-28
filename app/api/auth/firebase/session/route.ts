import { NextResponse } from 'next/server';
import { query, queryOne } from '@/src/server/db';
import {
  issueRefreshToken,
  normalizeEmail,
  refreshCookie,
  sessionCookie,
  signAccessToken,
} from '@/src/server/auth';
import {
  badRequest,
  getAccessContext,
  serverError,
  unauthorized,
} from '@/src/server/middleware';
import { applyTenantCookie, withResolvedTenant } from '@/src/server/tenant/route';
import { resolveJoinCode } from '@/src/server/church-join-code';
import {
  getRequestIp,
  rateLimit,
  rateLimitedResponse,
  requireSameOrigin,
} from '@/src/server/security';
import { verifyFirebaseIdToken } from '@/src/server/firebase/verify';
import { findFirebaseUserId, linkFirebaseUser } from '@/src/server/firebase/identities';

/**
 * Exchange a Firebase ID token for the application's own session.
 *
 * Firebase Authentication proves who the user is (email/password). This route
 * verifies that token on the server, resolves the matching tenant user, and
 * mints the same signed access token + rotating refresh cookie the existing
 * login route issues. Every other API route therefore keeps working unchanged.
 *
 * A Firebase account is linked to a tenant user by:
 *   1. the stored identity document (`authIdentities/{churchId}__{uid}`), or
 *   2. a verified email match (only when Firebase reports email_verified).
 *
 * Unverified emails are never used for linking, so an attacker cannot claim an
 * existing account by registering its address in Firebase.
 */
export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  let body: {
    idToken?: string;
    church?: string;
    churchSlug?: string;
    churchCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('بيانات الدخول غير صالحة');
  }

  const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : '';
  if (!idToken) return badRequest('رمز Firebase مطلوب');

  let explicitSlug = (body.church || body.churchSlug || '').trim().toLowerCase() || null;
  const rawChurchCode = typeof body.churchCode === 'string' ? body.churchCode.trim() : '';

  if (rawChurchCode) {
    const resolved = await resolveJoinCode(rawChurchCode);
    if (!resolved.ok) {
      return resolved.reason === 'unavailable'
        ? serverError('تعذر التحقق من رمز الكنيسة الآن. حاول مرة أخرى لاحقًا.')
        : badRequest('رمز الكنيسة غير صالح أو منتهي الصلاحية');
    }
    if (explicitSlug && explicitSlug !== resolved.slug) {
      return badRequest('رمز الكنيسة لا يخص الكنيسة المحددة');
    }
    explicitSlug = resolved.slug;
  }

  const ip = getRequestIp(req);
  const limit = rateLimit(`firebase-session:${ip}`, 20, 15 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  let firebaseUser: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;
  try {
    firebaseUser = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    console.warn(
      '[firebase-session] token verification failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return unauthorized('انتهت صلاحية جلسة Firebase. سجّل الدخول مرة أخرى.');
  }

  return withResolvedTenant(
    req,
    explicitSlug,
    async (_req, tenant) => {
      try {
        const columns = `"id", "name", "email", "phone", "role", "grades", "avatar", "isActive", "emailVerified"`;
        type LocalUser = {
          id: string;
          name: string;
          email: string;
          phone: string;
          role: string;
          grades: string[];
          avatar: string | null;
          isActive: boolean;
          emailVerified: boolean;
        };

        const linkedUserId = await findFirebaseUserId(firebaseUser.uid);

        let user: LocalUser | null = null;

        if (linkedUserId) {
          user = await queryOne<LocalUser>(
            `SELECT ${columns} FROM "users" WHERE "id" = $1 LIMIT 1`,
            [linkedUserId],
          );
          if (!user) {
            return unauthorized('هذا الحساب لم يعد موجودًا. تواصل مع مسؤول الكنيسة.');
          }
        } else if (firebaseUser.email && firebaseUser.emailVerified) {
          user = await queryOne<LocalUser>(
            `SELECT ${columns} FROM "users" WHERE lower("email") = $1 LIMIT 1`,
            [normalizeEmail(firebaseUser.email)],
          );
        }

        if (!user) {
          return unauthorized(
            'لا يوجد حساب مطابق في هذه الكنيسة. أكمل التسجيل أولًا أو تواصل مع مسؤول الكنيسة.',
          );
        }

        if (!user.isActive) {
          return unauthorized('بيانات الدخول غير صحيحة');
        }

        const payload = {
          sub: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          tid: tenant.churchId,
        };

        const access = await getAccessContext(payload);
        const accessToken = await signAccessToken(payload);
        const refreshToken = await issueRefreshToken(user.id);

        // First sign-in through a verified email match: remember the link in
        // the tenant database so later sign-ins resolve the user directly.
        // Email verification state comes from the verified ID token only.
        try {
          if (!linkedUserId) await linkFirebaseUser(user.id, firebaseUser.uid);
          if (firebaseUser.emailVerified && !user.emailVerified) {
            await query(
              `UPDATE "users" SET "emailVerified" = true, "updatedAt" = now() WHERE "id" = $1`,
              [user.id],
            );
          }
        } catch (error) {
          console.warn(
            '[firebase-session] identity link skipped:',
            error instanceof Error ? error.message : 'UnknownError',
          );
        }

        const res = NextResponse.json({
          accessToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            grades: user.grades,
            avatar: user.avatar,
            emailVerified: user.emailVerified || firebaseUser.emailVerified,
            servantRole: access.servantRole,
            servantId: access.servantId,
            classIds: access.classIds,
            ledClassIds: access.ledClassIds ?? [],
            permissions: access.permissions,
          },
          church: { id: tenant.churchId, slug: tenant.slug, name: tenant.name },
        });

        const [refreshName, refreshVal, refreshOpts] = refreshCookie(
          refreshToken.token,
          refreshToken.expiresAt,
        );
        res.cookies.set(refreshName, refreshVal, refreshOpts);

        const [sessionName, sessionValue, sessionOptions] = sessionCookie(
          refreshToken.expiresAt,
        );
        res.cookies.set(sessionName, sessionValue, sessionOptions);

        return applyTenantCookie(res, tenant.slug);
      } catch (error) {
        console.error('[firebase-session] error:', error);
        return serverError('حدث خطأ أثناء تسجيل الدخول');
      }
    },
    { ignoreCookie: Boolean(rawChurchCode) },
  );
}
