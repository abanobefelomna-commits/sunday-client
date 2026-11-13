import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PlatformConfigurationError,
  getPlatformDatabaseUrl,
  isPlatformConfigurationError,
  isSamePostgresDatabase,
  postgresDatabaseIdentity,
} from '../../src/server/platform/config.ts';

const TENANT_URL =
  'postgresql://user:pass@ep-cool-db-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
const PLATFORM_URL =
  'postgresql://user:pass@ep-cool-db-pooler.us-east-2.aws.neon.tech/sunday_platform?sslmode=require';
const PLATFORM_DIRECT_URL =
  'postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/sunday_platform?sslmode=require';

const MANAGED_KEYS = [
  'NODE_ENV',
  'PLATFORM_DATABASE_URL',
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'ALLOW_SHARED_PLATFORM_DATABASE',
];

let saved = {};

test.beforeEach(() => {
  saved = Object.fromEntries(MANAGED_KEYS.map((key) => [key, process.env[key]]));
  for (const key of MANAGED_KEYS) delete process.env[key];
});

test.afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test('production refuses to fall back to the tenant database', () => {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = TENANT_URL;

  assert.throws(
    () => getPlatformDatabaseUrl(),
    (error) =>
      isPlatformConfigurationError(error) &&
      error.code === 'PLATFORM_DATABASE_URL_MISSING',
  );
});

test('production accepts an explicit dedicated platform database', () => {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = TENANT_URL;
  process.env.PLATFORM_DATABASE_URL = PLATFORM_URL;

  assert.equal(getPlatformDatabaseUrl(), PLATFORM_URL);
});

test('production rejects a platform URL that resolves to the tenant database', () => {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = TENANT_URL;
  process.env.PLATFORM_DATABASE_URL = TENANT_URL;

  assert.throws(
    () => getPlatformDatabaseUrl(),
    (error) =>
      isPlatformConfigurationError(error) &&
      error.code === 'PLATFORM_DATABASE_URL_SHARED',
  );
});

test('pooled and direct Neon hosts with the same database name are rejected', () => {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = TENANT_URL;
  process.env.PLATFORM_DATABASE_URL = TENANT_URL.replace('-pooler', '');

  assert.throws(
    () => getPlatformDatabaseUrl(),
    (error) => isPlatformConfigurationError(error) && error.code === 'PLATFORM_DATABASE_URL_SHARED',
  );
});

test('a distinct database on the same Neon endpoint is accepted', () => {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = TENANT_URL;
  process.env.PLATFORM_DATABASE_URL = PLATFORM_DIRECT_URL;

  assert.equal(getPlatformDatabaseUrl(), PLATFORM_DIRECT_URL);
});

test('invalid platform URLs fail with a configuration error', () => {
  process.env.NODE_ENV = 'production';
  process.env.PLATFORM_DATABASE_URL = 'mysql://user:pass@example.com/platform';

  assert.throws(
    () => getPlatformDatabaseUrl(),
    (error) =>
      isPlatformConfigurationError(error) &&
      error.code === 'PLATFORM_DATABASE_URL_INVALID',
  );
});

test('development requires an explicit opt-in before sharing the tenant database', () => {
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = TENANT_URL;

  assert.throws(
    () => getPlatformDatabaseUrl(),
    (error) => isPlatformConfigurationError(error) && error.code === 'PLATFORM_DATABASE_URL_MISSING',
  );

  process.env.ALLOW_SHARED_PLATFORM_DATABASE = 'true';
  assert.equal(getPlatformDatabaseUrl(), TENANT_URL);
});

test('the shared-database opt-in is ignored in production', () => {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = TENANT_URL;
  process.env.ALLOW_SHARED_PLATFORM_DATABASE = 'true';

  assert.throws(
    () => getPlatformDatabaseUrl(),
    (error) => isPlatformConfigurationError(error) && error.code === 'PLATFORM_DATABASE_URL_MISSING',
  );
});

test('database identity normalizes the Neon pooler suffix and database case', () => {
  assert.equal(
    postgresDatabaseIdentity(TENANT_URL),
    'ep-cool-db.us-east-2.aws.neon.tech:5432/neondb',
  );
  assert.equal(
    postgresDatabaseIdentity(PLATFORM_URL),
    'ep-cool-db.us-east-2.aws.neon.tech:5432/sunday_platform',
  );
  assert.equal(isSamePostgresDatabase(TENANT_URL, TENANT_URL.replace('-pooler', '')), true);
  assert.equal(isSamePostgresDatabase(TENANT_URL, PLATFORM_URL), false);
});

test('PlatformConfigurationError is detectable across module boundaries', () => {
  const original = new PlatformConfigurationError('SOME_CODE', 'safe message');
  const cloned = new Error('safe message');
  cloned.name = 'PlatformConfigurationError';
  cloned.code = 'SOME_CODE';

  assert.equal(isPlatformConfigurationError(original), true);
  assert.equal(isPlatformConfigurationError(cloned), true);
  assert.equal(isPlatformConfigurationError(new Error('other')), false);
  assert.equal(isPlatformConfigurationError(null), false);
});
