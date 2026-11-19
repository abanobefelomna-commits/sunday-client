/**
 * Church invitation code notifications.
 *
 * The notification is delivered to every privileged account so a newly created
 * church code is never lost: the administrator sees it in the app, and users
 * with the `مسؤول` / `أب كاهن` servant roles receive it too.
 *
 * The helpers accept an explicit SQL executor so the same logic runs inside the
 * tenant request context and inside platform provisioning (where no tenant
 * context exists yet).
 */

export interface ChurchCodeNotificationSql {
  query(text: string, params?: unknown[]): Promise<unknown>;
}

export interface ChurchCodeNotificationInput {
  /** Active church invitation code. */
  code: string;
  /** Display name of the church, used in the notification title. */
  churchName?: string | null;
  /** Tenant church id recorded on the notification entity. */
  churchId?: string | null;
}

export const CHURCH_CODE_NOTIFICATION_TYPE = 'church_code';

/** Recipients: account admins/priests plus linked servants in a leading role. */
const PRIVILEGED_RECIPIENTS_SQL = `
  SELECT DISTINCT u."id"
  FROM "users" u
  LEFT JOIN "servants" s ON s."userId" = u."id"
  WHERE u."isActive" = true
    AND (
      u."role" IN ('admin', 'priest')
      OR s."role" IN ('مسؤول', 'أب كاهن')
    )
`;

export function churchCodeDedupeKey(code: string): string {
  return `church-code:${code.trim().toUpperCase().slice(0, 40)}`;
}

export function churchCodeNotificationBody(input: ChurchCodeNotificationInput): {
  title: string;
  body: string;
} {
  const rawName = (input.churchName || '').trim();
  // Live church names already start with "كنيسة", so avoid doubling the word.
  const name = rawName.replace(/^كنيسة(\s+|$)/, '').trim();
  const code = input.code.trim().toUpperCase();
  return {
    title: name ? `رمز دعوة كنيسة ${name}` : 'رمز دعوة الكنيسة',
    body: [
      `الرمز الحالي: ${code}`,
      'استخدم هذا الرمز عند تسجيل حساب خادم جديد لربطه بهذه الكنيسة.',
      'يمكنك تجديد الرمز من صفحة إعدادات الكنيسة؛ الرمز القديم يصبح غير صالح فورًا.',
    ].join('\n'),
  };
}

/**
 * Insert the church-code notification for every privileged user. Returns the
 * number of notifications created. Repeating the call for the same code is a
 * no-op thanks to the per-user dedupe key.
 */
export async function notifyChurchCodeRecipients(
  sql: ChurchCodeNotificationSql,
  input: ChurchCodeNotificationInput,
): Promise<number> {
  const code = input.code.trim().toUpperCase();
  if (!code) return 0;

  const recipients = (await sql.query(PRIVILEGED_RECIPIENTS_SQL)) as Array<{
    id: string;
  }>;
  if (recipients.length === 0) return 0;

  const { title, body } = churchCodeNotificationBody({ ...input, code });
  const dedupeKey = churchCodeDedupeKey(code);
  let created = 0;

  for (const recipient of recipients) {
    const rows = (await sql.query(
      `INSERT INTO "notifications"
         ("id", "userId", "type", "title", "body", "entityType", "entityId", "dedupeKey", "createdAt")
       SELECT uuid_generate_v4(), $1, $2, $3, $4, 'church_code', $5, $6, now()
       WHERE NOT EXISTS (
         SELECT 1 FROM "notification_preferences" p
         WHERE p."userId" = $1 AND p."churchCode" = false
       )
       ON CONFLICT ("userId", "dedupeKey") WHERE "dedupeKey" IS NOT NULL DO NOTHING
       RETURNING "id"`,
      [recipient.id, CHURCH_CODE_NOTIFICATION_TYPE, title, body, input.churchId ?? null, dedupeKey],
    )) as Array<{ id: string }>;
    if (rows.length > 0) created += 1;
  }

  return created;
}
