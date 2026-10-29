import { query } from './db';

export const DEFAULT_CLASSES = [
  { grade: 'first', name: 'سنة أولى ابتدائي' },
  { grade: 'second', name: 'سنة ثانية ابتدائي' },
  { grade: 'third', name: 'سنة ثالثة ابتدائي' },
  { grade: 'fourth', name: 'سنة رابعة ابتدائي' },
  { grade: 'fifth', name: 'سنة خامسة ابتدائي' },
  { grade: 'sixth', name: 'سنة سادسة ابتدائي' },
  { grade: 'general', name: 'الفقرة العامة' },
] as const;

export async function ensureDefaultClasses(): Promise<void> {
  const names = DEFAULT_CLASSES.map((item) => item.name);
  const grades = DEFAULT_CLASSES.map((item) => item.grade);

  await query(
    `INSERT INTO "classes" ("id", "name", "grade", "academicYear", "createdAt", "updatedAt")
     SELECT uuid_generate_v4(), defaults.name, defaults.grade::classes_grade_enum, 'عام', now(), now()
     FROM unnest($1::text[], $2::text[]) AS defaults(name, grade)
     WHERE NOT EXISTS (
       SELECT 1 FROM "classes" existing WHERE existing."grade"::text = defaults.grade
     )`,
    [names, grades],
  );

  await query(
    `UPDATE "classes" AS existing
     SET "name" = defaults.name, "updatedAt" = now()
     FROM unnest($1::text[], $2::text[]) AS defaults(name, grade)
     WHERE existing."grade"::text = defaults.grade
       AND existing."name" IS DISTINCT FROM defaults.name`,
    [names, grades],
  );
}
