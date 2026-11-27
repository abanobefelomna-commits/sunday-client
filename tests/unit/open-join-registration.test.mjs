import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../../app/api/auth/register/route.ts', import.meta.url), 'utf8');

test('open join (no church code) cannot become a class leader or pick a class', () => {
  assert.match(route, /const openJoin = !rawChurchCode;/);
  assert.match(route, /rawServantRole === 'class_leader' && !openJoin/);
  assert.match(route, /isPrivileged \|\| openJoin \? \[\]/);
});

test('open join still requires an explicit church or a church host', () => {
  assert.match(route, /openJoin && !explicitSlug/);
  assert.match(route, /hostIdentifiesTenant/);
});

test('privileged roles still require a single-use role code', () => {
  assert.match(route, /if \(isPrivileged\) \{\s+if \(!suppliedRoleCode/);
  assert.match(route, /"revoked" = true/);
});
