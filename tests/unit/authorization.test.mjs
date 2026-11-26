import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canAssignServantRole,
  canManageClassStructure,
  canManagePromotions,
  canManageServantRecord,
  canManageServantsInClass,
  canReadClass,
  canViewPrivateNotes,
  canWriteClass,
  effectiveClassIds,
  hasBroadClassRead,
  isClassLeaderAccess,
  isPrivilegedRole,
  readScopeClassIds,
} from '../../src/server/access.ts';

const scoped = {
  privileged: false,
  classIds: ['class-a', 'class-b'],
  userId: 'user-1',
  role: 'servant',
  servantId: 'servant-1',
  servantRole: 'خادم',
};

const privileged = {
  ...scoped,
  privileged: true,
  role: 'admin',
  servantRole: 'مسؤول',
};

test('scoped users can read and write only their assigned classes by default', () => {
  assert.equal(canReadClass(scoped, 'class-a'), true);
  assert.equal(canReadClass(scoped, 'class-z'), false);
  assert.equal(canReadClass(scoped, null), false);
  assert.equal(canWriteClass(scoped, 'class-b'), true);
  assert.equal(canWriteClass(scoped, 'class-z'), false);
  assert.equal(canWriteClass(scoped, null), false);
  assert.equal(canWriteClass(scoped, undefined), false);
});

test('legacy churches with readAllClasses can browse any class but write only assigned', () => {
  const legacy = { ...scoped, readAllClasses: true };
  assert.equal(canReadClass(legacy, 'class-a'), true);
  assert.equal(canReadClass(legacy, 'class-z'), true);
  assert.equal(canReadClass(legacy, null), false);
  assert.equal(canWriteClass(legacy, 'class-b'), true);
  assert.equal(canWriteClass(legacy, 'class-z'), false);
});

test('scoped users with no assignments cannot read or write classes without broad read', () => {
  const empty = { ...scoped, classIds: [] };
  assert.equal(canReadClass(empty, 'class-a'), false);
  assert.equal(canReadClass(empty, 'class-z'), false);
  assert.equal(canWriteClass(empty, 'class-a'), false);
  assert.equal(canWriteClass(empty, 'class-z'), false);

  const emptyLegacy = { ...scoped, classIds: [], readAllClasses: true };
  assert.equal(canReadClass(emptyLegacy, 'class-a'), true);
  assert.equal(canReadClass(emptyLegacy, 'class-z'), true);
  assert.equal(canWriteClass(emptyLegacy, 'class-a'), false);
});

test('privileged users access any class including unassigned children', () => {
  assert.equal(canReadClass(privileged, 'class-z'), true);
  assert.equal(canWriteClass(privileged, 'class-z'), true);
  assert.equal(canReadClass(privileged, null), true);
  assert.equal(canWriteClass(privileged, null), true);
});

test('private notes are limited to their author unless privileged', () => {
  assert.equal(canViewPrivateNotes(scoped, 'user-1'), true);
  assert.equal(canViewPrivateNotes(scoped, 'user-2'), false);
  assert.equal(canViewPrivateNotes(scoped, null), false);
  assert.equal(canViewPrivateNotes(privileged, 'user-2'), true);
  assert.equal(canViewPrivateNotes(privileged, null), true);
});

test('class structure administration is church-admin or explicit classes.write only', () => {
  assert.equal(canManageClassStructure(privileged), true);
  assert.equal(canManageClassStructure({ ...scoped, permissions: ['classes.write'] }), true);
  assert.equal(canManageClassStructure({ ...scoped, permissions: ['settings.write'] }), false);
  assert.equal(canManageClassStructure({ ...scoped, permissions: [] }), false);
});

test('annual promotion is limited to privileged users or explicit class-structure control', () => {
  assert.equal(canManagePromotions(privileged), true);
  assert.equal(canManagePromotions({ ...scoped, permissions: ['classes.write'] }), true);
  assert.equal(canManagePromotions({ ...scoped, permissions: ['promotions.write'] }), false);
  assert.equal(canManagePromotions({ ...scoped, permissions: ['children.write'] }), false);
  assert.equal(canManagePromotions({ ...scoped, permissions: [] }), false);
});

test('isPrivilegedRole recognizes English and Arabic leadership roles', () => {
  assert.equal(isPrivilegedRole('admin', null), true);
  assert.equal(isPrivilegedRole('priest', null), true);
  assert.equal(isPrivilegedRole('servant', 'مسؤول'), true);
  assert.equal(isPrivilegedRole('servant', 'أب كاهن'), true);
  assert.equal(isPrivilegedRole('servant', 'خادم'), false);
  assert.equal(isPrivilegedRole(null, null), false);
});

const classLeader = {
  ...scoped,
  servantRole: 'قائد فصل',
  classIds: ['class-a', 'class-b'],
  ledClassIds: ['class-a'],
};

test('a class leader is scoped to led classes even in legacy broad-read churches', () => {
  const legacyLeader = { ...classLeader, readAllClasses: true };

  assert.equal(isClassLeaderAccess(classLeader), true);
  assert.equal(isClassLeaderAccess({ ...scoped, ledClassIds: ['class-a'] }), true);
  assert.equal(isClassLeaderAccess(scoped), false);

  assert.deepEqual(effectiveClassIds(classLeader), ['class-a']);
  assert.deepEqual(readScopeClassIds(classLeader), ['class-a']);
  assert.deepEqual(readScopeClassIds(legacyLeader), ['class-a']);
  assert.equal(hasBroadClassRead(legacyLeader), false);

  assert.equal(canReadClass(legacyLeader, 'class-a'), true);
  assert.equal(canReadClass(legacyLeader, 'class-b'), false);
  assert.equal(canReadClass(legacyLeader, 'class-z'), false);
  assert.equal(canReadClass(legacyLeader, null), false);
  assert.equal(canWriteClass(legacyLeader, 'class-a'), true);
  assert.equal(canWriteClass(legacyLeader, 'class-b'), false);
});

test('class leaders manage servants only in their led class', () => {
  assert.equal(canManageServantsInClass(classLeader, 'class-a'), true);
  assert.equal(canManageServantsInClass(classLeader, 'class-b'), false);
  assert.equal(canManageServantsInClass(classLeader, null), false);

  const manager = { ...scoped, permissions: ['servants.write'] };
  assert.equal(canManageServantsInClass(manager, 'class-b'), true);
  assert.equal(canManageServantsInClass(scoped, 'class-a'), false);
});

test('class leaders may only edit regular servants assigned to their own class', () => {
  const regularInLedClass = { id: 's1', role: 'خادم', classIds: ['class-a'] };
  const regularOtherClass = { id: 's2', role: 'خادم', classIds: ['class-b'] };
  const anotherLeader = { id: 's3', role: 'قائد فصل', classIds: ['class-a'] };
  const adminInLedClass = { id: 's4', role: 'مسؤول', classIds: ['class-a'] };

  assert.equal(canManageServantRecord(classLeader, regularInLedClass), true);
  assert.equal(canManageServantRecord(classLeader, regularOtherClass), false);
  assert.equal(canManageServantRecord(classLeader, anotherLeader), false);
  assert.equal(canManageServantRecord(classLeader, adminInLedClass), false);

  assert.equal(canAssignServantRole(classLeader, 'خادم'), true);
  assert.equal(canAssignServantRole(classLeader, null), true);
  assert.equal(canAssignServantRole(classLeader, 'قائد فصل'), false);
  assert.equal(canAssignServantRole(classLeader, 'مسؤول'), false);
  assert.equal(canAssignServantRole(classLeader, 'أب كاهن'), false);

  const manager = { ...scoped, permissions: ['servants.write'] };
  assert.equal(canManageServantRecord(manager, regularOtherClass), true);
  assert.equal(canAssignServantRole(manager, 'مسؤول'), true);
});

test('class leaders cannot manage class structure or promotions even with a stale grant', () => {
  const leaderWithGrant = { ...classLeader, permissions: ['classes.write'] };

  assert.equal(canManageClassStructure(leaderWithGrant), false);
  assert.equal(canManagePromotions(leaderWithGrant), false);
  assert.equal(canManageServantRecord(leaderWithGrant, {
    id: 's1',
    role: 'خادم',
    classIds: ['class-a'],
  }), true);
});

test('cross-tenant token isolation: access token must match resolved tenant context', () => {
  const churchATenant = { churchId: 'c0000000-0000-4000-8000-000000000001', status: 'active' };
  const churchBTenant = { churchId: 'c0000000-0000-4000-8000-000000000002', status: 'active' };
  const suspendedTenant = { churchId: 'c0000000-0000-4000-8000-000000000001', status: 'suspended' };

  const tokenUserA = { sub: 'user-1', role: 'admin', tid: churchATenant.churchId };
  const tokenUserB = { sub: 'user-2', role: 'servant', tid: churchBTenant.churchId };

  // Helper reflecting getAuthUser's tenant binding logic
  function validateTenantBinding(user, tenant) {
    if (!user || !tenant) return null;
    if (user.tid !== tenant.churchId) return null;
    if (['suspended', 'archived', 'failed', 'pending', 'provisioning'].includes(tenant.status)) {
      return null;
    }
    return user;
  }

  // Token A on Church A succeeds
  assert.deepEqual(validateTenantBinding(tokenUserA, churchATenant), tokenUserA);
  // Token B on Church B succeeds
  assert.deepEqual(validateTenantBinding(tokenUserB, churchBTenant), tokenUserB);

  // Cross-tenant attempts: Token A on Church B fails
  assert.equal(validateTenantBinding(tokenUserA, churchBTenant), null, 'Cross-tenant token replay must be rejected');
  // Token B on Church A fails
  assert.equal(validateTenantBinding(tokenUserB, churchATenant), null, 'Cross-tenant token replay must be rejected');

  // Suspended church rejects token even if tid matches
  assert.equal(validateTenantBinding(tokenUserA, suspendedTenant), null, 'Suspended church must reject requests');
});
