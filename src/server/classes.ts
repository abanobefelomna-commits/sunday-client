import { query, queryOne } from './db';
import { requireTenantContext } from './tenant/context';
import { DEFAULT_CLASSES } from './class-defaults';

export { DEFAULT_CLASSES } from './class-defaults';

export async function ensureDefaultClasses(): Promise<void> {
  const { churchId } = requireTenantContext();
  const names = DEFAULT_CLASSES.map((item) => item.name);
  const grades = DEFAULT_CLASSES.map((item) => item.grade);
  const sortOrders = DEFAULT_CLASSES.map((item) => item.sortOrder);

  await query(
    `UPDATE "classes" SET "churchId" = $1
     WHERE "churchId" IS NULL`,
    [churchId],
  );
  await query(
    `INSERT INTO "classes"
       ("id", "churchId", "name", "nameKey", "grade", "academicYear", "isActive", "sortOrder", "createdAt", "updatedAt")
     SELECT uuid_generate_v4(), $1, defaults.name, lower(trim(defaults.name)),
            defaults.grade, 'عام', true, defaults.sortOrder, now(), now()
     FROM unnest($2::text[], $3::text[], $4::integer[]) AS defaults(name, grade, sortOrder)
     WHERE NOT EXISTS (
       SELECT 1 FROM "classes" existing
       WHERE existing."churchId" = $1 AND existing."grade"::text = defaults.grade
     )
     ON CONFLICT DO NOTHING`,
    [churchId, names, grades, sortOrders],
  );
}

export async function restoreDefaultClasses(): Promise<void> {
  const { churchId } = requireTenantContext();
  const grades = DEFAULT_CLASSES.map((item) => item.grade);
  const names = DEFAULT_CLASSES.map((item) => item.name);
  const duplicateGrades = await queryOne<{ grade: string }>(
    `SELECT "grade"::text AS "grade"
     FROM "classes"
     WHERE "churchId" = $1 AND "deletedAt" IS NULL AND "grade"::text = ANY($2::text[])
     GROUP BY "grade" HAVING COUNT(*) > 1
     LIMIT 1`,
    [churchId, grades],
  );
  if (duplicateGrades) {
    throw Object.assign(new Error('Resolve duplicate default class records before restoring defaults'), {
      code: 'CLASS_DEFAULTS_CONFLICT',
    });
  }
  const nameConflict = await queryOne<{ id: string }>(
    `SELECT "id" FROM "classes"
     WHERE "churchId" = $1 AND "deletedAt" IS NULL
       AND lower(trim("name")) = ANY($2::text[])
       AND NOT ("grade"::text = ANY($3::text[]))
     LIMIT 1`,
    [churchId, names.map((name) => name.toLowerCase()), grades],
  );
  if (nameConflict) {
    throw Object.assign(new Error('A custom class is using one of the default names'), {
      code: 'CLASS_DEFAULTS_CONFLICT',
    });
  }
  await ensureDefaultClasses();
  await query(
    `UPDATE "classes" AS c
     SET "name" = defaults.name,
         "nameKey" = lower(trim(defaults.name)),
         "description" = NULL,
         "isActive" = true,
         "sortOrder" = defaults.sortOrder,
         "updatedAt" = now()
     FROM unnest($2::text[], $3::text[], $4::integer[]) AS defaults(name, grade, sortOrder)
     WHERE c."churchId" = $1 AND c."grade"::text = defaults.grade`,
    [
      churchId,
      DEFAULT_CLASSES.map((item) => item.name),
      grades,
      DEFAULT_CLASSES.map((item) => item.sortOrder),
    ],
  );
}
