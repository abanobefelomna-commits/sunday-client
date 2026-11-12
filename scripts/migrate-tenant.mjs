#!/usr/bin/env node
/**
 * Apply every tenant migration to a church database.
 *
 * Usage:
 *   node scripts/migrate-tenant.mjs --url "<connection string>"
 *   TENANT_DATABASE_URL="..." node scripts/migrate-tenant.mjs
 *
 * Additive and idempotent. Never drops or deletes church data.
 * For the central platform use scripts/migrate-platform.mjs.
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

const urlArgIndex = process.argv.indexOf('--url');
const useExisting = process.argv.includes('--existing');
const url = urlArgIndex !== -1
  ? process.argv[urlArgIndex + 1]
  : useExisting
    ? process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    : process.env.TENANT_DATABASE_URL;
if (!url) {
  console.error('Provide --url "<connection string>", --existing, or TENANT_DATABASE_URL.');
  process.exit(1);
}
if (useExisting) {
  console.log('Applying tenant migrations to the existing church database (additive only).');
}

const sql = neon(url);
const dir = resolve(process.cwd(), 'db/tenant');
const files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();

for (const file of files) {
  const statements = splitStatements(readFileSync(resolve(dir, file), 'utf8'));
  console.log(`Applying ${statements.length} statements from tenant/${file}`);
  for (let index = 0; index < statements.length; index += 1) {
    try {
      await sql.query(statements[index]);
    } catch (error) {
      console.error(`\ntenant/${file} statement ${index + 1} failed:\n${statements[index].slice(0, 300)}\n`);
      throw error;
    }
  }
}

console.log('Tenant migrations applied successfully.');
