import { withTenant } from '@/src/server/tenant/route';
import { requireTenantContext } from '@/src/server/tenant/context';
import { getAuthUser, getAccessContext, jsonResponse, forbidden, unauthorized, serverError, notFound } from '@/src/server/middleware';
import { platformQueryOne, platformTransaction } from '@/src/server/platform/db';
import { generateChurchCode } from '@/src/server/platform/churches';
import { getDb } from '@/src/server/db';
import { notifyChurchCodeRecipients } from '@/src/server/church-code-notifications';

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    if (!access.privileged) {
      return forbidden('إدارة رمز الكنيسة متاحة للمسؤول والكاهن فقط');
    }

    const { churchId, name } = requireTenantContext();
    const row = await platformQueryOne<{
      code: string;
      revoked: boolean;
      expiresAt: string | null;
      createdAt: Date;
    }>(
      `SELECT "code", "revoked", "expiresAt", "createdAt"
       FROM "church_codes"
       WHERE "churchId" = $1 AND "purpose" = 'join' AND "revoked" = false
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [churchId],
    );

    if (!row) {
      return jsonResponse({
        churchId,
        churchName: name,
        code: null,
        message: 'لا يوجد رمز فعّال لهذه الكنيسة.',
      });
    }

    return jsonResponse({
      churchId,
      churchName: name,
      code: row.code,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    });
  } catch (error: unknown) {
    console.error('Get church code error:', error);
    return serverError('فشل جلب رمز الكنيسة');
  }
}

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const access = await getAccessContext(auth);
    if (!access.privileged) {
      return forbidden('إدارة رمز الكنيسة متاحة للمسؤول والكاهن فقط');
    }

    const { churchId, name } = requireTenantContext();
    const existing = await platformQueryOne<{ id: string }>(
      `SELECT "id" FROM "churches" WHERE "id" = $1 AND "status" = 'active' LIMIT 1`,
      [churchId],
    );
    if (!existing) return notFound('الكنيسة غير موجودة');

    const newCode = generateChurchCode();
    await platformTransaction([
      {
        text: `UPDATE "church_codes"
               SET "revoked" = true, "updatedAt" = now()
               WHERE "churchId" = $1 AND "purpose" = 'join' AND "revoked" = false`,
        params: [churchId],
      },
      {
        text: `INSERT INTO "church_codes"
                 ("id", "churchId", "code", "purpose", "revoked", "createdAt", "updatedAt")
               VALUES (uuid_generate_v4(), $1, $2, 'join', false, now(), now())`,
        params: [churchId, newCode],
      },
    ]);

    // Notify privileged users so the renewed code reaches everyone who may
    // invite servants. A notification failure must not undo the rotation.
    try {
      await notifyChurchCodeRecipients(getDb(), {
        code: newCode,
        churchName: name,
        churchId,
      });
    } catch (notifyError) {
      console.error('Church code notification failed after rotation:', notifyError);
    }

    return jsonResponse({
      churchId,
      churchName: name,
      code: newCode,
      message: 'تم إنشاء رمز دعوة جديد. الرمز القديم أصبح غير صالح.',
    });
  } catch (error: unknown) {
    console.error('Regenerate church code error:', error);
    return serverError('تعذر تجديد رمز الكنيسة');
  }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);
