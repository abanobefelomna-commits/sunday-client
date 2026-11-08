import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canReadClass,
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

test('scoped users read and write only their assigned classes', () => {
  assert.equal(canReadClass(scoped, 'class-a'), true);
  assert.equal(canReadClass(scoped, 'class-z'), false);
  assert.equal(canReadClass(scoped, null), false);
  assert.equal(canWriteClass(scoped, 'class-b'), true);
  assert.equal(canWriteClass(scoped, 'class-z'), false);
  assert.equal(canWriteClass(scoped, null), false);
  assert.equal(canWriteClass(scoped, undefined), false);
});

test('scoped users with no classes are denied everything', () => {
  const empty = { ...scoped, classIds: [] };
  assert.equal(canReadClass(empty, 'class-a'), false);
  assert.equal(canWriteClass(empty, 'class-a'), false);
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

test('isPrivilegedRole recognizes English and Arabic leadership roles', () => {
  assert.equal(isPrivilegedRole('admin', null), true);
  assert.equal(isPrivilegedRole('priest', null), true);
  assert.equal(isPrivilegedRole('servant', 'مسؤول'), true);
  assert.equal(isPrivilegedRole('servant', 'أب كاهن'), true);
  assert.equal(isPrivilegedRole('servant', 'خادم'), false);
  assert.equal(isPrivilegedRole(null, null), false);
});
