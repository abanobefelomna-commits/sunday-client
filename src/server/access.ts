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
};

/** True when the user is allowed to read data for this class. */
export function canReadClass(access: AccessContext, classId: string | null | undefined): boolean {
  if (access.privileged) return true;
  return !!classId && access.classIds.includes(classId);
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
