/**
 * Pure access-control helpers.
 *
 * Kept free of database and framework imports so authorization rules can be
 * unit-tested directly and reused by route handlers without side effects.
 */

export type AccessContext = {
  privileged: boolean;
  classIds: string[];
  userId: string;
  role: string;
  servantId: string | null;
  servantRole: string | null;
  permissions?: string[];
  /**
   * Church-level setting that preserves the legacy broad-read behaviour.
   * New churches default to false; see `access.readAllClasses`.
   */
  readAllClasses?: boolean;
};

/**
 * Parse the stored `access.readAllClasses` setting. jsonb normally arrives as
 * a boolean, but older hand-edited rows may contain a string.
 */
export function readAllClassesEnabled(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  if (value && typeof value === 'object' && 'enabled' in value) {
    return (value as { enabled?: unknown }).enabled === true;
  }
  return false;
}

/** True when reads are not limited to the user's assigned classes. */
export function hasBroadClassRead(access: AccessContext): boolean {
  return access.privileged || access.readAllClasses === true;
}

/**
 * True when the user is allowed to read data for this class.
 *
 * Reading child details and care history is limited to the servant's assigned
 * classes unless the church explicitly opted into the legacy broad-read
 * behaviour. Class names and aggregate counts remain browsable elsewhere.
 * `null` stays privileged-only for unassigned children.
 */
export function canReadClass(access: AccessContext, classId: string | null | undefined): boolean {
  if (access.privileged) return true;
  if (!classId) return false;
  if (hasBroadClassRead(access)) return true;
  return access.classIds.includes(classId);
}

/** True when the user may change care/attendance data for this class. */
export function canWriteClass(access: AccessContext, classId: string | null | undefined): boolean {
  if (access.privileged) return true;
  return !!classId && access.classIds.includes(classId);
}

export function canViewPrivateNotes(access: AccessContext, authorId: string | null): boolean {
  return access.privileged || (!!authorId && access.userId === authorId);
}

/** Privileged roles are the only roles allowed to manage servants and rules. */
export function isPrivilegedRole(role: string | null | undefined, servantRole: string | null | undefined): boolean {
  return (
    ['admin', 'priest'].includes(role || '') ||
    ['مسؤول', 'أب كاهن'].includes(servantRole || '')
  );
}

export function canManageClassStructure(
  access: Pick<AccessContext, 'privileged' | 'permissions'>,
): boolean {
  return access.privileged || access.permissions?.includes('classes.write') === true;
}
