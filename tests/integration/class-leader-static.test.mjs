import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

const access = read('src/server/access.ts');
const middleware = read('src/server/middleware.ts');
const servantsRoute = read('app/api/servants/route.ts');
const servantDetailRoute = read('app/api/servants/[id]/route.ts');
const registerRoute = read('app/api/auth/register/route.ts');
const classDetailRoute = read('app/api/classes/[id]/route.ts');
const childrenDetailRoute = read('app/api/children/[id]/route.ts');
const dashboardPage = read('app/dashboard/page.tsx');
const servantsPage = read('app/servants/page.tsx');
const classDetailPage = read('app/classes/[id]/page.tsx');
const integrityMigration = read('db/tenant/010_class_leader_integrity.sql');
const studentNotes = read('src/server/student-notes.ts');

test('access context exposes led classes and keeps leaders scoped in legacy churches', () => {
  assert.match(access, /CLASS_LEADER_SERVANT_ROLE = 'قائد فصل'/);
  assert.match(access, /ledClassIds\?: string\[\]/);
  assert.match(access, /export function isClassLeaderAccess/);
  assert.match(access, /export function effectiveClassIds/);
  assert.match(access, /export function readScopeClassIds/);
  assert.match(access, /export function canManageServantsInClass/);
  assert.match(access, /export function canManageServantRecord/);
  assert.match(access, /export function canAssignServantRole/);
  assert.match(access, /isClassLeaderAccess\(access\)\) return false/);
  assert.match(
    middleware,
    /SELECT "id" FROM "classes" WHERE "leadServantId" = \$1/,
  );
  assert.match(middleware, /ledClassIds: \[\.\.\.new Set\(led\.map/);
});

test('servant APIs authorize every record by led class and blocked role changes', () => {
  assert.match(servantsRoute, /isClassLeaderAccess\(access\)/);
  assert.match(servantsRoute, /access\.ledClassIds \?\? \[\]/);
  assert.match(servantsRoute, /canAssignServantRole\(access, roleCode\)/);
  assert.match(servantsRoute, /if \(!broadManager\)/);
  assert.match(servantsRoute, /claimClassLeadership/);

  assert.match(servantDetailRoute, /canManageServantRecord\(access, record\)/);
  assert.match(servantDetailRoute, /canAssignServantRole\(access, code\)/);
  assert.match(access, /if \(record\.role !== 'خادم'\) return false/);
  assert.match(servantDetailRoute, /requestedClassIds\.length !== 1/);
  assert.match(servantDetailRoute, /reconcileServantLeadership\(id, finalRole\)/);
});

test('servant deletion removes the row and linked regular account from the database', () => {
  assert.match(servantDetailRoute, /await transaction\(statements\)/);
  assert.match(servantDetailRoute, /DELETE FROM "servants" WHERE "id" = \$1/);
  assert.match(servantDetailRoute, /DELETE FROM "users" WHERE "id" = \$1/);
  assert.match(servantDetailRoute, /DELETE FROM "servants_classes" WHERE "servantsId" = \$1/);
  assert.match(servantDetailRoute, /UPDATE "classes" SET "leadServantId" = NULL/);
  assert.match(servantDetailRoute, /action: 'servant\.delete'/);
});

test('child deletion is permanent and relies on cascading dependent rows', () => {
  assert.match(childrenDetailRoute, /DELETE FROM "children" WHERE "id" = \$1/);
  assert.doesNotMatch(childrenDetailRoute, /SET "deletedAt" = now\(\)/);
  assert.match(childrenDetailRoute, /action: 'student\.delete'/);
});

test('note deletion removes the row from the database', () => {
  assert.match(studentNotes, /DELETE FROM "student_notes"/);
  assert.doesNotMatch(studentNotes, /UPDATE "student_notes" SET "deletedAt"/);
});

test('class-leader registration claims exactly one vacant class and rolls back on failure', () => {
  assert.match(registerRoute, /servantRole === 'class_leader'/);
  assert.match(registerRoute, /assignedGrades\.length !== 1/);
  assert.match(registerRoute, /candidates\.length > 1/);
  assert.match(registerRoute, /classLeaderTarget/);
  assert.match(registerRoute, /claimClassLeadership\(servantRecord\.id, classLeaderTarget\.id\)/);
  assert.match(registerRoute, /rollbackRegistration/);
  assert.match(registerRoute, /ledClassIds: access\.ledClassIds \?\? \[\]/);
});

test('class updates validate the leader, enforce one class per leader, and promote roles', () => {
  assert.match(classDetailRoute, /otherLeadClassId/);
  assert.match(classDetailRoute, /قائد الفصل يجب أن يكون خادمًا معيّنًا لهذا الفصل/);
  assert.match(classDetailRoute, /لا يمكن تعيين مسؤول أو كاهن قائدًا لفصل/);
  assert.match(classDetailRoute, /SET "role" = 'قائد فصل'/);
  assert.match(classDetailRoute, /SET "role" = 'خادم'/);
});

test('migration 010 adds integrity constraints without deleting church data', () => {
  assert.match(integrityMigration, /UQ_classes_leadServantId/);
  assert.match(integrityMigration, /enforce_class_leader_membership/);
  assert.match(integrityMigration, /release_class_leader_on_membership_delete/);
  assert.match(integrityMigration, /reconcile_servant_role_scope/);
  assert.match(integrityMigration, /FK_attendance_recordedBy/);
  assert.match(integrityMigration, /VALIDATE CONSTRAINT/);
  assert.doesNotMatch(integrityMigration, /\b(DROP TABLE|TRUNCATE)\b/i);
  // Only servant-to-class memberships may be cleaned up by the leadership
  // release trigger; the migration never deletes church records themselves.
  assert.doesNotMatch(
    integrityMigration,
    /\bDELETE\s+FROM\s+"(children|servants|classes|users|attendance|visitations|follow_ups)"/i,
  );
});

test('role-aware UI exposes the class-leader workspace without admin controls', () => {
  assert.match(dashboardPage, /isClassLeaderUser/);
  assert.match(dashboardPage, /dashboard\.leaderWorkspace/);
  assert.match(dashboardPage, /leaderClasses/);
  assert.match(servantsPage, /canManageServantRecordUI\(currentUser, s\)/);
  assert.match(servantsPage, /visibleClasses/);
  assert.match(servantsPage, /!isLeader \|\| value === "خادم"/);
  assert.match(classDetailPage, /updateClass\(classData\.id, \{ leadServantId/);
  assert.match(classDetailPage, /canAssignLeader/);
});
