#!/usr/bin/env node
/**
 * Apply central platform migrations to PLATFORM_DATABASE_URL.
 *
 * Safety rules:
 * - Requires an explicit PLATFORM_DATABASE_URL. Never falls back to a tenant DB.
 * - Refuses to run when the platform URL resolves to the tenant database.
 * - Skips migrations already recorded in platform_migrations unless --force.
 * - Verifies the required platform tables after applying.
 * - `--check` is read-only and exits non-zero when migrations are pending or
 *   when the platform schema is incomplete.
 *
 * Additive and idempotent. Never drops or deletes application data.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { splitStatements } from './lib/sql-split.mjs';
import { isSamePostgresDatabase, parsePostgresUrl } from './lib/postgres-url.mjs';
import { REQUIRED_PLATFORM_TABLES } from './lib/platform-schema.mjs';

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

const checkOnly = process.argv.includes('--check');
const force = process.argv.includes('--force');

const url = process.env.PLATFORM_DATABASE_URL?.trim();
if (!url) {
  console.error('PLATFORM_DATABASE_URL is not set. Refusing to fall back to a tenant database for platform migrations.');
  process.exit(1);
}

const tenantUrl =
  process.env.DATABASE_URL?.trim() || process.env.DATABASE_URL_UNPOOLED?.trim() || '';
if (tenantUrl && isSamePostgresDatabase(url, tenantUrl)) {
  console.error(
    'PLATFORM_DATABASE_URL resolves to the tenant database. Refusing to create platform tables inside tenant data.',
  );
  process.exit(1);
}

let target;
try {
  target = parsePostgresUrl(url, 'PLATFORM_DATABASE_URL');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
console.log(`Platform migration target database: ${target.pathname.replace(/^\//, '')}`);

const dir = resolve(process.cwd(), 'db/platform');
let files;
try {
  files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
} catch {
  console.error('Platform migration directory db/platform is missing.');
  process.exit(1);
}
if (files.length === 0) {
  console.error('No platform migrations found.');
  process.exit(1);
}

const sql = neon(url);

const [history] = await sql.query(
  `SELECT to_regclass('public.platform_migrations') IS NOT NULL AS "present"`,
);
const historyExists = history?.present === true;
const applied = new Set();
if (historyExists) {
  const rows = await sql.query(`SELECT "name" FROM "platform_migrations" ORDER BY "name"`);
  for (const row of rows) applied.add(row.name);
}

const pending = files.filter((file) => force || !applied.has(file));

async function missingPlatformTables() {
  const present = await sql.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [REQUIRED_PLATFORM_TABLES],
  );
  const found = new Set(present.map((row) => row.table_name));
  return REQUIRED_PLATFORM_TABLES.filter((table) => !found.has(table));
}

if (checkOnly) {
  if (!historyExists) {
    console.error('Platform schema is not initialized: platform_migrations is missing.');
  }
  if (pending.length > 0) {
    console.error(`Pending platform migrations: ${pending.join(', ')}`);
  } else {
    console.log('All platform migrations are recorded as applied.');
  }
  const missing = await missingPlatformTables();
  if (missing.length > 0) {
    console.error(`Missing required platform tables: ${missing.join(', ')}`);
  }
  if (!historyExists || pending.length > 0 || missing.length > 0) process.exit(1);
  console.log('Platform schema check passed.');
  process.exit(0);
}

if (!historyExists) {
  await sql.query(`CREATE TABLE IF NOT EXISTS "platform_migrations" (
    "name" varchar(160) PRIMARY KEY,
    "appliedAt" timestamptz NOT NULL DEFAULT now()
  )`);
}

for (const file of files) {
  if (!force && applied.has(file)) {
    console.log(`Skipping already applied platform/${file}`);
    continue;
  }

  const statements = splitStatements(readFileSync(resolve(dir, file), 'utf8'));
  if (statements.length === 0) {
    console.log(`No statements in platform/${file}`);
    continue;
  }
  console.log(`Applying ${statements.length} statements from platform/${file}`);
  try {
    await sql.transaction(statements.map((statement) => sql.query(statement)));
  } catch (error) {
    console.error(`\nplatform/${file} failed; no statements from this file were committed.\n`);
    throw error;
  }
  await sql.query(
    `INSERT INTO "platform_migrations" ("name") VALUES ($1)
     ON CONFLICT ("name") DO UPDATE SET "appliedAt" = now()`,
    [file],
  );
}

const missing = await missingPlatformTables();
if (missing.length > 0) {
  console.error(`Platform migration finished but required tables are still missing: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Platform migrations applied successfully.');
