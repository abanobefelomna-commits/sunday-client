import { query, queryOne } from './db';
import { ensureDefaultClasses } from './classes';

/**
 * Canonical servant role labels. Storage keeps the Arabic label because the
 * existing schema, UI copy and reports already use it. Incoming English codes
 * are normalised here so a role can never be stored with mixed spelling.
 */
export const SERVANT_ROLE_LABELS = {
  servant: 'خادم',
  general_servant: 'خادم فقرة عامة',
  class_leader: 'قائد فصل',
  admin: 'مسؤول',
  priest: 'أب كاهن',
} as const;

export type ServantRoleCode = keyof typeof SERVANT_ROLE_LABELS;
export type ServantRoleLabel = (typeof SERVANT_ROLE_LABELS)[ServantRoleCode];

const ROLE_ALIASES: Record<string, ServantRoleCode> = {
  servant: 'servant',
  'خادم': 'servant',
  general_servant: 'general_servant',
  general: 'general_servant',
  'خادم فقرة عامة': 'general_servant',
  class_leader: 'class_leader',
  leader: 'class_leader',
  'قائد فصل': 'class_leader',
  admin: 'admin',
  'مسؤول': 'admin',
  priest: 'priest',
  'أب كاهن': 'priest',
};

const PRIVILEGED_ROLE_CODES = new Set<ServantRoleCode>(['admin', 'priest']);

/** Normalise a role code or Arabic label. Unknown values return null. */
export function normalizeServantRole(value: unknown): ServantRoleCode | null {
  if (typeof value !== 'string') return null;
  return ROLE_ALIASES[value.trim()] ?? null;
}

export function servantRoleLabel(code: ServantRoleCode): ServantRoleLabel {
  return SERVANT_ROLE_LABELS[code];
}

export function isPrivilegedServantRole(value: unknown): boolean {
  const code = normalizeServantRole(value);
  return code !== null && PRIVILEGED_ROLE_CODES.has(code);
}

/** Map an account role (admin/priest) to a servant role code. */
export function servantRoleFromAccountRole(value: unknown): ServantRoleCode | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'priest') return 'priest';
  return null;
}

export class ServantIdentityConflictError extends Error {
  constructor(message = 'رقم الهاتف أو البريد الإلكتروني مستخدم بخادم آخر') {
    super(message);
    this.name = 'ServantIdentityConflictError';
  }
}

export interface ServantIdentity {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Resolve the servant record for an account.
 *
 * A direct `userId` link always wins. Legacy rows are matched by phone/email
 * only while they are still unlinked, and only when the match is unambiguous.
 * A unique legacy match is linked opportunistically so the identity becomes
 * stable from then on.
 */
export async function findServantForUser(
  identity: ServantIdentity,
): Promise<{ id: string; role: string } | null> {
  if (identity.userId) {
    const linked = await queryOne<{ id: string; role: string }>(
      `SELECT "id", "role" FROM "servants" WHERE "userId" = $1 LIMIT 1`,
      [identity.userId],
    );
    if (linked) return linked;
  }

  const phone = typeof identity.phone === 'string' ? identity.phone.trim() || null : null;
  const email =
    typeof identity.email === 'string' ? identity.email.trim().toLowerCase() || null : null;
  if (!phone && !email) return null;

  const matches = await query<{ id: string; role: string }>(
    `SELECT "id", "role" FROM "servants"
     WHERE "userId" IS NULL
       AND (
         ($1::text IS NOT NULL AND btrim("phone") = $1)
         OR ($2::text IS NOT NULL AND lower(btrim("email")) = $2)
       )
     ORDER BY "createdAt" ASC, "id" ASC
     LIMIT 2`,
    [phone, email],
  );

  if (matches.length !== 1) return null;

  if (identity.userId) {
    return queryOne<{ id: string; role: string }>(
      `UPDATE "servants"
       SET "userId" = $1, "updatedAt" = now()
       WHERE "id" = $2 AND "userId" IS NULL
       RETURNING "id", "role"`,
      [identity.userId, matches[0].id],
    );
  }

  return matches[0];
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

/**
 * Keep the servant directory in sync with the account fields the user owns.
 *
 * Class assignments are only reconsidered when `grades` is explicitly passed.
 * A profile edit therefore never silently removes a servant from their class.
 */
export async function syncServantFromUser(data: {
  userId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role?: string;
  servantRole?: string;
  avatar?: string | null;
  grades?: string[];
}): Promise<{ id: string; role: string }> {
  const existing = await findServantForUser(data);

  const requestedCode =
    data.servantRole !== undefined ? normalizeServantRole(data.servantRole) : null;
  const accountCode = servantRoleFromAccountRole(data.role);

  let roleLabel: string | null = requestedCode ? servantRoleLabel(requestedCode) : null;
  if (!roleLabel && !existing) {
    roleLabel = accountCode
      ? servantRoleLabel(accountCode)
      : data.grades?.includes('general')
        ? SERVANT_ROLE_LABELS.general_servant
        : SERVANT_ROLE_LABELS.servant;
  }
  if (
    existing &&
    requestedCode === 'servant' &&
    existing.role === SERVANT_ROLE_LABELS.servant &&
    data.grades?.includes('general')
  ) {
    roleLabel = SERVANT_ROLE_LABELS.general_servant;
  }

  const avatarProvided = data.avatar !== undefined;
  let servantId: string;
  let storedRole: string;

  try {
    if (existing) {
      const updated = await queryOne<{ id: string; role: string }>(
        `UPDATE "servants"
         SET "name" = $1,
             "phone" = COALESCE($2::text, "phone"),
             "email" = COALESCE($3::text, "email"),
             "role" = COALESCE($4::text, "role"),
             "avatar" = CASE WHEN $5::boolean THEN $6::text ELSE "avatar" END,
             "userId" = COALESCE("userId", $7),
             "updatedAt" = now()
         WHERE "id" = $8
         RETURNING "id", "role"`,
        [
          data.name,
          data.phone?.trim() || null,
          data.email?.trim() || null,
          roleLabel,
          avatarProvided,
          avatarProvided ? data.avatar ?? null : null,
          data.userId,
          existing.id,
        ],
      );
      if (!updated) throw new Error('Failed to update servant record');
      servantId = updated.id;
      storedRole = updated.role;
    } else {
      const inserted = await queryOne<{ id: string; role: string }>(
        `INSERT INTO "servants" ("id", "name", "phone", "email", "role", "avatar", "userId", "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), now())
         RETURNING "id", "role"`,
        [
          data.name,
          data.phone?.trim() || null,
          data.email?.trim() || null,
          roleLabel ?? SERVANT_ROLE_LABELS.servant,
          avatarProvided ? data.avatar ?? null : null,
          data.userId,
        ],
      );
      if (!inserted) throw new Error('Failed to create servant record');
      servantId = inserted.id;
      storedRole = inserted.role;
    }
  } catch (error) {
    if (isUniqueViolation(error)) throw new ServantIdentityConflictError();
    throw error;
  }

  if (data.grades !== undefined) {
    const roleCode = normalizeServantRole(storedRole);
    const assignedGrades =
      roleCode && PRIVILEGED_ROLE_CODES.has(roleCode) ? [] : data.grades;

    // Deleting memberships fires the integrity trigger that releases
    // leadership. Remember the led classes so a class leader who keeps their
    // grade does not lose the class by editing their profile.
    const previouslyLed = await query<{ id: string }>(
      `SELECT "id" FROM "classes" WHERE "leadServantId" = $1`,
      [servantId],
    );

    if (assignedGrades.length > 0) {
      await ensureDefaultClasses();
    }

    await query(`DELETE FROM "servants_classes" WHERE "servantsId" = $1`, [servantId]);

    const assignedClassIds: string[] = [];
    if (assignedGrades.length > 0) {
      const classes = await query<{ id: string }>(
        `SELECT DISTINCT ON ("grade"::text) "id"
         FROM "classes"
         WHERE "grade"::text = ANY($1::text[])
         ORDER BY "grade"::text, "createdAt" ASC, "id" ASC`,
        [assignedGrades],
      );

      for (const cls of classes) {
        assignedClassIds.push(cls.id);
        await query(
          `INSERT INTO "servants_classes" ("servantsId", "classesId")
           VALUES ($1, $2)
           ON CONFLICT ("servantsId", "classesId") DO NOTHING`,
          [servantId, cls.id],
        );
      }
    }

    if (roleCode === 'class_leader') {
      for (const cls of previouslyLed) {
        if (assignedClassIds.includes(cls.id)) {
          await claimClassLeadership(servantId, cls.id);
        }
      }
    }
  }

  await reconcileServantLeadership(servantId, storedRole);

  return { id: servantId, role: storedRole };
}

/**
 * Keep class-leader assignments consistent with the stored role.
 *
 * Privileged servants are not tied to classes. Any other non-leader role also
 * releases leadership. The class row is never rewritten when the servant is
 * still a leader, and `leadServantId` is only cleared, never reassigned here.
 */
export async function reconcileServantLeadership(
  servantId: string,
  role: string | null,
): Promise<void> {
  const code = normalizeServantRole(role);
  const privileged = code !== null && PRIVILEGED_ROLE_CODES.has(code);

  if (privileged) {
    await query(`DELETE FROM "servants_classes" WHERE "servantsId" = $1`, [servantId]);
  }
  if (privileged || code !== 'class_leader') {
    await query(
      `UPDATE "classes" SET "leadServantId" = NULL, "updatedAt" = now()
       WHERE "leadServantId" = $1`,
      [servantId],
    );
  }
}

export type ServantAccessRecord = {
  id: string;
  name: string;
  role: string;
  userId: string | null;
  classIds: string[];
};

/** Load the servant record plus class memberships used for record-level scope. */
export async function loadServantAccessRecord(
  servantId: string,
): Promise<ServantAccessRecord | null> {
  const servant = await queryOne<{
    id: string;
    name: string;
    role: string;
    userId: string | null;
  }>(
    `SELECT "id", "name", "role", "userId" FROM "servants" WHERE "id" = $1 LIMIT 1`,
    [servantId],
  );
  if (!servant) return null;

  const classes = await query<{ id: string }>(
    `SELECT "classesId" AS "id" FROM "servants_classes" WHERE "servantsId" = $1`,
    [servantId],
  );

  return { ...servant, classIds: classes.map((row) => row.id) };
}

/** Claim an unassigned class leadership slot. Returns false when already taken. */
export async function claimClassLeadership(
  servantId: string,
  classId: string,
): Promise<boolean> {
  const claimed = await queryOne<{ id: string }>(
    `UPDATE "classes"
     SET "leadServantId" = $1, "updatedAt" = now()
     WHERE "id" = $2 AND "leadServantId" IS NULL
     RETURNING "id"`,
    [servantId, classId],
  );
  return claimed !== null;
}

export async function syncServantAvatarForUser(
  userId: string,
  avatar: string | null,
): Promise<void> {
  try {
    await query(
      `UPDATE "servants" SET "avatar" = $1, "updatedAt" = now() WHERE "userId" = $2`,
      [avatar, userId],
    );
  } catch (err) {
    console.warn('[syncServantAvatarForUser] Failed to sync avatar:', err);
  }
}

/**
 * Link an existing unlinked servant to a newly verified account without
 * changing its profile fields. Returns the servant id when linked.
 */
export async function linkServantToUser(
  userId: string,
  email: string | null,
  phone: string | null,
): Promise<string | null> {
  const servant = await findServantForUser({ userId, email, phone });
  return servant?.id ?? null;
}
