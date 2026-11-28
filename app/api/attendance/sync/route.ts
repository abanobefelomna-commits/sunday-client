import { withTenant } from '@/src/server/tenant/route';
import { query, queryOne, transaction } from '@/src/server/db';
import { requireTenantContext } from '@/src/server/tenant/context';
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
import { notifyAttendanceAlert } from '@/src/server/notifications';
import { todayIso } from '@/src/server/validation';
import {
  prepareBatchOperations,
  validateSyncOperation,
  type RawSyncOperation,
  type SyncOperationResult,
  type ValidatedSyncOperation,
} from '@/src/server/attendance-sync';

const ENSURED_TENANTS = new Set<string>();

async function ensureSyncTable(churchId: string): Promise<void> {
  if (ENSURED_TENANTS.has(churchId)) return;
  await query(`
    CREATE TABLE IF NOT EXISTS "attendance_sync_operations" (
      "operationId" uuid PRIMARY KEY,
      "churchId" uuid NOT NULL,
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "classId" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
      "childId" uuid NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
      "date" date NOT NULL,
      "status" "attendance_status_enum" NOT NULL,
      "processedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  ENSURED_TENANTS.add(churchId);
}

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    let body: { operations?: RawSyncOperation[] } | null = null;
    try {
      body = (await req.json()) as { operations?: RawSyncOperation[] };
    } catch {
      return badRequest('بيانات المزامنة غير صالحة');
    }

    const rawOps = body?.operations;
    if (!Array.isArray(rawOps) || rawOps.length === 0) {
      return badRequest('قائمة عمليات الحضور مطلوبة');
    }
    if (rawOps.length > 500) {
      return badRequest('الحد الأقصى 500 عملية في الطلب الواحد');
    }

    const maxDate = todayIso();
    const resultsMap = new Map<string, SyncOperationResult>();
    const validOps: ValidatedSyncOperation[] = [];
    const invalidErrors: Array<{ operationId: string; code: string; message: string }> = [];

    for (let i = 0; i < rawOps.length; i++) {
      const check = validateSyncOperation(rawOps[i], i, maxDate);
      if (check.ok) {
        validOps.push(check.op);
      } else {
        invalidErrors.push(check);
        resultsMap.set(check.operationId, {
          operationId: check.operationId,
          outcome: 'rejected',
          retryable: false,
          code: check.code,
          message: check.message,
        });
      }
    }

    if (validOps.length === 0) {
      return badRequest(invalidErrors[0]?.message || 'بيانات المزامنة غير صالحة');
    }

    const tenant = requireTenantContext();
    const access = await getAccessContext(auth);

    // 1. Independently verify class write authorization on the server.
    const authorizedOps: ValidatedSyncOperation[] = [];
    let forbiddenCount = 0;

    for (const op of validOps) {
      if (!canWriteClass(access, op.classId)) {
        forbiddenCount += 1;
        resultsMap.set(op.operationId, {
          operationId: op.operationId,
          outcome: 'rejected',
          retryable: false,
          code: 'FORBIDDEN',
          message: 'مش مسموح لك بتسجيل الحضور لهذا الفصل',
        });
      } else {
        authorizedOps.push(op);
      }
    }

    if (authorizedOps.length === 0 && forbiddenCount > 0) {
      return forbidden();
    }

    const { unique, inBatchDuplicates } = prepareBatchOperations(authorizedOps);
    for (const dupId of inBatchDuplicates) {
      resultsMap.set(dupId, { operationId: dupId, outcome: 'duplicate' });
    }

    if (unique.length === 0) {
      const results = Array.from(resultsMap.values());
      return jsonResponse({
        results,
        applied: 0,
        duplicates: inBatchDuplicates.length,
        rejected: invalidErrors.length + forbiddenCount,
        alerts: 0,
      });
    }

    // 2. Verify every child exists, is active (not soft-deleted), and belongs to the target classId.
    const childIds = [...new Set(unique.map((op) => op.childId))];
    const children = await query<{ id: string; name: string; classId: string | null }>(
      `SELECT "id", "name", "classId" FROM "children"
       WHERE "id" = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
      [childIds],
    );
    const childById = new Map(children.map((c) => [c.id, c]));

    const eligibleOps: ValidatedSyncOperation[] = [];
    for (const op of unique) {
      const child = childById.get(op.childId);
      if (!child || child.classId !== op.classId) {
        resultsMap.set(op.operationId, {
          operationId: op.operationId,
          outcome: 'rejected',
          retryable: false,
          code: 'CHILD_NOT_IN_CLASS',
          message: 'الطفل غير مسجل في هذا الفصل',
        });
      } else {
        eligibleOps.push(op);
      }
    }

    if (eligibleOps.length === 0) {
      const results = Array.from(resultsMap.values());
      return jsonResponse({
        results,
        applied: results.filter((r) => r.outcome === 'applied').length,
        duplicates: results.filter((r) => r.outcome === 'duplicate').length,
        rejected: results.filter((r) => r.outcome === 'rejected').length,
        alerts: 0,
      });
    }

    // 3. Check idempotency table for previously processed operationIds.
    const opIds = eligibleOps.map((op) => op.operationId);
    let existingOps: Array<{
      operationId: string;
      churchId: string;
      classId: string;
      childId: string;
      date: string;
    }> = [];

    try {
      existingOps = await query<{
        operationId: string;
        churchId: string;
        classId: string;
        childId: string;
        date: string;
      }>(
        `SELECT "operationId", "churchId", "classId", "childId", "date"::text AS "date"
         FROM "attendance_sync_operations"
         WHERE "operationId" = ANY($1::uuid[])`,
        [opIds],
      );
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      if (code === '42P01') {
        await ensureSyncTable(tenant.churchId);
      } else {
        throw err;
      }
    }

    const existingMap = new Map(existingOps.map((e) => [e.operationId.toLowerCase(), e]));
    const newOps: ValidatedSyncOperation[] = [];

    for (const op of eligibleOps) {
      const prior = existingMap.get(op.operationId.toLowerCase());
      if (prior) {
        if (
          prior.churchId === tenant.churchId &&
          prior.classId === op.classId &&
          prior.childId === op.childId &&
          prior.date === op.date
        ) {
          resultsMap.set(op.operationId, {
            operationId: op.operationId,
            outcome: 'duplicate',
          });
        } else {
          resultsMap.set(op.operationId, {
            operationId: op.operationId,
            outcome: 'rejected',
            retryable: false,
            code: 'OPERATION_CONFLICT',
            message: 'تعارض في معرّف العملية',
          });
        }
      } else {
        newOps.push(op);
      }
    }

    let alerts = 0;

    if (newOps.length > 0) {
      // Unique (classId, date) pairs for session creation
      const sessionPairsMap = new Map<string, { classId: string; date: string }>();
      for (const op of newOps) {
        sessionPairsMap.set(`${op.classId}:${op.date}`, {
          classId: op.classId,
          date: op.date,
        });
      }
      const sessionPairs = Array.from(sessionPairsMap.values());

      // Atomic transaction:
      //  1) Ensure attendance_sessions exist for every (classId, date)
      //  2) Claim new operationIds in attendance_sync_operations (ON CONFLICT DO NOTHING)
      //     and upsert ONLY the latest claimed status per (classId, date, childId) into attendance.
      const [, appliedRows] = await transaction<{
        operationId?: string;
        childId?: string;
        classId?: string;
        date?: string;
        status?: string;
      }>([
        {
          text: `INSERT INTO "attendance_sessions" ("classId", "date", "createdBy", "createdAt", "updatedAt")
                 SELECT DISTINCT u."classId", u."date", $3::uuid, now(), now()
                 FROM unnest($1::uuid[], $2::date[]) AS u("classId", "date")
                 ON CONFLICT ("classId", "date") DO UPDATE
                   SET "updatedAt" = now()
                 RETURNING "id"`,
          params: [
            sessionPairs.map((s) => s.classId),
            sessionPairs.map((s) => s.date),
            auth.sub,
          ],
        },
        {
          text: `WITH incoming AS (
                   SELECT u."operationId", u."classId", u."childId", u."date", u."status", u."notes", u."seq"
                   FROM unnest($3::uuid[], $4::uuid[], $5::uuid[], $6::date[], $7::text[], $8::text[], $9::bigint[])
                     AS u("operationId", "classId", "childId", "date", "status", "notes", "seq")
                 ),
                 claimed AS (
                   INSERT INTO "attendance_sync_operations"
                     ("operationId", "churchId", "userId", "classId", "childId", "date", "status")
                   SELECT i."operationId", $1::uuid, $2::uuid, i."classId", i."childId", i."date", i."status"::attendance_status_enum
                   FROM incoming i
                   ON CONFLICT ("operationId") DO NOTHING
                   RETURNING "operationId", "classId", "childId", "date", "status"
                 ),
                 latest_per_child AS (
                   SELECT DISTINCT ON (c."classId", c."date", c."childId")
                     c."operationId", c."classId", c."childId", c."date", c."status", i."notes"
                   FROM claimed c
                   JOIN incoming i ON i."operationId" = c."operationId"
                   ORDER BY c."classId", c."date", c."childId", i."seq" DESC
                 ),
                 upserted AS (
                   INSERT INTO "attendance"
                     ("id", "childId", "classId", "date", "status", "notes", "recordedBy",
                      "sessionId", "updatedBy", "createdAt", "updatedAt")
                   SELECT
                     uuid_generate_v4(), l."childId", l."classId", l."date", l."status", l."notes",
                     $2::uuid, s."id", $2::uuid, now(), now()
                   FROM latest_per_child l
                   JOIN "attendance_sessions" s ON s."classId" = l."classId" AND s."date" = l."date"
                   ON CONFLICT ("childId", "classId", "date") DO UPDATE
                     SET "status" = EXCLUDED."status",
                         "notes" = COALESCE(EXCLUDED."notes", "attendance"."notes"),
                         "recordedBy" = COALESCE(EXCLUDED."recordedBy", "attendance"."recordedBy"),
                         "sessionId" = EXCLUDED."sessionId",
                         "updatedBy" = EXCLUDED."updatedBy",
                         "updatedAt" = now()
                   RETURNING "childId", "classId", "date"::text AS "date", "status"::text AS "status"
                 )
                 SELECT c."operationId"::text AS "operationId",
                        c."childId"::text AS "childId",
                        c."classId"::text AS "classId",
                        c."date"::text AS "date",
                        c."status"::text AS "status"
                 FROM claimed c`,
          params: [
            tenant.churchId,
            auth.sub,
            newOps.map((o) => o.operationId),
            newOps.map((o) => o.classId),
            newOps.map((o) => o.childId),
            newOps.map((o) => o.date),
            newOps.map((o) => o.status),
            newOps.map((o) => o.notes),
            newOps.map((o, idx) => idx + 1),
          ],
        },
      ]);

      const claimedSet = new Set(
        (appliedRows ?? []).map((r) => String(r.operationId || '').toLowerCase()),
      );

      for (const op of newOps) {
        if (claimedSet.has(op.operationId.toLowerCase())) {
          resultsMap.set(op.operationId, {
            operationId: op.operationId,
            outcome: 'applied',
          });
        } else {
          // Concurrent request claimed the exact same operationId in the meantime.
          resultsMap.set(op.operationId, {
            operationId: op.operationId,
            outcome: 'duplicate',
          });
        }
      }

      // Audit & repeated-absence alerts ONLY for newly claimed operations
      const claimedOps = newOps.filter((op) => claimedSet.has(op.operationId.toLowerCase()));
      if (claimedOps.length > 0) {
        const groupedAudit = new Map<string, ValidatedSyncOperation[]>();
        for (const op of claimedOps) {
          const k = `${op.classId}:${op.date}`;
          const list = groupedAudit.get(k) ?? [];
          list.push(op);
          groupedAudit.set(k, list);
        }

        const ip = requestIp(req);
        for (const [, group] of groupedAudit) {
          const { classId, date } = group[0];
          const session = await queryOne<{ id: string }>(
            `SELECT "id" FROM "attendance_sessions" WHERE "classId" = $1 AND "date" = $2 LIMIT 1`,
            [classId, date],
          );
          await recordAudit({
            actorId: access.userId,
            action: 'attendance.offline_sync',
            entityType: 'attendance_session',
            entityId: session?.id ?? null,
            after: {
              classId,
              date,
              count: group.length,
              operationIds: group.map((g) => g.operationId),
              distribution: group.reduce<Record<string, number>>((acc, g) => {
                acc[g.status] = (acc[g.status] || 0) + 1;
                return acc;
              }, {}),
            },
            ip,
          });
        }

        // Evaluate repeated_absence alerts per (classId, date) for newly synced absent records
        const rule = await queryOne<{ threshold: number; windowDays: number }>(
          `SELECT "threshold", "windowDays" FROM "follow_up_rules"
           WHERE "ruleType" = 'repeated_absence' AND "isActive" = true
           ORDER BY "createdAt" ASC LIMIT 1`,
        );

        if (rule) {
          for (const [, group] of groupedAudit) {
            const { classId, date } = group[0];
            // Deduplicate per child using latest status in the claimed group
            const latestStatusByChild = new Map<string, string>();
            for (const op of group) latestStatusByChild.set(op.childId, op.status);
            const absentIds = Array.from(latestStatusByChild.entries())
              .filter(([, status]) => status === 'absent')
              .map(([id]) => id);

            if (absentIds.length === 0) continue;
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
                  childName: childById.get(row.childId)?.name || 'طفل',
                  date,
                  absences: row.absences,
                  threshold: rule.threshold,
                });
              }
            }
          }
        }
      }
    }

    const results = Array.from(resultsMap.values());
    return jsonResponse({
      results,
      applied: results.filter((r) => r.outcome === 'applied').length,
      duplicates: results.filter((r) => r.outcome === 'duplicate').length,
      rejected: results.filter((r) => r.outcome === 'rejected').length,
      alerts,
    });
  } catch (error: unknown) {
    console.error('Attendance sync error:', error);
    return serverError('فشل مزامنة سجلات الحضور');
  }
}

export const POST = withTenant(POSTHandler);
