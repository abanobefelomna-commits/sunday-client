import { query } from './db';
import type { AccessContext } from './middleware';

export interface AnalyticsFilters {
  from: string;
  to: string;
  classId: string | null;
}

function rate(present: number, late: number, total: number): number | null {
  return total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : null;
}

/**
 * Aggregate dashboard metrics with a fixed number of set-based queries.
 * No mock values: every number comes from the database and honours the
 * caller's class scope + date range.
 */
export async function getAnalyticsOverview(access: AccessContext, filters: AnalyticsFilters) {
  const scopeIds = access.privileged ? null : access.classIds;
  const params = [filters.from, filters.to, filters.classId, scopeIds];

  const totalsRows = await query<{
    students: number;
    activeClasses: number;
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    sessions: number;
    childrenWithAttendance: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM "children" c
        WHERE c."deletedAt" IS NULL
          AND ($3::uuid IS NULL OR c."classId" = $3)
          AND ($4::uuid[] IS NULL OR c."classId" = ANY($4::uuid[]))) AS students,
       (SELECT COUNT(*)::int FROM "classes" cls
        WHERE ($3::uuid IS NULL OR cls."id" = $3)
          AND ($4::uuid[] IS NULL OR cls."id" = ANY($4::uuid[]))
          AND EXISTS (SELECT 1 FROM "children" c WHERE c."classId" = cls."id" AND c."deletedAt" IS NULL)
       ) AS "activeClasses",
       COUNT(a."id")::int AS total,
       COUNT(a."id") FILTER (WHERE a."status"::text = 'present')::int AS present,
       COUNT(a."id") FILTER (WHERE a."status"::text = 'absent')::int AS absent,
       COUNT(a."id") FILTER (WHERE a."status"::text = 'late')::int AS late,
       COUNT(a."id") FILTER (WHERE a."status"::text = 'excused')::int AS excused,
       COUNT(DISTINCT (a."classId", a."date"))::int AS sessions,
       COUNT(DISTINCT a."childId")::int AS "childrenWithAttendance"
     FROM "attendance" a
     JOIN "children" c ON c."id" = a."childId" AND c."deletedAt" IS NULL
     WHERE a."date" BETWEEN $1::date AND $2::date
       AND ($3::uuid IS NULL OR a."classId" = $3)
       AND ($4::uuid[] IS NULL OR a."classId" = ANY($4::uuid[]))`,
    params,
  );

  const totals = totalsRows[0] ?? {
    students: 0,
    activeClasses: 0,
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    sessions: 0,
    childrenWithAttendance: 0,
  };

  const weekly = await query<{
    bucket: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>(
    `WITH buckets AS (
       SELECT generate_series(
         date_trunc('week', $1::date),
         date_trunc('week', $2::date),
         interval '1 week'
       )::date AS bucket
     )
     SELECT b.bucket::text AS bucket,
            COUNT(a."id")::int AS total,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'present')::int AS present,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'absent')::int AS absent,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'late')::int AS late,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'excused')::int AS excused
     FROM buckets b
     LEFT JOIN "attendance" a
       ON a."date" >= b.bucket
      AND a."date" < b.bucket + 7
      AND ($3::uuid IS NULL OR a."classId" = $3)
      AND ($4::uuid[] IS NULL OR a."classId" = ANY($4::uuid[]))
     GROUP BY b.bucket ORDER BY b.bucket`,
    params,
  );

  const monthly = await query<{
    bucket: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>(
    `WITH buckets AS (
       SELECT generate_series(
         date_trunc('month', $1::date),
         date_trunc('month', $2::date),
         interval '1 month'
       )::date AS bucket
     )
     SELECT b.bucket::text AS bucket,
            COUNT(a."id")::int AS total,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'present')::int AS present,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'absent')::int AS absent,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'late')::int AS late,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'excused')::int AS excused
     FROM buckets b
     LEFT JOIN "attendance" a
       ON a."date" >= b.bucket
      AND a."date" < b.bucket + interval '1 month'
      AND ($3::uuid IS NULL OR a."classId" = $3)
      AND ($4::uuid[] IS NULL OR a."classId" = ANY($4::uuid[]))
     GROUP BY b.bucket ORDER BY b.bucket`,
    params,
  );

  const classes = await query<{
    id: string;
    name: string;
    grade: string;
    students: number;
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    openFollowUps: number;
  }>(
    `SELECT cls."id", cls."name", cls."grade"::text AS "grade",
            COUNT(DISTINCT c."id")::int AS students,
            COUNT(a."id")::int AS total,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'present')::int AS present,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'absent')::int AS absent,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'late')::int AS late,
            COUNT(a."id") FILTER (WHERE a."status"::text = 'excused')::int AS excused,
            (SELECT COUNT(*)::int FROM "follow_ups" f
             WHERE f."classId" = cls."id" AND f."status" IN ('open', 'in_progress')) AS "openFollowUps"
     FROM "classes" cls
     LEFT JOIN "children" c ON c."classId" = cls."id" AND c."deletedAt" IS NULL
     LEFT JOIN "attendance" a
       ON a."childId" = c."id"
      AND a."date" BETWEEN $1::date AND $2::date
      AND ($3::uuid IS NULL OR a."classId" = $3)
     WHERE ($3::uuid IS NULL OR cls."id" = $3)
       AND ($4::uuid[] IS NULL OR cls."id" = ANY($4::uuid[]))
     GROUP BY cls."id"
     ORDER BY cls."name"`,
    params,
  );

  const followUpRows = await query<{
    openCases: number;
    inProgressCases: number;
    overdueCases: number;
    assignedCases: number;
    unassignedCases: number;
    resolvedInRange: number;
    childrenWithOpenCases: number;
    activitiesInRange: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE f."status" = 'open')::int AS "openCases",
       COUNT(*) FILTER (WHERE f."status" = 'in_progress')::int AS "inProgressCases",
       COUNT(*) FILTER (
         WHERE f."status" IN ('open', 'in_progress')
           AND f."dueDate" IS NOT NULL
           AND f."dueDate" < CURRENT_DATE
       )::int AS "overdueCases",
       COUNT(*) FILTER (
         WHERE f."status" IN ('open', 'in_progress') AND f."servantId" IS NOT NULL
       )::int AS "assignedCases",
       COUNT(*) FILTER (
         WHERE f."status" IN ('open', 'in_progress') AND f."servantId" IS NULL
       )::int AS "unassignedCases",
       COUNT(*) FILTER (
         WHERE f."status" = 'resolved'
           AND f."resolvedAt" >= $1::date
           AND f."resolvedAt" < ($2::date + interval '1 day')
       )::int AS "resolvedInRange",
       COUNT(DISTINCT f."childId") FILTER (
         WHERE f."status" IN ('open', 'in_progress')
       )::int AS "childrenWithOpenCases",
       (SELECT COUNT(*)::int FROM "follow_up_activities" act
        WHERE act."occurredAt" >= $1::date
          AND act."occurredAt" < ($2::date + interval '1 day')
          AND ($3::uuid IS NULL OR EXISTS (
            SELECT 1 FROM "follow_ups" f2
            WHERE f2."id" = act."followUpId" AND f2."classId" = $3
          ))
          AND ($4::uuid[] IS NULL OR EXISTS (
            SELECT 1 FROM "follow_ups" f2
            WHERE f2."id" = act."followUpId" AND f2."classId" = ANY($4::uuid[])
          ))
       ) AS "activitiesInRange"
     FROM "follow_ups" f
     JOIN "children" c ON c."id" = f."childId" AND c."deletedAt" IS NULL
     WHERE ($3::uuid IS NULL OR f."classId" = $3)
       AND ($4::uuid[] IS NULL OR f."classId" = ANY($4::uuid[]))`,
    params,
  );

  const followUps = followUpRows[0] ?? {
    openCases: 0,
    inProgressCases: 0,
    overdueCases: 0,
    assignedCases: 0,
    unassignedCases: 0,
    resolvedInRange: 0,
    childrenWithOpenCases: 0,
    activitiesInRange: 0,
  };

  return {
    filters,
    totals: {
      students: totals.students,
      activeClasses: totals.activeClasses,
      attendanceSessions: totals.sessions,
      childrenWithAttendance: totals.childrenWithAttendance,
      recordedRecords: totals.total,
      attendanceRate: rate(totals.present, totals.late, totals.total),
    },
    distribution: {
      present: totals.present,
      absent: totals.absent,
      late: totals.late,
      excused: totals.excused,
      total: totals.total,
    },
    weekly: weekly.map((row) => ({ ...row, rate: rate(row.present, row.late, row.total) })),
    monthly: monthly.map((row) => ({ ...row, rate: rate(row.present, row.late, row.total) })),
    classes: classes
      .map((row) => ({ ...row, rate: rate(row.present, row.late, row.total) }))
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)),
    followUps: {
      ...followUps,
      workload: followUps.openCases + followUps.inProgressCases,
    },
  };
}
