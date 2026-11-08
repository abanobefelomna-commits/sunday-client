import { query, queryOne } from './db';

export type NotificationType =
  | 'follow_up_assigned'
  | 'follow_up_overdue'
  | 'follow_up_completed'
  | 'attendance_alert';

export interface NotificationPreferences {
  followUpAssigned: boolean;
  followUpOverdue: boolean;
  followUpCompleted: boolean;
  attendanceAlert: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  followUpAssigned: true,
  followUpOverdue: true,
  followUpCompleted: true,
  attendanceAlert: true,
};

const TYPE_TO_PREFERENCE: Record<NotificationType, keyof NotificationPreferences> = {
  follow_up_assigned: 'followUpAssigned',
  follow_up_overdue: 'followUpOverdue',
  follow_up_completed: 'followUpCompleted',
  attendance_alert: 'attendanceAlert',
};

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const row = await queryOne<NotificationPreferences>(
    `SELECT "followUpAssigned", "followUpOverdue", "followUpCompleted", "attendanceAlert"
     FROM "notification_preferences" WHERE "userId" = $1 LIMIT 1`,
    [userId],
  );
  return row ?? DEFAULT_PREFERENCES;
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const next = { ...current, ...patch };
  await query(
    `INSERT INTO "notification_preferences"
       ("userId", "followUpAssigned", "followUpOverdue", "followUpCompleted", "attendanceAlert", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT ("userId") DO UPDATE SET
       "followUpAssigned" = EXCLUDED."followUpAssigned",
       "followUpOverdue" = EXCLUDED."followUpOverdue",
       "followUpCompleted" = EXCLUDED."followUpCompleted",
       "attendanceAlert" = EXCLUDED."attendanceAlert",
       "updatedAt" = now()`,
    [userId, next.followUpAssigned, next.followUpOverdue, next.followUpCompleted, next.attendanceAlert],
  );
  return next;
}

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
}

/**
 * Insert one in-app notification. Preference checks and dedupe happen inside
 * SQL so concurrent evaluations cannot create duplicates.
 */
export async function createNotification(input: NotificationInput): Promise<boolean> {
  const preference = TYPE_TO_PREFERENCE[input.type];
  const rows = await query<{ id: string }>(
    `INSERT INTO "notifications"
       ("id", "userId", "type", "title", "body", "entityType", "entityId", "dedupeKey", "createdAt")
     SELECT uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, now()
     WHERE NOT EXISTS (
       SELECT 1 FROM "notification_preferences" p
       WHERE p."userId" = $1 AND p."${preference}" = false
     )
     ON CONFLICT ("userId", "dedupeKey") WHERE "dedupeKey" IS NOT NULL DO NOTHING
     RETURNING "id"`,
    [
      input.userId,
      input.type,
      input.title.slice(0, 180),
      input.body ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      input.dedupeKey ?? null,
    ],
  );
  return rows.length > 0;
}

async function userIdForServant(servantId: string | null | undefined): Promise<string | null> {
  if (!servantId) return null;
  const row = await queryOne<{ id: string }>(
    `SELECT u."id"
     FROM "servants" s
     JOIN "users" u ON u."phone" = s."phone" OR (s."email" IS NOT NULL AND u."email" = s."email")
     WHERE s."id" = $1
     LIMIT 1`,
    [servantId],
  );
  return row?.id ?? null;
}

export async function managerUserIds(): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT "id" FROM "users" WHERE "role" IN ('admin', 'priest')`,
  );
  return rows.map((row) => row.id);
}

export async function classUserIds(classId: string | null | undefined): Promise<string[]> {
  if (!classId) return managerUserIds();
  const rows = await query<{ id: string }>(
    `SELECT DISTINCT u."id"
     FROM "servants_classes" sc
     JOIN "servants" s ON s."id" = sc."servantsId"
     JOIN "users" u ON u."phone" = s."phone" OR (s."email" IS NOT NULL AND u."email" = s."email")
     WHERE sc."classesId" = $1
     UNION
     SELECT "id" FROM "users" WHERE "role" IN ('admin', 'priest')`,
    [classId],
  );
  return rows.map((row) => row.id);
}

/**
 * Notify the assigned servant when possible, and always include managers so a
 * case cannot silently disappear when the servant has no linked user account.
 */
export async function notifyFollowUpStakeholders(input: {
  type: NotificationType;
  title: string;
  body: string;
  followUpId: string;
  servantId: string | null;
  classId: string | null;
  dedupeKey: string;
}): Promise<number> {
  const recipients = new Set<string>();
  const assignee = await userIdForServant(input.servantId);
  if (assignee) recipients.add(assignee);
  for (const managerId of await managerUserIds()) recipients.add(managerId);
  if (recipients.size === 0) {
    for (const classUser of await classUserIds(input.classId)) recipients.add(classUser);
  }

  let created = 0;
  for (const userId of recipients) {
    const inserted = await createNotification({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: 'follow_up',
      entityId: input.followUpId,
      dedupeKey: input.dedupeKey,
    });
    if (inserted) created += 1;
  }
  return created;
}

export async function notifyAttendanceAlert(input: {
  classId: string;
  childId: string;
  childName: string;
  date: string;
  absences: number;
  threshold: number;
}): Promise<number> {
  const recipients = await classUserIds(input.classId);
  let created = 0;
  for (const userId of recipients) {
    const inserted = await createNotification({
      userId,
      type: 'attendance_alert',
      title: `تنبيه حضور: ${input.childName}`,
      body: `تم تسجيل غياب في ${input.date}، ليصبح إجمالي الغياب ${input.absences} مرة خلال الفترة (الحد المفعّل: ${input.threshold}).`,
      entityType: 'child',
      entityId: input.childId,
      dedupeKey: `attendance-absent:${input.childId}:${input.date}`,
    });
    if (inserted) created += 1;
  }
  return created;
}
