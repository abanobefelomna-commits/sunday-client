#!/usr/bin/env node
/**
 * Apply central platform migrations to PLATFORM_DATABASE_URL.
 * Additive and idempotent. Never drops or deletes application data.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { splitStatements } from './lib/sql-split.mjs';

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

const url = process.env.PLATFORM_DATABASE_URL;
if (!url) {
  console.error('PLATFORM_DATABASE_URL is not set. Refusing to fall back to a tenant database for platform migrations.');
  process.exit(1);
}

const sql = neon(url);
const dir = resolve(process.cwd(), 'db/platform');
const files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
if (files.length === 0) {
  console.error('No platform migrations found.');
  process.exit(1);
}

await sql.query(`CREATE TABLE IF NOT EXISTS "platform_migrations" (
  "name" varchar(160) PRIMARY KEY,
  "appliedAt" timestamptz NOT NULL DEFAULT now()
)`);

for (const file of files) {
  const statements = splitStatements(readFileSync(resolve(dir, file), 'utf8'));
  console.log(`Applying ${statements.length} statements from platform/${file}`);
  for (let index = 0; index < statements.length; index += 1) {
    try {
      await sql.query(statements[index]);
    } catch (error) {
      console.error(`\nplatform/${file} statement ${index + 1} failed:\n${statements[index].slice(0, 300)}\n`);
      throw error;
    }
  }
  await sql.query(
    `INSERT INTO "platform_migrations" ("name") VALUES ($1)
     ON CONFLICT ("name") DO UPDATE SET "appliedAt" = now()`,
    [file],
  );
}

console.log('Platform migrations applied successfully.');
