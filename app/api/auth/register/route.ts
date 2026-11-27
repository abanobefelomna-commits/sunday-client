import { NextResponse } from 'next/server';
import { query, queryOne } from '@/src/server/db';
import { platformQueryOne } from '@/src/server/platform/db';
import {
  hashPassword,
  issueRefreshToken,
  normalizeEmail,
  refreshCookie,
  sessionCookie,
  signAccessToken,
  validatePasswordStrength,
} from '@/src/server/auth';
import { badRequest, conflict, serverError, getAccessContext } from '@/src/server/middleware';
import { claimClassLeadership, syncServantFromUser } from '@/src/server/servants';
import { ensureDefaultClasses } from '@/src/server/classes';
import { applyTenantCookie, withResolvedTenant } from '@/src/server/tenant/route';
import { hostIdentifiesTenant } from '@/src/server/tenant/resolve';
import {
  getRequestIp,
  rateLimit,
  rateLimitedResponse,
  requireSameOrigin,
} from '@/src/server/security';

const VALID_GRADES = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'general'];

/**
 * Member self-registration.
 *
 * Regular accounts (servant / class_leader) are created and activated immediately
 * without email verification — email verification is only used for password reset.
 *
 * Privileged roles (admin / priest) require a purpose-specific code issued for
 * the resolved church and managed by the Super Admin.
 */
export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    servantRole?: string;
    roleCode?: string;
    grades?: unknown;
    church?: string;
    churchSlug?: string;
    churchCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('بيانات التسجيل غير صالحة');
  }

  const ip = getRequestIp(req);
  const limit = rateLimit(`register:${ip}`, 5, 60 * 60);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  const requestedSlug = typeof body.church === 'string'
    ? body.church
    : typeof body.churchSlug === 'string'
      ? body.churchSlug
      : '';
  let explicitSlug = requestedSlug.trim().toLowerCase() || null;

  // Church invitation code. The code only identifies a church; it can never
  // grant a role. It is validated centrally before the tenant database is
  // touched, and the resolved slug must still match the request host.
  const rawChurchCode = typeof body.churchCode === 'string' ? body.churchCode.trim().toUpperCase() : '';
  if (rawChurchCode) {
    if (rawChurchCode.length > 64) {
      return badRequest('رمز دعوة الكنيسة غير صالح أو منتهي الصلاحية');
    }
    let codeRow: { slug: string } | null;
    try {
      codeRow = await platformQueryOne(
        `SELECT c."slug"
         FROM "church_codes" cc
         JOIN "churches" c ON c."id" = cc."churchId"
         WHERE upper(cc."code") = upper($1) AND cc."purpose" = 'join'
           AND cc."revoked" = false
           AND (cc."expiresAt" IS NULL OR cc."expiresAt" > now())
           AND c."status" = 'active'
         LIMIT 1`,
        [rawChurchCode],
      );
    } catch (error) {
      console.error(
        '[register] church code lookup failed:',
        error instanceof Error ? error.name : 'UnknownError',
      );
      return serverError('تعذر التحقق من رمز الكنيسة الآن. حاول مرة أخرى لاحقًا.');
    }
    if (!codeRow) {
      return badRequest('رمز دعوة الكنيسة غير صالح أو منتهي الصلاحية');
    }
    if (explicitSlug && explicitSlug !== codeRow.slug) {
      return badRequest('رمز الدعوة لا يخص الكنيسة المحددة');
    }
    explicitSlug = codeRow.slug;
  }

  // Open join: a servant may register through a church link or the church
  // directory (explicit slug) or the church's own host, with no code. The
  // church must still be named explicitly, so a stale cookie or the default
  // tenant never silently decides where an account lands. Open joiners get no
  // class access until an admin or class leader assigns them (see below).
  const openJoin = !rawChurchCode;
  if (openJoin && !explicitSlug) {
    let hostOk = false;
    try {
      hostOk = await hostIdentifiesTenant(req);
    } catch {
      hostOk = false;
    }
    if (!hostOk) {
      return badRequest('اختر كنيستك من قائمة الكنائس أو استخدم رابط كنيستك');
    }
  }

  return withResolvedTenant(
    req,
    explicitSlug,
    async (_req, tenant) => {
    try {
      const name = String(body.name || '').trim();
      const email = normalizeEmail(String(body.email || ''));
      const phone = String(body.phone || '').trim();
      const password = typeof body.password === 'string' ? body.password : '';
      const rawServantRole = typeof body.servantRole === 'string' ? body.servantRole.trim() : 'servant';
      const suppliedRoleCode = typeof body.roleCode === 'string' ? body.roleCode.trim() : '';
      const grades = body.grades === undefined ? [] : body.grades;

      if (!name || !email || !phone || !password) {
        return badRequest('الاسم، البريد الإلكتروني، رقم الهاتف، وكلمة المرور مطلوبة');
      }
      if (name.length > 160) return badRequest('الاسم أطول من الحد المسموح');

      const passwordError = validatePasswordStrength(password);
      if (passwordError) return badRequest(passwordError);

      // -----------------------------------------------------------------------
      // Role resolution
      // -----------------------------------------------------------------------
      // Privileged roles (admin / priest) require a valid role code.
      // All other requested roles are silently normalised to servant/class_leader.
      let accountRole: 'servant' | 'admin' | 'priest' = 'servant';
      let servantRole: string = 'servant';
      let roleCodeId: string | null = null;

      if (rawServantRole === 'priest') {
        accountRole = 'priest';
        servantRole = 'priest';
      } else if (rawServantRole === 'admin') {
        accountRole = 'admin';
        servantRole = 'admin';
      } else if (rawServantRole === 'class_leader' && !openJoin) {
        // Leading a class needs the church invitation code (or assignment by
        // an admin). An open join can only ever create a plain servant.
        servantRole = 'class_leader';
      }
      // else: servant (default)

      // Grade validation — privileged roles don't need a grade
      const isPrivileged = accountRole === 'admin' || accountRole === 'priest';
      // Open joiners never pick a class themselves; an admin or class leader
      // assigns them, so a stranger cannot read any class's children.
      const assignedGrades: string[] =
        isPrivileged || openJoin ? [] : (Array.isArray(grades) ? grades as string[] : []);

      if (isPrivileged) {
        if (!suppliedRoleCode || suppliedRoleCode.length > 64) {
          return badRequest('رمز الدور مطلوب');
        }
        const roleCode = await platformQueryOne<{ id: string }>(
          `SELECT "id"
           FROM "church_codes"
           WHERE "churchId" = $1
             AND "purpose" = $2
             AND upper("code") = upper($3)
             AND "revoked" = false
             AND ("expiresAt" IS NULL OR "expiresAt" > now())
           LIMIT 1`,
          [tenant.churchId, accountRole, suppliedRoleCode],
        );
        if (!roleCode) {
          return badRequest('رمز الدور غير صالح أو لا يخص الكنيسة المحددة');
        }
        roleCodeId = roleCode.id;
      }

      if (
        !isPrivileged && !openJoin && (
          !Array.isArray(grades) ||
          (grades as unknown[]).some((grade: unknown) => typeof grade !== 'string' || !VALID_GRADES.includes(grade))
        )
      ) {
        return badRequest('الفصل أو القسم المختار غير صالح');
      }

      // A class leader owns exactly one class. Resolve the class from the
      // selected grade before creating any account so ambiguity or an
      // occupied leadership slot cannot leave a half-provisioned user.
      let classLeaderTarget: { id: string; name: string } | null = null;
      if (servantRole === 'class_leader') {
        if (assignedGrades.length !== 1) {
          return badRequest('اختر فصلًا واحدًا لقيادته');
        }
        await ensureDefaultClasses();
        const candidates = await query<{
          id: string;
          name: string;
          leadServantId: string | null;
        }>(
          `SELECT "id", "name", "leadServantId"
           FROM "classes"
           WHERE "grade"::text = $1
           ORDER BY "createdAt" ASC, "id" ASC
           LIMIT 2`,
          [assignedGrades[0]],
        );
        if (candidates.length === 0) {
          return badRequest('لا يوجد فصل متاح لهذه المرحلة');
        }
        if (candidates.length > 1) {
          return conflict('توجد أكثر من فئة لهذه المرحلة. تواصل مع المسؤول لتعيينك قائدًا.');
        }
        if (candidates[0].leadServantId) {
          return conflict('هذا الفصل لديه قائد بالفعل');
        }
        classLeaderTarget = { id: candidates[0].id, name: candidates[0].name };
      }

      const existing = await queryOne<{ id: string }>(
        `SELECT "id" FROM "users"
         WHERE lower("email") = $1 OR "phone" = $2 LIMIT 1`,
        [email, phone],
      );

      if (existing) {
        return conflict('إذا كان لديك حساب بالفعل، يرجى تسجيل الدخول أو استعادة كلمة المرور');
      }

      const hashedPassword = await hashPassword(password);

      // Role codes are single-use: consume atomically so two requests cannot
      // both redeem the same code.
      if (roleCodeId) {
        const consumed = await platformQueryOne<{ id: string }>(
          `UPDATE "church_codes" SET "revoked" = true, "updatedAt" = now()
           WHERE "id" = $1 AND "revoked" = false
           RETURNING "id"`,
          [roleCodeId],
        );
        if (!consumed) {
          return badRequest('رمز الدور غير صالح أو تم استخدامه من قبل');
        }
      }

      // Activate immediately but keep emailVerified=false until the user proves
      // mailbox access through the password-reset code flow.
      const user = await queryOne<{
        id: string;
        name: string;
        email: string;
        phone: string;
        role: string;
        servantRole: string | null;
        grades: string[];
        avatar: string | null;
      }>(
        `INSERT INTO "users"
           ("id", "name", "email", "emailVerified", "isActive", "phone", "password", "role", "servantRole", "grades", "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, false, true, $3, $4, $5, $6, $7::users_grades_enum[], now(), now())
         RETURNING "id", "name", "email", "phone", "role", "servantRole", "grades", "avatar"`,
        [name, email, phone, hashedPassword, accountRole, servantRole, assignedGrades],
      );

      if (!user) {
        if (roleCodeId) {
          await platformQueryOne(
            `UPDATE "church_codes" SET "revoked" = false, "updatedAt" = now() WHERE "id" = $1 RETURNING "id"`,
            [roleCodeId],
          ).catch(() => null);
        }
        return serverError('فشل إنشاء الحساب');
      }

      // Sync servant record immediately so the user appears in the servants directory.
      let servantRecord: { id: string; role: string } | null = null;
      let syncFailed = false;
      try {
        servantRecord = await syncServantFromUser({
          userId: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          servantRole: user.servantRole || undefined,
          avatar: user.avatar,
          grades: user.grades,
        });
      } catch (syncErr) {
        syncFailed = true;
        console.error('[register] servant sync error:', syncErr);
      }

      const rollbackRegistration = async () => {
        try {
          await query(
            `DELETE FROM "servants_classes"
             WHERE "servantsId" IN (SELECT "id" FROM "servants" WHERE "userId" = $1)`,
            [user.id],
          );
          await query(`DELETE FROM "servants" WHERE "userId" = $1`, [user.id]);
          await query(`DELETE FROM "users" WHERE "id" = $1`, [user.id]);
        } catch (rollbackError) {
          console.error('[register] rollback error:', rollbackError);
        }
      };

      if (classLeaderTarget) {
        if (syncFailed || !servantRecord) {
          await rollbackRegistration();
          return serverError('تعذر استكمال تسجيل قائد الفصل. حاول مرة أخرى.');
        }
        const claimed = await claimClassLeadership(servantRecord.id, classLeaderTarget.id);
        if (!claimed) {
          await rollbackRegistration();
          return conflict('تم تعيين قائد لهذا الفصل بالفعل');
        }
      }

      // Issue tokens and log the user in immediately.
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

      const res = NextResponse.json({
        accessToken,
        requiresEmailVerification: false,
        email: user.email,
        message: 'تم إنشاء الحساب بنجاح وتسجيل الدخول.',
        user: {
          ...user,
          servantRole: access.servantRole,
          servantId: access.servantId,
          classIds: access.classIds,
          ledClassIds: access.ledClassIds ?? [],
          permissions: access.permissions,
        },
        church: { id: tenant.churchId, slug: tenant.slug, name: tenant.name },
        pendingAssignment: !isPrivileged && access.classIds.length === 0,
      });

      const [refreshName, refreshVal, refreshOpts] = refreshCookie(refreshToken.token, refreshToken.expiresAt);
      res.cookies.set(refreshName, refreshVal, refreshOpts);

      const [sessionName, sessionValue, sessionOptions] = sessionCookie(refreshToken.expiresAt);
      res.cookies.set(sessionName, sessionValue, sessionOptions);

      return applyTenantCookie(res, tenant.slug);
    } catch (error: unknown) {
      console.error('Registration error:', error);
      return serverError('حدث خطأ أثناء إنشاء الحساب');
    }
    },
    { ignoreCookie: Boolean(rawChurchCode) },
  );
}
