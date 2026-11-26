/**
 * Pure access-control helpers.
 *
 * Kept free of database and framework imports so authorization rules can be
 * unit-tested directly and reused by route handlers without side effects.
 */

export const CLASS_LEADER_SERVANT_ROLE = 'قائد فصل';

export type AccessContext = {
  privileged: boolean;
  classIds: string[];
  userId: string;
  role: string;
  servantId: string | null;
  servantRole: string | null;
  /**
   * Classes this user leads as their designated class leader. A class leader
   * is strictly scoped to these classes even when the legacy broad-read
   * setting is enabled.
   */
  ledClassIds?: string[];
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

/**
 * True when the account carries the class-leader role, regardless of whether
 * a class has been assigned yet.
 */
export function isClassLeaderAccess(
  access: { servantRole?: string | null; ledClassIds?: string[] },
): boolean {
  return (
    access.servantRole === CLASS_LEADER_SERVANT_ROLE ||
    (access.ledClassIds?.length ?? 0) > 0
  );
}

/** Unique class ids without relying on Set iteration order assumptions. */
function uniqueIds(ids: string[] | undefined): string[] {
  return [...new Set(ids ?? [])];
}

/**
 * Classes that define the user's data scope.
 *
 * A class leader is limited to the classes they lead. When the leader has no
 * class assigned yet (for example a legacy row), fall back to the regular
 * servant assignments so the account does not silently lose visibility.
 */
export function effectiveClassIds(
  access: { classIds: string[]; servantRole?: string | null; ledClassIds?: string[] },
): string[] {
  const led = uniqueIds(access.ledClassIds);
  if (led.length > 0) return led;
  return uniqueIds(access.classIds);
}

/**
 * Class scope for list/report queries: `null` means unrestricted. Class
 * leaders never receive an unrestricted scope, even in legacy churches that
 * enabled `access.readAllClasses`.
 */
export function readScopeClassIds(
  access: {
    privileged: boolean;
    classIds: string[];
    servantRole?: string | null;
    ledClassIds?: string[];
    readAllClasses?: boolean;
  },
): string[] | null {
  if (access.privileged) return null;
  if (access.readAllClasses === true && !isClassLeaderAccess(access)) return null;
  return effectiveClassIds(access);
}

/** True when reads are not limited to the user's assigned classes. */
export function hasBroadClassRead(
  access: {
    privileged: boolean;
    servantRole?: string | null;
    ledClassIds?: string[];
    readAllClasses?: boolean;
  },
): boolean {
  return access.privileged || (access.readAllClasses === true && !isClassLeaderAccess(access));
}

/**
 * True when the user is allowed to read data for this class.
 *
 * Reading child details and care history is limited to the servant's assigned
 * classes unless the church explicitly opted into the legacy broad-read
 * behaviour. Class leaders are always limited to their led classes.
 * `null` stays privileged-only for unassigned children.
 */
export function canReadClass(access: AccessContext, classId: string | null | undefined): boolean {
  if (access.privileged) return true;
  if (!classId) return false;
  if (hasBroadClassRead(access)) return true;
  return effectiveClassIds(access).includes(classId);
}

/** True when the user may change care/attendance data for this class. */
export function canWriteClass(access: AccessContext, classId: string | null | undefined): boolean {
  if (access.privileged) return true;
  return !!classId && effectiveClassIds(access).includes(classId);
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
  access: {
    privileged: boolean;
    permissions?: string[];
    servantRole?: string | null;
    ledClassIds?: string[];
  },
): boolean {
  // Class leaders never manage class structure or global settings, even if a
  // legacy RBAC row happens to grant classes.write.
  if (isClassLeaderAccess(access)) return false;
  return access.privileged || access.permissions?.includes('classes.write') === true;
}

/**
 * Annual promotion is restricted to privileged roles (administrators and
 * priests) and responsible users explicitly granted class-structure control.
 */
export function canManagePromotions(
  access: {
    privileged: boolean;
    permissions?: string[];
    servantRole?: string | null;
    ledClassIds?: string[];
  },
): boolean {
  if (isClassLeaderAccess(access)) return false;
  return access.privileged || access.permissions?.includes('classes.write') === true;
}

/**
 * True when the user may manage (create, edit, delete) servants in a class.
 *
 * Class leaders are limited to the classes they lead. Users with the
 * `servants.write` permission keep the existing church-wide ability.
 */
export function canManageServantsInClass(
  access: Pick<AccessContext, 'privileged' | 'servantRole' | 'ledClassIds' | 'permissions'>,
  classId: string | null | undefined,
): boolean {
  if (access.privileged) return true;
  if (isClassLeaderAccess(access)) {
    return !!classId && uniqueIds(access.ledClassIds).includes(classId);
  }
  return access.permissions?.includes('servants.write') === true;
}

/**
 * True when the user may modify this servant record. A class leader may only
 * touch regular `خادم` records that belong to one of the classes they lead.
 */
export function canManageServantRecord(
  access: Pick<
    AccessContext,
    'privileged' | 'servantRole' | 'ledClassIds' | 'permissions' | 'servantId'
  >,
  record: { id: string; role: string | null; classIds: string[] },
): boolean {
  if (access.privileged) return true;
  if (isClassLeaderAccess(access)) {
    if (record.role !== 'خادم') return false;
    const led = uniqueIds(access.ledClassIds);
    return led.length > 0 && record.classIds.some((id) => led.includes(id));
  }
  return access.permissions?.includes('servants.write') === true;
}

/**
 * Class leaders may only create regular servants. Privileged users and
 * explicit servant managers keep the existing role-assignment ability.
 */
export function canAssignServantRole(
  access: Pick<AccessContext, 'privileged' | 'servantRole' | 'ledClassIds' | 'permissions'>,
  role: string | null | undefined,
): boolean {
  if (access.privileged) return true;
  if (isClassLeaderAccess(access)) return (role || 'خادم') === 'خادم';
  return access.permissions?.includes('servants.write') === true;
}
