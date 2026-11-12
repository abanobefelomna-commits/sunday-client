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

/**
 * True when the user is allowed to read data for this class.
 *
 * Every authenticated member of the service may browse any class, its
 * servants and its children. Reading is intentionally broader than writing:
 * the class roster, student directory and care history are visible to all
 * servants, while canWriteClass() still limits changes to their own classes.
 */
export function canReadClass(access: AccessContext, classId: string | null | undefined): boolean {
  if (access.privileged) return true;
  // AccessContext is only built for an authenticated user, so any real class
  // id is readable. `null` stays privileged-only for unassigned children.
  return !!classId;
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
