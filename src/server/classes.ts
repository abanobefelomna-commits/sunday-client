import { query } from './db';

export async function ensureGeneralClass(): Promise<void> {
  await query(`
    INSERT INTO "classes" ("id", "name", "grade", "academicYear", "createdAt", "updatedAt")
    SELECT uuid_generate_v4(), 'فقرة عامة', 'general', 'عام', now(), now()
    WHERE NOT EXISTS (
      SELECT 1 FROM "classes" WHERE "grade"::text = 'general'
    )
  `);
}
