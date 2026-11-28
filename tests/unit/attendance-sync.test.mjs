import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  latestByChildSession,
  prepareBatchOperations,
  validateSyncOperation,
} from '../../src/server/attendance-sync.ts';

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';
const CLASS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CHILD_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CHILD_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test('validateSyncOperation accepts valid payload and rejects malformed or future inputs', () => {
  const ok = validateSyncOperation(
    {
      operationId: UUID_1,
      classId: CLASS_A,
      date: '2026-11-20',
      childId: CHILD_1,
      status: 'present',
      notes: '  arrived on time  ',
      queuedAt: 1000,
    },
    0,
    '2026-11-28',
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.op.operationId, UUID_1);
    assert.equal(ok.op.status, 'present');
    assert.equal(ok.op.notes, 'arrived on time');
  }

  const badUuid = validateSyncOperation(
    { operationId: 'not-a-uuid', classId: CLASS_A, date: '2026-11-20', childId: CHILD_1, status: 'present' },
    0,
    '2026-11-28',
  );
  assert.equal(badUuid.ok, false);
  if (!badUuid.ok) assert.equal(badUuid.code, 'INVALID_OPERATION_ID');

  const futureDate = validateSyncOperation(
    { operationId: UUID_1, classId: CLASS_A, date: '2026-11-29', childId: CHILD_1, status: 'present' },
    0,
    '2026-11-28',
  );
  assert.equal(futureDate.ok, false);
  if (!futureDate.ok) assert.equal(futureDate.code, 'FUTURE_DATE');

  const badStatus = validateSyncOperation(
    { operationId: UUID_1, classId: CLASS_A, date: '2026-11-20', childId: CHILD_1, status: 'hacker' },
    0,
    '2026-11-28',
  );
  assert.equal(badStatus.ok, false);
  if (!badStatus.ok) assert.equal(badStatus.code, 'INVALID_STATUS');
});

test('prepareBatchOperations deduplicates identical operationIds and sorts chronologically', () => {
  const { unique, inBatchDuplicates } = prepareBatchOperations([
    {
      operationId: UUID_2,
      classId: CLASS_A,
      date: '2026-11-20',
      childId: CHILD_1,
      status: 'absent',
      notes: null,
      queuedAt: 200,
      seq: 0,
    },
    {
      operationId: UUID_1,
      classId: CLASS_A,
      date: '2026-11-20',
      childId: CHILD_1,
      status: 'present',
      notes: null,
      queuedAt: 100,
      seq: 1,
    },
    {
      operationId: UUID_1.toUpperCase(),
      classId: CLASS_A,
      date: '2026-11-20',
      childId: CHILD_1,
      status: 'present',
      notes: null,
      queuedAt: 100,
      seq: 2,
    },
  ]);

  assert.equal(inBatchDuplicates.length, 1);
  assert.equal(unique.length, 2);
  assert.equal(unique[0].operationId, UUID_1);
  assert.equal(unique[1].operationId, UUID_2);
});

test('latestByChildSession keeps the newest status per (classId, date, childId)', () => {
  const prepared = prepareBatchOperations([
    {
      operationId: UUID_1,
      classId: CLASS_A,
      date: '2026-11-20',
      childId: CHILD_1,
      status: 'present',
      notes: null,
      queuedAt: 100,
      seq: 0,
    },
    {
      operationId: UUID_2,
      classId: CLASS_A,
      date: '2026-11-20',
      childId: CHILD_1,
      status: 'late',
      notes: null,
      queuedAt: 200,
      seq: 1,
    },
    {
      operationId: UUID_3,
      classId: CLASS_A,
      date: '2026-11-20',
      childId: CHILD_2,
      status: 'excused',
      notes: null,
      queuedAt: 150,
      seq: 2,
    },
  ]);

  const latest = latestByChildSession(prepared.unique);
  assert.equal(latest.length, 2);
  const child1Op = latest.find((o) => o.childId === CHILD_1);
  const child2Op = latest.find((o) => o.childId === CHILD_2);
  assert.equal(child1Op?.status, 'late');
  assert.equal(child2Op?.status, 'excused');
});

test('/api/attendance/sync enforces tenant, auth, class permissions, child membership, and DB idempotency', () => {
  const routeSrc = readFileSync(
    resolve(process.cwd(), 'app/api/attendance/sync/route.ts'),
    'utf8',
  );
  assert.match(routeSrc, /withTenant\(POSTHandler\)/);
  assert.match(routeSrc, /getAuthUser\(req\)/);
  assert.match(routeSrc, /getAccessContext\(auth\)/);
  assert.match(routeSrc, /canWriteClass\(access, op\.classId\)/);
  assert.match(routeSrc, /"deletedAt" IS NULL/);
  assert.match(routeSrc, /"attendance_sync_operations"/);
  assert.match(routeSrc, /ON CONFLICT \("operationId"\) DO NOTHING/);
});

test('offline-db and sw.js isolate users and never cache APIs or auth routes', () => {
  const idbSrc = readFileSync(resolve(process.cwd(), 'app/lib/offline-db.ts'), 'utf8');
  assert.match(idbSrc, /userId/);
  assert.match(idbSrc, /clearOfflineData/);
  assert.match(idbSrc, /clearUserOfflineData/);
  assert.match(idbSrc, /txComplete/);
  assert.doesNotMatch(idbSrc, /localStorage/);

  const swSrc = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
  assert.match(swSrc, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(swSrc, /NO_CACHE_PAGE_PREFIXES/);
  assert.match(swSrc, /CLEAR_DATA/);
});
