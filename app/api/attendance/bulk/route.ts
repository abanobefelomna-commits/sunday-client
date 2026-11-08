import { query, queryOne, transaction } from '@/src/server/db';
import {
  getAuthUser,
  getAccessContext,
  canWriteClass,
  jsonResponse,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
} from '@/src/server/middleware';
import { recordAudit, requestIp } from '@/src/server/audit';
import {
  ATTENDANCE_STATUSES,
  isIsoDate,
  isUuid,
  oneOf,
  optionalText,
  todayIso,
} from '@/src/server/validation';
import { notifyAttendanceAlert } from '@/src/server/notifications';

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const { classId, date, records, notes } = body ?? {};

    if (!isUuid(classId)) return badRequest('معرّف الفصل غير صالح');
    if (!isIsoDate(date)) return badRequest('التاريخ غير صالح');
    if (date > todayIso()) return badRequest('لا يمكن تسجيل حضور بتاريخ مستقبلي');
    if (!Array.isArray(records) || records.length === 0) {
      return badRequest('سجلات الحضور مطلوبة');
    }
    if (records.length > 500) return badRequest('الحد الأقصى 500 سجل في المرة الواحدة');

    const access = await getAccessContext(auth);
    if (!canWriteClass(access, classId)) return forbidden();

    const childIds: string[] = [];
    const statuses: string[] = [];
    const recordNotes: (string | null)[] = [];
    const seen = new Set<string>();

    for (const record of records) {
      const childId = record?.childId;
      const status = oneOf(record?.status, ATTENDANCE_STATUSES);
      if (!isUuid(childId)) return badRequest('معرّف طفل غير صالح داخل السجلات');
      if (!status) return badRequest('حالة حضور غير صالحة');
      if (seen.has(childId)) return badRequest('لا يمكن تكرار نفس الطفل في نفس الطلب');
      seen.add(childId);
      childIds.push(childId);
      statuses.push(status);
      recordNotes.push(optionalText(record?.notes, 300));
    }

    const children = await query<{ id: string; name: string }>(
      `SELECT "id", "name" FROM "children"
       WHERE "id" = ANY($1::uuid[]) AND "classId" = $2 AND "deletedAt" IS NULL`,
      [childIds, classId],
    );
    if (children.length !== childIds.length) {
      return badRequest('بعض الأطفال غير مسجلين في هذا الفصل');
    }
    const childNames = new Map(children.map((child) => [child.id, child.name]));

    // Both statements run in one Neon HTTP transaction. The second statement
    // reads the session row created/updated by the first one atomically.
    const [, attendanceResult] = await transaction<{ id: string }>([
      {
        text: `INSERT INTO "attendance_sessions" ("classId", "date", "notes", "createdBy", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, now(), now())
               ON CONFLICT ("classId", "date") DO UPDATE
                 SET "notes" = COALESCE(EXCLUDED."notes", "attendance_sessions"."notes"),
                     "updatedAt" = now()
               RETURNING "id"`,
        params: [classId, date, optionalText(notes, 500), auth.sub],
      },
      {
        text: `INSERT INTO "attendance"
                 ("id", "childId", "classId", "date", "status", "notes", "recordedBy",
                  "sessionId", "updatedBy", "createdAt", "updatedAt")
               SELECT uuid_generate_v4(), u."childId", $1::uuid, $2::date,
                      u."status"::attendance_status_enum, u."notes", $3::uuid,
                      s."id", $3::uuid, now(), now()
               FROM unnest($4::uuid[], $5::text[], $6::text[]) AS u("childId", "status", "notes")
               CROSS JOIN (
                 SELECT "id" FROM "attendance_sessions"
                 WHERE "classId" = $1::uuid AND "date" = $2::date
               ) s
               ON CONFLICT ("childId", "classId", "date") DO UPDATE
                 SET "status" = EXCLUDED."status",
                     "notes" = EXCLUDED."notes",
                     "recordedBy" = COALESCE(EXCLUDED."recordedBy", "attendance"."recordedBy"),
                     "sessionId" = EXCLUDED."sessionId",
                     "updatedBy" = EXCLUDED."updatedBy",
                     "updatedAt" = now()
               RETURNING "id"`,
        params: [classId, date, auth.sub, childIds, statuses, recordNotes],
      },
    ]);

    const session = await queryOne<{ id: string }>(
      `SELECT "id" FROM "attendance_sessions" WHERE "classId" = $1 AND "date" = $2 LIMIT 1`,
      [classId, date],
    );
    const sessionId = session?.id ?? null;

    await recordAudit({
      actorId: access.userId,
      action: 'attendance.bulk_upsert',
      entityType: 'attendance_session',
      entityId: sessionId,
      after: {
        classId,
        date,
        count: (attendanceResult ?? []).length,
        distribution: statuses.reduce<Record<string, number>>((acc, status) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
      },
      ip: requestIp(req),
    });

    // Attendance alerts are evaluated from recorded data only.
    const absentIds = childIds.filter((_, index) => statuses[index] === 'absent');
    let alerts = 0;
    if (absentIds.length > 0) {
      const rule = await queryOne<{ threshold: number; windowDays: number }>(
        `SELECT "threshold", "windowDays" FROM "follow_up_rules"
         WHERE "ruleType" = 'repeated_absence' AND "isActive" = true
         ORDER BY "createdAt" ASC LIMIT 1`,
      );
      if (rule) {
        const counts = await query<{ childId: string; absences: number }>(
          `SELECT "childId", COUNT(*)::int AS absences
           FROM "attendance"
           WHERE "childId" = ANY($1::uuid[])
             AND "status"::text = 'absent'
             AND "date" >= ($2::date - (($3::int - 1) || ' days')::interval)
             AND "date" <= $2::date
           GROUP BY "childId"`,
          [absentIds, date, rule.windowDays],
        );
        for (const row of counts) {
          if (row.absences >= rule.threshold) {
            alerts += await notifyAttendanceAlert({
              classId,
              childId: row.childId,
              childName: childNames.get(row.childId) || 'طفل',
              date,
              absences: row.absences,
              threshold: rule.threshold,
            });
          }
        }
      }
    }

    return jsonResponse({
      count: statuses.length,
      message: `تم تسجيل حضور ${statuses.length} طفل بنجاح`,
      date,
      classId,
      sessionId,
      alerts,
    });
  } catch (error: unknown) {
    console.error('Bulk attendance error:', error);
    return serverError(error instanceof Error ? error.message : 'فشل تسجيل الحضور');
  }
}
