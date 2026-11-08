import { query, queryOne } from './db';
import type { AccessContext } from './middleware';
import { canWriteClass } from './middleware';

export interface TimelineItem {
  id: string;
  type: 'attendance' | 'visitation' | 'follow_up' | 'activity' | 'progress' | 'note';
  title: string;
  description: string | null;
  date: string;
  status?: string | null;
  href?: string | null;
}

function attended(status: string) {
  return status === 'present' || status === 'late';
}

export async function getStudentProfile(
  childId: string,
  access: AccessContext,
  options: { timelineLimit?: number; historyDays?: number } = {},
) {
  const timelineLimit = Math.min(100, Math.max(10, options.timelineLimit ?? 60));
  const historyDays = Math.min(365, Math.max(30, options.historyDays ?? 180));

  const child = await queryOne<{
    id: string;
    name: string;
    birthDate: string;
    gender: string;
    parentPhone: string | null;
    parentName: string | null;
    address: string | null;
    notes: string | null;
    phone: string | null;
    avatar: string | null;
    classId: string | null;
    assignedServantId: string | null;
    createdAt: Date;
    updatedAt: Date;
    className: string | null;
    classGrade: string | null;
    assignedServantName: string | null;
    assignedServantPhone: string | null;
    assignedServantRole: string | null;
    assignedServantAvatar: string | null;
  }>(
    `SELECT c."id", c."name", c."birthDate", c."gender", c."parentPhone", c."parentName",
            c."address", c."notes", c."phone", c."avatar", c."classId", c."assignedServantId",
            c."createdAt", c."updatedAt",
            cls."name" AS "className", cls."grade" AS "classGrade",
            asg."name" AS "assignedServantName", asg."phone" AS "assignedServantPhone",
            asg."role"::text AS "assignedServantRole", asg."avatar" AS "assignedServantAvatar"
     FROM "children" c
     LEFT JOIN "classes" cls ON cls."id" = c."classId"
     LEFT JOIN "servants" asg ON asg."id" = c."assignedServantId"
     WHERE c."id" = $1 AND c."deletedAt" IS NULL
     LIMIT 1`,
    [childId],
  );

  if (!child) return null;

  const [summary, attendanceRows, progress, visitations, followUps, notes, activities, classServants] =
    await Promise.all([
      queryOne<{
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
        firstDate: string | null;
        lastDate: string | null;
      }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE "status"::text = 'present')::int AS present,
                COUNT(*) FILTER (WHERE "status"::text = 'absent')::int AS absent,
                COUNT(*) FILTER (WHERE "status"::text = 'late')::int AS late,
                COUNT(*) FILTER (WHERE "status"::text = 'excused')::int AS excused,
                MIN("date")::text AS "firstDate",
                MAX("date")::text AS "lastDate"
         FROM "attendance" WHERE "childId" = $1`,
        [childId],
      ),
      query<{
        id: string;
        date: string;
        status: string;
        notes: string | null;
        classId: string;
        className: string | null;
      }>(
        `SELECT a."id", a."date"::text AS "date", a."status"::text AS "status", a."notes",
                a."classId", cls."name" AS "className"
         FROM "attendance" a
         LEFT JOIN "classes" cls ON cls."id" = a."classId"
         WHERE a."childId" = $1
           AND a."date" >= CURRENT_DATE - ($2::int || ' days')::interval
         ORDER BY a."date" DESC
         LIMIT 366`,
        [childId, historyDays],
      ),
      query<{
        id: string;
        subject: string;
        level: string;
        score: string | number | null;
        notes: string | null;
        assessedAt: string;
        assessorName: string | null;
      }>(
        `SELECT ep."id", ep."subject", ep."level", ep."score", ep."notes",
                ep."assessedAt"::text AS "assessedAt", u."name" AS "assessorName"
         FROM "educational_progress" ep
         LEFT JOIN "users" u ON u."id" = ep."assessedBy"
         WHERE ep."childId" = $1
         ORDER BY ep."assessedAt" DESC, ep."createdAt" DESC
         LIMIT 30`,
        [childId],
      ),
      query<{
        id: string;
        date: string;
        type: string;
        status: string;
        notes: string | null;
        followUpDate: string | null;
        servantName: string | null;
        servantId: string | null;
      }>(
        `SELECT v."id", v."date"::text AS "date", v."type"::text AS "type",
                v."status"::text AS "status", v."notes", v."followUpDate"::text AS "followUpDate",
                v."servantId", s."name" AS "servantName"
         FROM "visitations" v
         LEFT JOIN "servants" s ON s."id" = v."servantId"
         WHERE v."childId" = $1
         ORDER BY v."date" DESC
         LIMIT 30`,
        [childId],
      ),
      query<{
        id: string;
        status: string;
        priority: string;
        reason: string;
        dueDate: string | null;
        source: string;
        servantId: string | null;
        servantName: string | null;
        createdAt: Date;
        resolvedAt: Date | null;
        activityCount: number;
        lastActivityAt: Date | null;
      }>(
        `SELECT f."id", f."status", f."priority", f."reason", f."dueDate"::text AS "dueDate",
                f."source", f."servantId", s."name" AS "servantName",
                f."createdAt", f."resolvedAt",
                COUNT(a."id")::int AS "activityCount",
                MAX(a."occurredAt") AS "lastActivityAt"
         FROM "follow_ups" f
         LEFT JOIN "servants" s ON s."id" = f."servantId"
         LEFT JOIN "follow_up_activities" a ON a."followUpId" = f."id"
         WHERE f."childId" = $1
         GROUP BY f."id", s."name"
         ORDER BY (f."status" IN ('open', 'in_progress')) DESC, f."createdAt" DESC
         LIMIT 40`,
        [childId],
      ),
      query<{
        id: string;
        visibility: string;
        body: string;
        authorId: string | null;
        authorName: string | null;
        createdAt: Date;
      }>(
        `SELECT n."id", n."visibility", n."body", n."authorId", u."name" AS "authorName", n."createdAt"
         FROM "student_notes" n
         LEFT JOIN "users" u ON u."id" = n."authorId"
         WHERE n."childId" = $1 AND n."deletedAt" IS NULL
           AND (
             $2::boolean = true
             OR n."visibility" = 'class'
             OR (n."visibility" = 'private' AND n."authorId" = $3)
           )
         ORDER BY n."createdAt" DESC
         LIMIT 50`,
        [childId, access.privileged, access.userId],
      ),
      query<{
        id: string;
        followUpId: string;
        type: string;
        title: string;
        notes: string | null;
        occurredAt: Date;
        actorName: string | null;
      }>(
        `SELECT a."id", a."followUpId", a."type", a."title", a."notes", a."occurredAt",
                u."name" AS "actorName"
         FROM "follow_up_activities" a
         LEFT JOIN "users" u ON u."id" = a."createdBy"
         WHERE a."childId" = $1
         ORDER BY a."occurredAt" DESC
         LIMIT 50`,
        [childId],
      ),
      child.classId
        ? query<{
            id: string;
            name: string;
            phone: string;
            role: string;
            avatar: string | null;
          }>(
            `SELECT s."id", s."name", s."phone", s."role"::text AS "role", s."avatar"
             FROM "servants_classes" sc
             JOIN "servants" s ON s."id" = sc."servantsId"
             WHERE sc."classesId" = $1
             ORDER BY CASE s."role"::text WHEN 'قائد فصل' THEN 0 WHEN 'خادم فري' THEN 1 ELSE 2 END, s."name"`,
            [child.classId],
          )
        : Promise.resolve([]),
    ]);

  const attendance = attendanceRows;
  const total = summary?.total ?? 0;
  const attendedCount = (summary?.present ?? 0) + (summary?.late ?? 0);
  const attendanceRate = total > 0 ? Math.round((attendedCount / total) * 1000) / 10 : null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const absencesLast30 = attendance.filter(
    (row) => row.status === 'absent' && row.date >= thirtyDaysAgo,
  ).length;

  let currentStreak = 0;
  for (const row of attendance) {
    if (attended(row.status)) currentStreak += 1;
    else break;
  }

  const scored = progress.filter((item) => item.score !== null && item.score !== undefined);
  const progressAverage =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, item) => sum + Number(item.score), 0) / scored.length) * 10,
        ) / 10
      : null;

  const openFollowUps = followUps.filter((item) => item.status === 'open' || item.status === 'in_progress');
  const lastCompletedVisit = visitations.find((visit) => visit.status === 'completed') ?? null;

  const timeline: TimelineItem[] = [];
  for (const row of attendance.slice(0, 25)) {
    timeline.push({
      id: `attendance:${row.id}`,
      type: 'attendance',
      title:
        row.status === 'present'
          ? 'حضور'
          : row.status === 'late'
            ? 'حضور متأخر'
            : row.status === 'excused'
              ? 'غياب بعذر'
              : 'غياب',
      description: row.notes || row.className,
      date: row.date,
      status: row.status,
    });
  }
  for (const visit of visitations.slice(0, 20)) {
    timeline.push({
      id: `visitation:${visit.id}`,
      type: 'visitation',
      title: visit.type === 'home_visit' ? 'افتقاد منزلي' : visit.type === 'phone_call' ? 'اتصال هاتفي' : 'افتقاد',
      description: visit.notes || visit.servantName,
      date: visit.date,
      status: visit.status,
    });
  }
  for (const item of followUps.slice(0, 20)) {
    timeline.push({
      id: `followup:${item.id}`,
      type: 'follow_up',
      title: 'متابعة رعوية',
      description: item.reason,
      date: item.createdAt.toISOString?.() ?? String(item.createdAt),
      status: item.status,
    });
  }
  for (const activity of activities.slice(0, 25)) {
    timeline.push({
      id: `activity:${activity.id}`,
      type: 'activity',
      title: activity.title,
      description: activity.notes || activity.actorName,
      date: activity.occurredAt.toISOString?.() ?? String(activity.occurredAt),
      status: activity.type,
    });
  }
  for (const item of progress.slice(0, 15)) {
    timeline.push({
      id: `progress:${item.id}`,
      type: 'progress',
      title: `تقدم تعليمي: ${item.subject}`,
      description: item.notes || `المستوى: ${item.level}`,
      date: item.assessedAt,
      status: item.level,
    });
  }
  for (const note of notes.slice(0, 15)) {
    timeline.push({
      id: `note:${note.id}`,
      type: 'note',
      title: 'ملاحظة موثّقة',
      description: note.body,
      date: note.createdAt.toISOString?.() ?? String(note.createdAt),
      status: note.visibility,
    });
  }
  timeline.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const responsibleServants = child.assignedServantId
    ? [
        {
          id: child.assignedServantId,
          name: child.assignedServantName,
          phone: child.assignedServantPhone,
          role: child.assignedServantRole || 'مسؤول متابعة الطفل',
          avatar: child.assignedServantAvatar,
        },
        ...classServants.filter((servant) => servant.id !== child.assignedServantId),
      ]
    : classServants;

  return {
    student: {
      ...child,
      class: child.classId
        ? { id: child.classId, name: child.className, grade: child.classGrade }
        : null,
      assignedServant: child.assignedServantId
        ? { id: child.assignedServantId, name: child.assignedServantName }
        : null,
      responsibleServants,
    },
    stats: {
      attendanceRate,
      totalSessions: total,
      present: summary?.present ?? 0,
      absent: summary?.absent ?? 0,
      late: summary?.late ?? 0,
      excused: summary?.excused ?? 0,
      absencesLast30,
      currentStreak,
      lastAttendanceDate: summary?.lastDate ?? null,
      lastVisitDate: lastCompletedVisit?.date ?? null,
      openFollowUps: openFollowUps.length,
      progressAverage,
      progressEntries: progress.length,
    },
    attendance,
    progress,
    visitations,
    followUps,
    notes,
    activities,
    timeline: timeline.slice(0, timelineLimit),
    permissions: {
      canWrite: canWriteClass(access, child.classId),
      canViewPrivateNotes: access.privileged,
      manager: access.privileged,
    },
  };
}
