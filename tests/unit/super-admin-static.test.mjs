import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routeFiles = readdirSync(resolve(process.cwd(), 'app/api/super-admin'), {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name === 'route.ts')
  .map((entry) => resolve(entry.parentPath, entry.name));

test('every privileged Super Admin route uses the dedicated guard', () => {
  // `setup`, `login`, and `status` are intentionally unauthenticated. `logout`
  // is idempotent session teardown: it only revokes the tokens the caller
  // presents and is CSRF-protected with requireSameOrigin.
  const publicRoutes = new Set(['setup', 'login', 'status', 'logout']);
  assert.ok(routeFiles.length >= 8, 'expected all Super Admin route handlers');

  for (const file of routeFiles) {
    const relative = file.replaceAll('\\', '/');
    const isPublic = [...publicRoutes].some((name) =>
      relative.includes(`/api/super-admin/${name}/route.ts`),
    );
    const source = read(file);
    if (isPublic) {
      assert.doesNotMatch(source, /requireSuperAdmin/, `${relative} must stay public`);
    } else {
      assert.match(source, /requireSuperAdmin/, `${relative} must call requireSuperAdmin`);
      assert.match(source, /applySuperAdminRefreshCookies/, `${relative} must persist rotated cookies`);
    }
  }

  const logout = read('app/api/super-admin/logout/route.ts');
  assert.match(logout, /requireSameOrigin/);
  assert.match(logout, /revokeSuperAdminSession/);
});

test('the guard rejects unauthenticated requests and supports revocation', () => {
  const source = read('src/server/super-admin/guard.ts');

  assert.match(source, /if \(!auth\.authenticated \|\| !auth\.user\)/);
  assert.match(source, /status: 401/);
  assert.match(source, /isSuperAdminAccessSessionActive\(accessToken\)/);
  assert.match(source, /cookies\.get\(SUPER_ADMIN_COOKIE_REFRESH\)/);
});

test('Super Admin credentials are Argon2id only and never returned', () => {
  const source = read('src/server/super-admin/auth.ts');
  const sql = read('db/platform/004_super_admin.sql');

  assert.match(source, /argon2\.hash\(password, \{ type: argon2\.argon2id \}\)/);
  assert.match(source, /argon2\.verify\(record\.passwordHash, password\)/);
  assert.match(sql, /UNIQUE \("isSingleton"\)/);
  assert.match(source, /setupSuperAdmin/);
  assert.match(source, /SETUP_ALREADY_COMPLETED/);
  assert.doesNotMatch(source, /defaultPassword|DEFAULT_PASSWORD|masterPassword\s*=/);
  assert.doesNotMatch(source, /return\s+\{[^}]*passwordHash/);
});

test('session cookies are HttpOnly, Secure in production, and SameSite-scoped', () => {
  const source = read('src/server/super-admin/auth.ts');

  assert.match(source, /httpOnly: true/);
  assert.match(source, /secure: isProduction\(\)/);
  assert.match(source, /sameSite: 'lax' as const/);
  assert.match(source, /sameSite: 'strict' as const/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test('refresh rotation, logout revocation, and durable rate limiting are enforced', () => {
  const source = read('src/server/super-admin/auth.ts');

  assert.match(source, /UPDATE "super_admin_sessions"[\s\S]*RETURNING "id"/);
  assert.match(source, /revokeSuperAdminSession/);
  assert.match(source, /super_admin_auth_attempts/);
  assert.match(source, /SUPER_ADMIN_MAX_FAILED_ATTEMPTS/);
  assert.match(source, /recordSuperAdminFailedAttempt/);
  assert.match(source, /checkSuperAdminAttemptLimit/);

  const setup = read('app/api/super-admin/setup/route.ts');
  const login = read('app/api/super-admin/login/route.ts');
  assert.match(setup, /requireSameOrigin/);
  assert.match(login, /requireSameOrigin/);
  assert.match(setup, /checkSuperAdminAttemptLimit\('setup'/);
  assert.match(login, /checkSuperAdminAttemptLimit\('login'/);
});

test('dashboard is protected before rendering and uses no client token storage', () => {
  const proxy = read('proxy.ts');
  const dashboard = read('app/super-admin/dashboard/page.tsx');

  assert.match(proxy, /\/super-admin\/dashboard/);
  assert.match(proxy, /super_admin_access_token/);
  assert.match(proxy, /redirect\(new URL\("\/super-admin\/access"/);
  assert.match(dashboard, /fetch\("\/api\/super-admin\/me"/);
  assert.doesNotMatch(dashboard, /localStorage|sessionStorage/);
});

test('platform migration stores only creation-code hashes and is additive', () => {
  const sql = read('db/platform/004_super_admin.sql');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS "super_admin_credentials"/);
  assert.match(sql, /UNIQUE \("isSingleton"\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "super_admin_sessions"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "super_admin_auth_attempts"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "church_creation_codes"/);
  assert.match(sql, /"codeHash" varchar\(64\) NOT NULL UNIQUE/);
  assert.doesNotMatch(sql, /"code"\s+varchar\([^)]*\)\s+NOT NULL[^;]*-- plaintext/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "creationCodeId"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "creatorName"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "creatorEmail"/);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)/i);
  assert.doesNotMatch(sql, /TRUNCATE/i);
});

test('church registration consumes the code atomically and records the creator', () => {
  const source = read('src/server/platform/churches.ts');
  const registrationRoute = read('app/api/public/[...segments]/route.ts');

  assert.match(source, /CREATION_CODE_REQUIRED/);
  assert.match(source, /INVALID_CREATION_CODE/);
  assert.match(source, /WITH consumed AS/);
  assert.match(source, /UPDATE "church_creation_codes"/);
  assert.match(source, /FROM consumed/);
  assert.match(source, /"creationCodeId", "creatorName", "creatorEmail"/);
  assert.match(source, /created\.length === 0/);

  assert.match(registrationRoute, /registerChurch\(\{ \.\.\.payload, ip \}\)/);
  assert.match(registrationRoute, /rateLimit\(`church-registrations:\$\{ip\}`/);
});

test('assistant composer auto-resizes and preserves keyboard sending', () => {
  const source = read('app/assistant/page.tsx');

  assert.match(source, /scrollHeight/);
  assert.match(source, /useIsomorphicLayoutEffect/);
  assert.match(source, /addEventListener\("resize", resizeComposer\)/);
  assert.match(source, /COMPOSER_MAX_HEIGHT/);
  assert.match(source, /e\.key === "Enter" && !e\.shiftKey/);
  assert.match(source, /disabled=\{!input\.trim\(\) && pendingAttachments\.length === 0\}/);
});
