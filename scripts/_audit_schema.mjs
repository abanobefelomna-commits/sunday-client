#!/usr/bin/env node
// Read-only schema audit. Prints table names, columns, row counts. No personal data.
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
const url = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;
if (!url) { console.error('no database url'); process.exit(1); }
const sql = neon(url);

const tables = await sql.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
console.log('TABLES', tables.map(t => t.table_name).join(', '));

for (const { table_name } of tables) {
  const cols = await sql.query(`
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name=$1
    ORDER BY ordinal_position`, [table_name]);
  const count = await sql.query(`SELECT COUNT(*)::int AS c FROM "${table_name}"`);
  console.log(`\n## ${table_name} (${count[0].c} rows)`);
  console.log(cols.map(c => `${c.column_name}:${c.udt_name}${c.is_nullable === 'NO' ? '!' : ''}${c.column_default ? '=' + c.column_default : ''}`).join(', '));
}

const enums = await sql.query(`
  SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
  GROUP BY t.typname ORDER BY t.typname`);
console.log('\nENUMS');
for (const e of enums) console.log(`${e.typname}: ${e.labels}`);

const fks = await sql.query(`
  SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
  WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
  ORDER BY tc.table_name, kcu.column_name`);
console.log('\nFKS');
for (const f of fks) console.log(`${f.table_name}.${f.column_name} -> ${f.foreign_table}.${f.foreign_column}`);
