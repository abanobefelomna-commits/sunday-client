import { query, queryOne } from './db';
import { ensureDefaultClasses } from './classes';

export async function syncServantFromUser(data: {
  name: string;
  phone: string;
  email?: string | null;
  role?: string;
  servantRole?: string;
  avatar?: string | null;
  grades?: string[];
}): Promise<void> {
  const servant = await queryOne<{ id: string; role: string }>(
    `SELECT "id", "role" FROM "servants" WHERE "phone" = $1 OR ("email" IS NOT NULL AND "email" = $2) LIMIT 1`,
    [data.phone, data.email || null],
  );

  const roleLabels: Record<string, string> = {
    servant: data.grades?.includes('general') ? 'خادم فقرة عامة' : 'خادم',
    class_leader: 'قائد فصل',
    admin: 'مسؤول',
    priest: 'أب كاهن',
  };
  const arabicRole = data.servantRole
    ? roleLabels[data.servantRole]
    : data.role === 'admin'
      ? 'مشرف'
      : 'خادم';
  const updatedRole =
    data.servantRole ||
    (servant?.role === 'خادم' || servant?.role === 'خادم فقرة عامة'
      ? roleLabels.servant
      : null);
  let servantId: string;

  if (servant) {
    servantId = servant.id;
    await query(
      `UPDATE "servants"
       SET "name" = $1,
           "phone" = $2,
           "email" = COALESCE($3, "email"),
           "role" = COALESCE($4, "role"),
           "avatar" = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE "avatar" END,
           "updatedAt" = now()
       WHERE "id" = $6`,
      [
        data.name,
        data.phone,
        data.email || null,
        updatedRole ? (data.grades?.includes('general') && updatedRole === 'خادم' ? 'خادم فقرة عامة' : updatedRole) : null,
        data.avatar !== undefined ? data.avatar : null,
        servantId,
      ],
    );
  } else {
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO "servants" ("id", "name", "phone", "email", "role", "avatar", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), now())
       RETURNING "id"`,
      [data.name, data.phone, data.email || null, arabicRole, data.avatar || null],
    );
    if (!inserted) throw new Error('Failed to create servant record');
    servantId = inserted.id;
  }

  const assignedGrades =
    ['admin', 'priest'].includes(data.servantRole || data.role || '') ||
    (!data.servantRole && ['مسؤول', 'أب كاهن'].includes(servant?.role || ''))
    ? []
    : data.grades || [];
  if (assignedGrades.length > 0) {
    await ensureDefaultClasses();
  }

  await query(`DELETE FROM "servants_classes" WHERE "servantsId" = $1`, [servantId]);

  if (assignedGrades.length > 0) {
    const classes = await query<{ id: string }>(
      `SELECT DISTINCT ON ("grade"::text) "id"
       FROM "classes"
       WHERE "grade" = ANY($1::classes_grade_enum[])
       ORDER BY "grade"::text, "createdAt" ASC, "id" ASC`,
      [assignedGrades],
    );

    for (const cls of classes) {
      await query(
        `INSERT INTO "servants_classes" ("servantsId", "classesId")
         VALUES ($1, $2)
         ON CONFLICT ("servantsId", "classesId") DO NOTHING`,
        [servantId, cls.id],
      );
    }
  }
}

export async function syncServantAvatarByPhone(phone: string, avatar: string | null): Promise<void> {
  try {
    await query(
      `UPDATE "servants" SET "avatar" = $1, "updatedAt" = now() WHERE "phone" = $2`,
      [avatar, phone],
    );
  } catch (err) {
    console.warn('[syncServantAvatarByPhone] Failed to sync avatar:', err);
  }
}
