import { query, queryOne } from './db';

export async function syncServantFromUser(data: {
  name: string;
  phone: string;
  email?: string | null;
  role?: string;
  avatar?: string | null;
  grades?: string[];
}): Promise<void> {
  try {
    let servant = await queryOne<{ id: string }>(
      `SELECT "id" FROM "servants" WHERE "phone" = $1 OR ("email" IS NOT NULL AND "email" = $2) LIMIT 1`,
      [data.phone, data.email || null],
    );

    const arabicRole = data.role === 'admin' ? 'مشرف' : 'خادم';
    let servantId: string;

    if (servant) {
      servantId = servant.id;
      await query(
        `UPDATE "servants"
         SET "name" = $1,
             "phone" = $2,
             "email" = COALESCE($3, "email"),
             "avatar" = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE "avatar" END,
             "updatedAt" = now()
         WHERE "id" = $5`,
        [data.name, data.phone, data.email || null, data.avatar !== undefined ? data.avatar : null, servantId],
      );
    } else {
      const inserted = await queryOne<{ id: string }>(
        `INSERT INTO "servants" ("id", "name", "phone", "email", "role", "avatar", "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), now())
         RETURNING "id"`,
        [data.name, data.phone, data.email || null, arabicRole, data.avatar || null],
      );
      if (!inserted) return;
      servantId = inserted.id;
    }

    // Associate servant with classes matching the grades
    if (data.grades && data.grades.length > 0) {
      const classes = await query<{ id: string }>(
        `SELECT "id" FROM "classes" WHERE "grade" = ANY($1::classes_grade_enum[])`,
        [data.grades],
      );

      if (classes.length > 0) {
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
  } catch (err) {
    console.warn('[syncServantFromUser] Failed to sync servant:', err);
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
