import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('provisioning cron endpoint is secret-guarded, rate-limited, and logs safely', () => {
  const route = read('app/api/super-admin/provision/route.ts');

  // Must require a secret
  assert.match(route, /PROVISIONING_CRON_SECRET/);
  // Timing-safe comparison
  assert.match(route, /safeEqual/);
  // Rate limiting
  assert.match(route, /rateLimit/);
  // Bearer token extraction
  assert.match(route, /Bearer/);
  // Must call processPendingProvisioningJobs
  assert.match(route, /processPendingProvisioningJobs/);
  // No raw error messages leaked
  assert.match(route, /error\.name/);
  assert.doesNotMatch(route, /error\.message.*response/i);
  // No-store caching
  assert.match(route, /no-store/);
  // Returns 503 when not configured (not 200)
  assert.match(route, /503/);
  // Vercel cron-compatible GET handler
  assert.match(route, /export async function GET/);
});

test('vercel.json registers a cron for the provisioning endpoint', () => {
  const vercelConfig = JSON.parse(read('vercel.json'));

  assert.ok(Array.isArray(vercelConfig.crons), 'crons array must exist');
  const cronEntry = vercelConfig.crons.find((c) => c.path === '/api/super-admin/provision');
  assert.ok(cronEntry, '/api/super-admin/provision must be in crons');
  assert.ok(typeof cronEntry.schedule === 'string', 'schedule must be a string');
});

test('new church registration starts provisioning immediately and keeps the cron as a fallback', () => {
  const route = read('app/api/public/[...segments]/route.ts');

  assert.match(route, /import \{ NextResponse, after \} from "next\/server"/);
  assert.match(route, /after\(async \(\) => \{/);
  assert.match(route, /provisionChurch\(result\.jobId/);
  assert.match(route, /type: "public"/);
  assert.match(route, /export const maxDuration = 300/);
  assert.match(read('app/api/super-admin/provision/route.ts'), /process\.env\.CRON_SECRET/);
});

test('register route activates the account without sending email verification', () => {
  const route = read('app/api/auth/register/route.ts');

  assert.match(route, /VALUES \(uuid_generate_v4\(\), \$1, \$2, false, true/);
  assert.match(route, /requiresEmailVerification: false/);
  assert.match(route, /issueRefreshToken/);
  assert.doesNotMatch(route, /sendVerificationEmail|createOtp/);
  // Guards registration may roll back a half-provisioned class-leader account.
  assert.match(route, /const rollbackRegistration = async \(\) => \{/);
  assert.match(route, /claimClassLeadership/);
});

test('register route validates church code length before DB query', () => {
  const route = read('app/api/auth/register/route.ts');

  // Length guard prevents oversized inputs from reaching the DB
  assert.match(route, /rawChurchCode\.length > 64/);
  // Mismatch check: code must resolve to the same church as the explicit slug
  assert.match(route, /explicitSlug !== codeRow\.slug/);
});

test('provisioning never activates church without tenant identity verification', () => {
  const provisioning = read('src/server/platform/provisioning.ts');

  // Tenant identity is verified before activate step
  assert.match(provisioning, /TENANT_IDENTITY_MISMATCH/);
  assert.match(provisioning, /tenant_identity.*LIMIT 1/s);
  // Church is only set active after the identity check passes
  const activateIdx = provisioning.indexOf("SET \"status\" = 'active'");
  const identityIdx = provisioning.indexOf('TENANT_IDENTITY_MISMATCH');
  assert.ok(identityIdx < activateIdx, 'identity check must come before church activation');
  // Concurrency: claimJob uses an atomic UPDATE with a WHERE predicate
  assert.match(provisioning, /status.*IN.*'queued'.*'failed'/s);
  assert.match(provisioning, /lockedAt.*now\(\) - interval '15 minutes'/s);
  // The cron selector also reclaims jobs stuck in `running` after a timeout.
  assert.match(provisioning, /OR \("status" = 'running'/);
});
