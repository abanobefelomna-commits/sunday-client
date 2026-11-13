#!/usr/bin/env node
/**
 * Read-only preflight for the central platform database and runtime config.
 *
 * Verifies:
 * - PLATFORM_DATABASE_URL is explicit and separate from the tenant database.
 * - Required platform tables and columns exist.
 * - Migration history is readable.
 * - Church/tenant connection records and UUIDs are intact.
 * - Encrypted tenant URLs decrypt with TENANT_SECRET_KEY and match their
 *   stored fingerprint.
 * - Production authentication secrets are present.
 * - With --deep, tenant identity rows match the platform registry and tenant
 *   databases contain no platform tables.
 *
 * This script never writes to either database and never prints credentials.
 */
import { createDecipheriv, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import {
  fingerprintConnectionUrl,
  isSamePostgresDatabase,
  parsePostgresUrl,
} from './lib/postgres-url.mjs';
import {
  REQUIRED_PLATFORM_COLUMNS,
  REQUIRED_PLATFORM_TABLES,
  REQUIRED_TENANT_COLUMNS,
} from './lib/platform-schema.mjs';

function loadEnv(file = '.env') {
  let source;
  try { source = readFileSync(resolve(process.cwd(), file), 'utf8'); } catch { return; }
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1) : rawValue;
  }
}
loadEnv();

const deep = process.argv.includes('--deep');
const problems = [];
const warnings = [];
const fail = (message) => problems.push(message);
const warn = (message) => warnings.push(message);

function tenantEncryptionKey() {
  const configured = (process.env.TENANT_SECRET_KEY || '').trim();
  if (/^[0-9a-f]{64}$/i.test(configured)) return Buffer.from(configured, 'hex');
  const decoded = Buffer.from(configured, 'base64');
  if (decoded.length === 32) return decoded;
  if (configured.length >= 32) return createHash('sha256').update(configured).digest();
  return null;
}

function decryptTenantUrl(encoded, key) {
  const parts = String(encoded || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('unsupported tenant secret format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3], 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

const platformUrl = process.env.PLATFORM_DATABASE_URL?.trim() || '';
const tenantUrl =
  process.env.DATABASE_URL?.trim() || process.env.DATABASE_URL_UNPOOLED?.trim() || '';

if (!platformUrl) {
  fail('PLATFORM_DATABASE_URL is not set. The platform database must be named explicitly.');
} else {
  try {
    const target = parsePostgresUrl(platformUrl, 'PLATFORM_DATABASE_URL');
    console.log(`Platform database preflight for database "${target.pathname.replace(/^\//, '')}"`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  if (tenantUrl && isSamePostgresDatabase(platformUrl, tenantUrl)) {
    fail('PLATFORM_DATABASE_URL resolves to the tenant database. Platform tables must not be created or queried there.');
  }
}

if (!tenantUrl) {
  warn('DATABASE_URL / DATABASE_URL_UNPOOLED is not set; tenant-side checks are limited.');
}

const requiredSecrets = [
  ['JWT_SECRET', 32],
  ['PLATFORM_JWT_SECRET', 32],
  ['OTP_SECRET', 32],
];
for (const [name, minLength] of requiredSecrets) {
  const value = process.env[name] || '';
  if (value.length < minLength) fail(`${name} must be set to at least ${minLength} characters in production.`);
}

const encryptionKey = tenantEncryptionKey();
if (!encryptionKey) {
  fail('TENANT_SECRET_KEY is missing or invalid; stored tenant connection URLs cannot be decrypted.');
}

if (process.env.ALLOW_SHARED_PLATFORM_DATABASE === 'true') {
  fail('ALLOW_SHARED_PLATFORM_DATABASE must not be enabled for the platform deployment.');
}
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  warn('SMTP is not fully configured; password-reset and OTP email delivery will not work.');
}

if (problems.length === 0) {
  const sql = neon(platformUrl);

  const tableRows = await sql.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [REQUIRED_PLATFORM_TABLES],
  );
  const tables = new Set(tableRows.map((row) => row.table_name));
  const missingTables = REQUIRED_PLATFORM_TABLES.filter((table) => !tables.has(table));
  if (missingTables.length > 0) {
    fail(`Missing required platform tables: ${missingTables.join(', ')}`);
  } else {
    console.log(`Required platform tables: ${REQUIRED_PLATFORM_TABLES.length}/${REQUIRED_PLATFORM_TABLES.length}`);
  }

  const columnTables = Object.keys(REQUIRED_PLATFORM_COLUMNS).filter((table) => tables.has(table));
  if (columnTables.length > 0) {
    const columnRows = await sql.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [columnTables],
    );
    const columnsByTable = new Map();
    for (const row of columnRows) {
      if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
      columnsByTable.get(row.table_name).add(row.column_name);
    }
    for (const [table, required] of Object.entries(REQUIRED_PLATFORM_COLUMNS)) {
      if (!tables.has(table)) continue;
      const present = columnsByTable.get(table) ?? new Set();
      const missing = required.filter((column) => !present.has(column));
      if (missing.length > 0) {
        fail(`Table "${table}" is missing required columns: ${missing.join(', ')}`);
      }
    }
  }

  if (tables.has('platform_migrations')) {
    const migrations = await sql.query(`SELECT "name" FROM "platform_migrations" ORDER BY "name"`);
    console.log(`Recorded platform migrations: ${migrations.map((row) => row.name).join(', ') || '(none)'}`);
  }

  if (tables.has('churches')) {
    const [counts] = await sql.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE "status" = 'active')::int AS active
       FROM "churches" WHERE "status" <> 'archived'`,
    );
    console.log(`Churches: ${counts?.total ?? 0} (active: ${counts?.active ?? 0})`);
    if ((counts?.active ?? 0) === 0) warn('No active church is registered in the platform database.');

    const duplicateSlugs = await sql.query(
      `SELECT "slug", COUNT(*)::int AS count FROM "churches"
       GROUP BY "slug" HAVING COUNT(*) > 1`,
    );
    if (duplicateSlugs.length > 0) fail('Duplicate church slugs exist in the platform database.');

    const duplicateEmails = await sql.query(
      `SELECT lower("contactEmail") AS email, COUNT(*)::int AS count FROM "churches"
       WHERE "status" <> 'archived'
       GROUP BY lower("contactEmail") HAVING COUNT(*) > 1`,
    );
    if (duplicateEmails.length > 0) fail('Duplicate active church contact emails exist in the platform database.');

    if (tables.has('tenant_connections')) {
      const missingConnections = await sql.query(
        `SELECT c."id", c."slug" FROM "churches" c
         LEFT JOIN "tenant_connections" tc ON tc."churchId" = c."id"
         WHERE c."status" = 'active' AND tc."churchId" IS NULL`,
      );
      if (missingConnections.length > 0) {
        fail(`Active churches without tenant_connections: ${missingConnections.map((row) => row.slug).join(', ')}`);
      }
    }
  }

  if (tables.has('tenant_connections')) {
    const connections = await sql.query(
      `SELECT "churchId", "encryptedUrl", "urlFingerprint", "databaseName"
       FROM "tenant_connections" ORDER BY "churchId"`,
    );
    console.log(`Tenant connection records: ${connections.length}`);

    const churchRows = tables.has('churches')
      ? await sql.query(`SELECT "id", "slug" FROM "churches"`)
      : [];
    const churchById = new Map(churchRows.map((row) => [row.id, row]));

    for (const connection of connections) {
      let decryptedUrl = null;
      if (encryptionKey) {
        try {
          decryptedUrl = decryptTenantUrl(connection.encryptedUrl, encryptionKey);
          if (fingerprintConnectionUrl(decryptedUrl) !== connection.urlFingerprint) {
            fail(`Tenant connection fingerprint mismatch for church ${connection.churchId}.`);
          }
          if (platformUrl && isSamePostgresDatabase(decryptedUrl, platformUrl)) {
            fail(`Tenant connection for church ${connection.churchId} points at the platform database.`);
          }
          if (tenantUrl && !isSamePostgresDatabase(decryptedUrl, tenantUrl)) {
            warn(`Tenant connection for church ${connection.churchId} does not match configured DATABASE_URL.`);
          }
        } catch (error) {
          fail(`Tenant connection for church ${connection.churchId} cannot be decrypted: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }

      if (deep && decryptedUrl) {
        try {
          const target = parsePostgresUrl(decryptedUrl);
          const tenantSql = neon(decryptedUrl);
          const identity = await tenantSql.query(
            `SELECT "churchId", "slug" FROM "tenant_identity" LIMIT 1`,
          );
          if (!identity[0] || identity[0].churchId !== connection.churchId) {
            fail(`Tenant identity mismatch for church ${connection.churchId}.`);
          } else {
            const church = churchById.get(connection.churchId);
            if (church && identity[0].slug && identity[0].slug !== church.slug) {
              fail(`Tenant identity slug mismatch for church ${connection.churchId}.`);
            }
          }

          const platformTablesInTenant = await tenantSql.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name IN ('churches', 'tenant_connections', 'platform_migrations')`,
          );
          if (platformTablesInTenant.length > 0) {
            fail(`Tenant database for church ${connection.churchId} contains platform tables.`);
          }

          const operational = await tenantSql.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
            [Object.keys(REQUIRED_TENANT_COLUMNS)],
          );
          const missingOperational = Object.keys(REQUIRED_TENANT_COLUMNS)
            .filter((table) => !operational.some((row) => row.table_name === table));
          if (missingOperational.length > 0) {
            fail(`Tenant database for church ${connection.churchId} is missing operational tables: ${missingOperational.join(', ')}`);
          }

          const tenantColumns = await tenantSql.query(
            `SELECT table_name, column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
            [Object.keys(REQUIRED_TENANT_COLUMNS)],
          );
          for (const [table, required] of Object.entries(REQUIRED_TENANT_COLUMNS)) {
            const present = new Set(
              tenantColumns.filter((row) => row.table_name === table).map((row) => row.column_name),
            );
            const missing = required.filter((column) => !present.has(column));
            if (missing.length > 0) {
              fail(`Tenant table "${table}" for church ${connection.churchId} is missing columns: ${missing.join(', ')}`);
            }
          }
          console.log(`  church ${connection.churchId}: decrypted, fingerprint ${connection.databaseName || target.pathname.replace(/^\//, '')} ${deep ? 'and identity verified' : ''}`);
        } catch (error) {
          fail(`Deep tenant verification failed for church ${connection.churchId}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
    }
  }
}

if (warnings.length > 0) {
  console.warn('\nWarnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (problems.length > 0) {
  console.error('\nPreflight failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('\nPlatform database preflight passed.');
