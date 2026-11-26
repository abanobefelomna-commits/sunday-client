import { readFileSync } from 'node:fs';
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

const target = process.argv[2];
const url = target === 'platform' ? process.env.PLATFORM_DATABASE_URL : process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('missing database url');
const sql = neon(url);

const file = 'db/tenant/010_class_leader_integrity.sql';
const statements = splitStatements(readFileSync(resolve(process.cwd(), file), 'utf8'));
console.log(`Applying ${statements.length} statements from ${file}`);
for (let index = 0; index < statements.length; index += 1) {
  try {
    await sql.query(statements[index]);
  } catch (error) {
    console.error(`statement ${index + 1} failed:\n${statements[index].slice(0, 300)}\n`);
    throw error;
  }
}

const fks = await sql.query(`SELECT conname, convalidated
  FROM pg_constraint
  WHERE conname IN ('FK_attendance_recordedBy', 'FK_classes_leadServant')
  ORDER BY conname`);
const indexes = await sql.query(`SELECT indexname FROM pg_indexes
  WHERE indexname IN ('UQ_classes_leadServantId','IDX_servants_userId','IDX_children_class_assigned','IDX_servant_attendance_class_servant','IDX_attendance_recordedBy')
  ORDER BY indexname`);
const triggers = await sql.query(`SELECT tgname FROM pg_trigger
  WHERE tgname IN ('TRG_classes_lead_servant_membership','TRG_servants_classes_release_leader','TRG_servants_reconcile_role_scope')
  ORDER BY tgname`);
const migration = await sql.query(`SELECT name FROM tenant_migrations WHERE name LIKE '010%'`);
console.log(JSON.stringify({ fks, indexes, triggers, migration }, null, 2));
