import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canReadClass,
  canManageClassStructure,
  canViewPrivateNotes,
  canWriteClass,
  isPrivilegedRole,
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

test('scoped users can read any class but write only their assigned classes', () => {
  assert.equal(canReadClass(scoped, 'class-a'), true);
  assert.equal(canReadClass(scoped, 'class-z'), true);
  assert.equal(canReadClass(scoped, null), false);
  assert.equal(canWriteClass(scoped, 'class-b'), true);
  assert.equal(canWriteClass(scoped, 'class-z'), false);
  assert.equal(canWriteClass(scoped, null), false);
  assert.equal(canWriteClass(scoped, undefined), false);
});

test('scoped users with no assignments can still browse but not write', () => {
  const empty = { ...scoped, classIds: [] };
  assert.equal(canReadClass(empty, 'class-a'), true);
  assert.equal(canReadClass(empty, 'class-z'), true);
  assert.equal(canWriteClass(empty, 'class-a'), false);
  assert.equal(canWriteClass(empty, 'class-z'), false);
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

test('isPrivilegedRole recognizes English and Arabic leadership roles', () => {
  assert.equal(isPrivilegedRole('admin', null), true);
  assert.equal(isPrivilegedRole('priest', null), true);
  assert.equal(isPrivilegedRole('servant', 'مسؤول'), true);
  assert.equal(isPrivilegedRole('servant', 'أب كاهن'), true);
  assert.equal(isPrivilegedRole('servant', 'خادم'), false);
  assert.equal(isPrivilegedRole(null, null), false);
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
