import test from 'node:test';
import assert from 'node:assert/strict';

import { canManagePrivilegedServants } from '../../src/server/access.ts';

test('privileged users can manage privileged servants', () => {
  assert.equal(canManagePrivilegedServants({ privileged: true, permissions: [] }), true);
});

test('a supervisor with servants.write cannot manage privileged servants', () => {
  assert.equal(
    canManagePrivilegedServants({ privileged: false, permissions: ['servants.write'] }),
    false,
  );
});

test('roles.manage grants privileged servant management', () => {
  assert.equal(
    canManagePrivilegedServants({ privileged: false, permissions: ['roles.manage'] }),
    true,
  );
});

test('missing permissions are denied', () => {
  assert.equal(canManagePrivilegedServants({ privileged: false }), false);
});
