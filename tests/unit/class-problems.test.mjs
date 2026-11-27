import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('class problem reports migration is additive and ledger-tracked', () => {
  const migration = read('db/tenant/011_class_problem_reports.sql');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS "class_problem_reports"/);
  assert.match(migration, /"classId" uuid NOT NULL REFERENCES "classes"\(?/);
  assert.match(migration, /"reporterId" uuid NOT NULL REFERENCES "users"\(?/);
  assert.match(migration, /"status" IN \('new', 'in_progress', 'resolved', 'closed'\)/);
  assert.match(migration, /"priority" IN \('low', 'medium', 'high', 'urgent'\)/);
  assert.match(migration, /INSERT INTO "tenant_migrations" \("name"\) VALUES \('011_class_problem_reports'\)/);
});

test('class problem routes enforce tenant auth and class scope on the backend', () => {
  const listRoute = read('app/api/class-problems/route.ts');
  const itemRoute = read('app/api/class-problems/[id]/route.ts');

  for (const route of [listRoute, itemRoute]) {
    assert.match(route, /getAuthUser\(req\)/);
    assert.match(route, /getAccessContext\(auth\)/);
    assert.match(route, /withTenant\(/);
  }
  assert.match(listRoute, /canReadClass\(access, classId\)/);
  assert.match(itemRoute, /isUuid\(id\)/);
});

test('class problem service scopes queries and authorizes writes server-side', () => {
  const service = read('src/server/class-problems.ts');

  assert.match(service, /readScopeClassIds\(access\)/);
  assert.match(service, /canReadClass\(access, row\.classId\)/);
  assert.match(service, /canWriteClass\(access, input\.classId\)/);
  assert.match(service, /canWriteClass\(access, existing\.classId\)/);
  assert.match(service, /"classId" = ANY\(\$5::uuid\[\]\)/);
  assert.match(service, /class_problem\.create/);
  assert.match(service, /class_problem\.resolve/);
  assert.match(service, /INSERT INTO "class_problem_reports"/);
  assert.doesNotMatch(service, /getConnectionString\(\).*classId/s);
});

test('class problems page is proxy-protected like other ministry pages', () => {
  const proxy = read('proxy.ts');
  assert.match(proxy, /"\/class-problems"/);
});

test('class problems page uses the scoped API and shows readable status labels', () => {
  const page = read('app/class-problems/page.tsx');

  assert.match(page, /getClassProblems\(/);
  assert.match(page, /createClassProblem\(/);
  assert.match(page, /updateClassProblem\(/);
  assert.match(page, /قيد المتابعة/);
  assert.match(page, /مشاكل الفصول وطلبات المساعدة/);
  assert.match(page, /STATUS_STYLE/);
});