#!/usr/bin/env node
// Bootstrap a separate central/platform database in the same PostgreSQL cluster.
// Idempotent: does nothing when the database already exists. Never drops data.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

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

const adminUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const targetName = process.argv[2] || 'sunday_platform';
if (!adminUrl) { console.error('DATABASE_URL is required'); process.exit(1); }
if (!/^[a-z][a-z0-9_]{2,62}$/.test(targetName)) {
  console.error('Database name must be lowercase letters, digits and underscores (3-63 chars).');
  process.exit(1);
}

const sql = neon(adminUrl);
const existing = await sql.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetName]);
if (existing.length > 0) {
  console.log(`Database ${targetName} already exists.`);
} else {
  await sql.query(`CREATE DATABASE "${targetName}"`);
  console.log(`Created database ${targetName}.`);
}

const url = new URL(adminUrl);
url.pathname = `/${targetName}`;
console.log('PLATFORM_DATABASE_URL has been derived. Add it to .env manually; it is not printed here.');
