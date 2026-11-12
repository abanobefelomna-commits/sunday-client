#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const sql = neon(url);
const tables = await sql.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name
`);

const backup = {
  timestamp: new Date().toISOString(),
  sourceDatabase: 'neondb',
  tables: {},
  counts: {},
};

for (const { table_name } of tables) {
  const rows = await sql.query(`SELECT * FROM "${table_name}"`);
  backup.tables[table_name] = rows;
  backup.counts[table_name] = rows.length;
}

mkdirSync(resolve(process.cwd(), 'backups'), { recursive: true });
const backupPath = resolve(process.cwd(), 'backups', 'neondb_logical_backup.json');
writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

console.log(`Logical backup saved to ${backupPath}`);
console.log('Record counts:', backup.counts);
