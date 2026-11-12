#!/usr/bin/env node
// Non-destructive verified backup: creates a physical database copy in the same cluster.
// Refuses to overwrite an existing backup database. Verifies row counts afterward.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

function loadEnv(file = '.env') {
  let source;
  try { source = readFileSync(resolve(process.cwd(), file), 'utf8'); } catch { return; }
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = (m[2].startsWith('"') && m[2].endsWith('"')) || (m[2].startsWith("'") && m[2].endsWith("'"))
      ? m[2].slice(1, -1) : m[2];
  }
}
loadEnv();
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const sourceName = new URL(url).pathname.slice(1);
const backupName = process.argv[2] || `backup_${sourceName}_pre_multitenant`;
if (!/^[a-z][a-z0-9_]{2,62}$/.test(backupName)) throw new Error('Invalid backup database name');

const sql = neon(url);
const existing = await sql.query('SELECT 1 FROM pg_database WHERE datname = $1', [backupName]);
if (existing.length === 0) {
  try {
    await sql.query(`CREATE DATABASE "${backupName}" WITH TEMPLATE "${sourceName}"`);
    console.log(`Created physical backup database ${backupName}.`);
  } catch (error) {
    console.error('Physical database copy failed:', error.message);
    console.error('No changes were made. Create a Neon branch backup (neon branches create) or logical backup before migration.');
    process.exit(2);
  }
} else {
  console.log(`Backup database ${backupName} already exists; refusing to overwrite.`);
}

const tables = await sql.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
);
const backupUrl = new URL(url);
backupUrl.pathname = `/${backupName}`;
const backup = neon(backupUrl.toString());
const report = [];
for (const { table_name } of tables) {
  const [a] = await sql.query(`SELECT COUNT(*)::int AS c FROM "${table_name}"`);
  const [b] = await backup.query(`SELECT COUNT(*)::int AS c FROM "${table_name}"`);
  if (a.c !== b.c) throw new Error(`Backup verification failed for ${table_name}: ${a.c} != ${b.c}`);
  report.push(`${table_name}=${a.c}`);
}
console.log(`Verified ${tables.length} tables with matching row counts: ${report.join(', ')}`);
