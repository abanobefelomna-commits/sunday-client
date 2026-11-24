import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('Super Admin join-code endpoints are guarded and write operations are same-origin protected', () => {
  const listRoute = read('app/api/super-admin/church-join-codes/route.ts');
  const churchRoute = read('app/api/super-admin/church-join-codes/[churchId]/route.ts');

  assert.match(listRoute, /requireSuperAdmin/);
  assert.match(listRoute, /Cache-Control.*no-store/);
  assert.match(churchRoute, /requireSuperAdmin/);
  assert.equal((churchRoute.match(/requireSameOrigin\(req\)/g) || []).length, 2);
  assert.match(churchRoute, /UUID_PATTERN/);
  assert.match(churchRoute, /body\.action !== 'rotate'/);
});

test('join-code management reuses church_codes and never audits plaintext codes', () => {
  const service = read('src/server/super-admin/church-join-codes.ts');

  assert.match(service, /FROM "church_codes"/);
  assert.match(service, /UPDATE "church_codes"/);
  assert.match(service, /INSERT INTO "church_codes"/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /church_join_code\.rotated/);
  assert.match(service, /church_join_code\.revoked/);
  assert.match(service, /'join'.*'admin'.*'priest'/s);
  assert.match(service, /"purpose" = \$2/);
  assert.doesNotMatch(service, /after:\s*\{[^}]*code\s*[,}]/);
  assert.match(service, /WHERE c\."status" <> 'archived'/);
});

test('dashboard distinguishes church join codes from church creation codes', () => {
  const dashboard = read('app/super-admin/dashboard/page.tsx');

  assert.match(dashboard, /رموز إنشاء الكنائس/);
  assert.match(dashboard, /رموز الكنائس لكل دور/);
  assert.match(dashboard, /رمز تسجيل للمسؤول/);
  assert.match(dashboard, /رمز تسجيل للأب الكاهن/);
  assert.match(dashboard, /\/api\/super-admin\/church-join-codes/);
  assert.match(dashboard, /church\.purpose/);
  assert.match(dashboard, /لن يؤثر ذلك على الحسابات الحالية/);
});

test('join and role codes are checked centrally and privileged roles have no grade assignment', () => {
  const registration = read('app/api/auth/register/route.ts');
  const codeLookup = read('app/api/auth/church-code/route.ts');
  const publicProxy = read('app/api/public/[...segments]/route.ts');
  const joinFlow = read('app/join/join-church-flow.tsx');
  const registerPage = read('app/register/page.tsx');

  assert.match(codeLookup, /cc\."revoked" = false/);
  assert.match(codeLookup, /cc\."purpose" = 'join'/);
  assert.match(codeLookup, /c\."status" = 'active'/);
  assert.match(publicProxy, /c\."slug" = \$2/);
  assert.match(registration, /explicitSlug !== codeRow\.slug/);
  assert.match(registration, /VALUES \(uuid_generate_v4\(\), \$1, \$2, false, true/);
  assert.match(registration, /accountRole = 'admin'/);
  assert.match(registration, /accountRole = 'priest'/);
  assert.match(registration, /const assignedGrades: string\[\] = isPrivileged \? \[\]/);
  assert.match(registration, /"purpose" = \$2/);
  assert.doesNotMatch(registration, /body\.role(?:\s|=)/);
  assert.match(joinFlow, /\/register\?church=/);
  assert.match(joinFlow, /sessionStorage\.setItem\("churchJoinCode"/);
  assert.match(joinFlow, /router\.push\(`\/register\?church=/);
  assert.doesNotMatch(joinFlow, /join-requests/);
  assert.doesNotMatch(joinFlow, /register\?church=[^`]*code=/);
  assert.match(registerPage, /sessionStorage\.removeItem\("churchJoinCode"\)/);
  assert.match(registerPage, /churchSlug: churchSlug \|\| requestedChurchSlug/);
  assert.match(registerPage, /router\.push\("\/dashboard"\)/);
  assert.doesNotMatch(registerPage, /verify-email\?email=/);
});

