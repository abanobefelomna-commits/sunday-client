import test from 'node:test';
import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';
import * as argon2 from 'argon2';
import { databaseUrl, loadEnv } from '../helpers/env.mjs';
import { isSamePostgresDatabase } from '../../scripts/lib/postgres-url.mjs';

loadEnv();

/**
 * These tests intentionally reset the singleton Super Admin credential, so
 * they must NEVER run against a shared/production platform database.
 *
 * Provide a disposable database (same Neon project or any Postgres) and apply
 * platform migrations 001-005 to it, then point this variable at it:
 *
 *   PLATFORM_DATABASE_URL=postgres://.../super_admin_test npm run db:migrate:platform
 *   SUPER_ADMIN_TEST_DATABASE_URL=postgres://.../super_admin_test npm run test:super-admin
 *
 * The test refuses to start if the target already contains churches. The
 * `npm test` scripts already load the extensionless-TypeScript resolver used by
 * the Next.js bundler.
 */
const platformDbUrl = process.env.SUPER_ADMIN_TEST_DATABASE_URL?.trim() || '';
const tenantDbUrl = databaseUrl();
const sameAsTenant = Boolean(
  platformDbUrl && tenantDbUrl && isSamePostgresDatabase(platformDbUrl, tenantDbUrl),
);
if (platformDbUrl && !sameAsTenant) {
  // Server modules read the canonical variable; point it at the test database
  // only after the explicit safety checks above.
  process.env.PLATFORM_DATABASE_URL = platformDbUrl;
}
const skipPlatform = !platformDbUrl
  ? 'SUPER_ADMIN_TEST_DATABASE_URL is not configured (destructive tests require a disposable database)'
  : sameAsTenant
    ? 'SUPER_ADMIN_TEST_DATABASE_URL must not be the tenant database'
    : false;

function createRetryingClient(url) {
  const raw = neon(url);
  return async function query(sqlText, params = []) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await raw.query(sqlText, params);
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
    throw lastError;
  };
}

const platformQuery = platformDbUrl ? createRetryingClient(platformDbUrl) : null;

test('Super Admin & Church Creation Authorization System', { skip: skipPlatform }, async (t) => {
  // Import server functions dynamically to test real logic
  const {
    isSuperAdminSetupCompleted,
    setupSuperAdmin,
    authenticateSuperAdminPassword,
    issueSuperAdminSession,
    refreshSuperAdminSession,
    revokeSuperAdminSession,
    verifySuperAdminAccessToken,
  } = await import('../../src/server/super-admin/auth.ts');

  const {
    createChurchCreationCode,
    listChurchCreationCodes,
    revokeChurchCreationCode,
    rotateChurchCreationCode,
    validateAndConsumeCreationCode,
    hashCreationCode,
  } = await import('../../src/server/super-admin/codes.ts');

  const { registerChurch } = await import('../../src/server/platform/churches.ts');

  // Hard safety rail: a disposable platform DB has no churches. Refuse to
  // erase credentials if this looks like a live/shared database.
  const [{ count: existingChurches }] = await platformQuery(
    'SELECT COUNT(*)::int AS "count" FROM "churches"',
  );
  assert.equal(
    existingChurches,
    0,
    'Refusing destructive Super Admin tests: target database already contains churches',
  );

  // Clear any existing test credentials for isolated test run
  await platformQuery('DELETE FROM "super_admin_sessions"');
  await platformQuery('DELETE FROM "super_admin_auth_attempts"');
  await platformQuery('DELETE FROM "super_admin_credentials"');
  await platformQuery('DELETE FROM "church_creation_codes" WHERE "note" LIKE $1', ['test-%']);

  const TEST_MASTER_PASSWORD = 'SuperSecurePassword2026!';
  let generatedCode;

  await t.test('1. Initial setup status reports false when no master password is set', async () => {
    const isSetup = await isSuperAdminSetupCompleted();
    assert.equal(isSetup, false, 'Setup must be false before initial setup');
  });

  await t.test('2. Initial setup rejects mismatched or weak passwords', async () => {
    await assert.rejects(
      () => setupSuperAdmin('Short1!', 'Different2!'),
      (err) => err.code === 'PASSWORDS_DO_NOT_MATCH',
    );

    await assert.rejects(
      () => setupSuperAdmin('weak', 'weak'),
      (err) => err.code === 'PASSWORD_TOO_WEAK',
    );
  });

  await t.test('3. First-time setup succeeds and stores only Argon2id hash', async () => {
    const result = await setupSuperAdmin(TEST_MASTER_PASSWORD, TEST_MASTER_PASSWORD, '127.0.0.1');
    assert.equal(result.success, true);

    const isSetup = await isSuperAdminSetupCompleted();
    assert.equal(isSetup, true);

    const rows = await platformQuery('SELECT * FROM "super_admin_credentials" WHERE "isSingleton" = true');
    assert.equal(rows.length, 1);
    assert.match(rows[0].passwordHash, /^\$argon2id\$/);
    assert.notEqual(rows[0].passwordHash, TEST_MASTER_PASSWORD);

    // Verify hash can be verified by argon2
    const matches = await argon2.verify(rows[0].passwordHash, TEST_MASTER_PASSWORD);
    assert.equal(matches, true);
  });

  await t.test('4. Second-time setup is rejected atomically', async () => {
    await assert.rejects(
      () => setupSuperAdmin('NewPassword2026#', 'NewPassword2026#'),
      (err) => err.code === 'SETUP_ALREADY_COMPLETED' || err.status === 409,
    );
  });

  await t.test('5. Singleton constraint prevents concurrent duplicate inserts in DB', async () => {
    let singletonBlocked = false;
    try {
      await platformQuery(
        `INSERT INTO "super_admin_credentials" ("id", "isSingleton", "passwordHash")
         VALUES (uuid_generate_v4(), true, 'fake_hash')`,
      );
    } catch (err) {
      singletonBlocked = true;
      assert.match(err.message, /unique|duplicate|violat/i);
    }
    assert.equal(singletonBlocked, true, 'Singleton constraint must block second record');
  });

  await t.test('6. Authentication succeeds with valid password and fails with invalid', async () => {
    const valid = await authenticateSuperAdminPassword(TEST_MASTER_PASSWORD);
    assert.equal(valid, true, 'Must succeed with correct master password');

    const invalid = await authenticateSuperAdminPassword('WrongPassword123');
    assert.equal(invalid, false, 'Must fail with wrong master password');
  });

  await t.test('7. Super admin session issuance, token verification, and refresh work', async () => {
    const session = await issueSuperAdminSession({ ip: '127.0.0.1', userAgent: 'test-agent' });
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);

    // Verify JWT payload
    const payload = await verifySuperAdminAccessToken(session.accessToken);
    assert.ok(payload);
    assert.equal(payload.sub, 'super-admin');
    assert.equal(payload.role, 'super_admin');
    assert.equal(payload.typ, 'super_admin_access');

    // Test session refresh
    const refreshed = await refreshSuperAdminSession(session.refreshToken, { ip: '127.0.0.1' });
    assert.ok(refreshed);
    assert.notEqual(refreshed.accessToken, session.accessToken);
    assert.notEqual(refreshed.refreshToken, session.refreshToken);

    // Test logout / session revocation
    await revokeSuperAdminSession(refreshed.refreshToken);

    // Revoked refresh token cannot be used again
    const afterRevocation = await refreshSuperAdminSession(refreshed.refreshToken);
    assert.equal(afterRevocation, null, 'Revoked refresh token must be rejected');
  });

  await t.test('8. Church creation code generation stores secure hash and prefix', async () => {
    const created = await createChurchCreationCode({
      note: 'test-church-code-1',
      maxUses: 2,
      expiresInDays: 7,
      ip: '127.0.0.1',
    });

    assert.ok(created.id);
    assert.match(created.code, /^CC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(created.codePrefix, created.code.slice(0, 7));
    assert.equal(created.maxUses, 2);

    generatedCode = created;

    // Check database row: full plaintext code must NOT be stored
    const rows = await platformQuery('SELECT * FROM "church_creation_codes" WHERE "id" = $1', [created.id]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].codeHash, created.code);
    assert.equal(rows[0].codeHash, hashCreationCode(created.code));
    assert.equal(rows[0].codePrefix, created.codePrefix);
    assert.equal(rows[0].status, 'active');
    assert.equal(rows[0].usedCount, 0);
  });

  await t.test('9. Listing church creation codes never exposes raw code or hash', async () => {
    const list = await listChurchCreationCodes();
    const found = list.find((c) => c.id === generatedCode.id);
    assert.ok(found);
    assert.equal(found.codePrefix, generatedCode.codePrefix);
    assert.equal(Object.hasOwn(found, 'codeHash'), false);
    assert.equal(Object.hasOwn(found, 'code'), false);
  });

  await t.test('10. Church creation without creation code is rejected', async () => {
    await assert.rejects(
      () =>
        registerChurch({
          churchName: 'Test Church Without Code',
          contactName: 'Abanoub',
          contactEmail: 'abanoub.nocode@example.com',
          adminName: 'Mina',
          adminEmail: 'mina.nocode@example.com',
          adminPhone: '+201012345678',
          adminPassword: 'Password12345!',
          acceptTerms: true,
          acceptPrivacy: true,
        }),
      (err) => err.code === 'CREATION_CODE_REQUIRED' || err.status === 403,
    );
  });

  await t.test('11. Church creation with invalid creation code is rejected', async () => {
    await assert.rejects(
      () =>
        registerChurch({
          churchName: 'Test Church Invalid Code',
          contactName: 'Abanoub',
          contactEmail: 'abanoub.badcode@example.com',
          adminName: 'Mina',
          adminEmail: 'mina.badcode@example.com',
          adminPhone: '+201012345679',
          adminPassword: 'Password12345!',
          creationCode: 'CC-FAKE-CODE-1234',
          acceptTerms: true,
          acceptPrivacy: true,
        }),
      (err) => err.code === 'INVALID_CREATION_CODE' || err.status === 403,
    );
  });

  await t.test('12. Church creation with valid code succeeds, consumes code, and associates creator', async () => {
    const slug = `test-church-${Date.now().toString().slice(-6)}`;

    const result = await registerChurch({
      churchName: `Test Saint Mary ${slug}`,
      slug,
      contactName: 'Father Bishoy',
      contactEmail: `bishoy.${slug}@example.com`,
      adminName: 'Servant Mina',
      adminEmail: `mina.${slug}@example.com`,
      adminPhone: '+201099887766',
      adminPassword: 'StrongPassword2026!',
      creationCode: generatedCode.code,
      acceptTerms: true,
      acceptPrivacy: true,
    });

    assert.ok(result.churchId);
    assert.equal(result.slug, slug);

    // Verify church record has creator info and code reference
    const [church] = await platformQuery(
      `SELECT "id", "creationCodeId", "creatorName", "creatorEmail" FROM "churches" WHERE "id" = $1`,
      [result.churchId],
    );
    assert.equal(church.creationCodeId, generatedCode.id);
    assert.equal(church.creatorName, 'Servant Mina');
    assert.equal(church.creatorEmail, `mina.${slug}@example.com`);

    // Verify creation code usage count incremented
    const [codeRow] = await platformQuery(
      `SELECT "usedCount", "maxUses", "status" FROM "church_creation_codes" WHERE "id" = $1`,
      [generatedCode.id],
    );
    assert.equal(codeRow.usedCount, 1);
    assert.equal(codeRow.status, 'active'); // maxUses was 2
  });

  await t.test('13. Code reaches depleted status when maxUses is exhausted', async () => {
    const slug = `test-church2-${Date.now().toString().slice(-6)}`;

    // Use second and final usage of code
    await registerChurch({
      churchName: `Test Saint George ${slug}`,
      slug,
      contactName: 'Father George',
      contactEmail: `george.${slug}@example.com`,
      adminName: 'Servant Mark',
      adminEmail: `mark.${slug}@example.com`,
      adminPhone: '+201099887755',
      adminPassword: 'StrongPassword2026!',
      creationCode: generatedCode.code,
      acceptTerms: true,
      acceptPrivacy: true,
    });

    const [codeRow] = await platformQuery(
      `SELECT "usedCount", "maxUses", "status" FROM "church_creation_codes" WHERE "id" = $1`,
      [generatedCode.id],
    );
    assert.equal(codeRow.usedCount, 2);
    assert.equal(codeRow.status, 'depleted');

    // Attempting a third usage must fail
    await assert.rejects(
      () =>
        registerChurch({
          churchName: `Test Church 3 ${slug}`,
          contactName: 'Father John',
          contactEmail: `john.${slug}@example.com`,
          adminName: 'Servant Peter',
          adminEmail: `peter.${slug}@example.com`,
          adminPhone: '+201099887744',
          adminPassword: 'StrongPassword2026!',
          creationCode: generatedCode.code,
          acceptTerms: true,
          acceptPrivacy: true,
        }),
      (err) => err.code === 'INVALID_CREATION_CODE' || err.status === 403,
    );

    // Clean up test churches
    await platformQuery('DELETE FROM "provisioning_jobs" WHERE "churchId" IN (SELECT "id" FROM "churches" WHERE "slug" LIKE $1)', ['test-church%']);
    await platformQuery('DELETE FROM "church_codes" WHERE "churchId" IN (SELECT "id" FROM "churches" WHERE "slug" LIKE $1)', ['test-church%']);
    await platformQuery('DELETE FROM "churches" WHERE "slug" LIKE $1', ['test-church%']);
  });

  await t.test('14. Rotating and revoking creation codes', async () => {
    const singleCode = await createChurchCreationCode({
      note: 'test-code-to-rotate',
      maxUses: 1,
      ip: '127.0.0.1',
    });

    // Rotate
    const rotated = await rotateChurchCreationCode(singleCode.id, '127.0.0.1');
    assert.ok(rotated);
    assert.notEqual(rotated.code, singleCode.code);

    // Old code must now be revoked
    const [oldRow] = await platformQuery('SELECT "status" FROM "church_creation_codes" WHERE "id" = $1', [singleCode.id]);
    assert.equal(oldRow.status, 'revoked');

    // Revoking the rotated code
    const revoked = await revokeChurchCreationCode(rotated.id, '127.0.0.1');
    assert.equal(revoked, true);

    const [revokedRow] = await platformQuery('SELECT "status" FROM "church_creation_codes" WHERE "id" = $1', [rotated.id]);
    assert.equal(revokedRow.status, 'revoked');

    // Using a revoked code fails
    await assert.rejects(
      () =>
        validateAndConsumeCreationCode(rotated.code, '00000000-0000-0000-0000-000000000000', {
          name: 'Tester',
          email: 'tester@example.com',
        }),
      (err) => err.code === 'INVALID_CREATION_CODE' || err.status === 403,
    );

    // Cleanup
    await platformQuery('DELETE FROM "church_creation_codes" WHERE "note" LIKE $1', ['test-%']);
  });
});
