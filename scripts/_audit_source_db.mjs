#!/usr/bin/env node
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
const url = process.env.DATABASE_URL;
if (!url) { console.error('no DATABASE_URL'); process.exit(1); }
const sql = neon(url);

const tables = await sql.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
console.log('TABLES in DATABASE_URL (neondb):', tables.map(t => t.table_name).join(', '));

for (const { table_name } of tables) {
  const count = await sql.query(`SELECT COUNT(*)::int AS c FROM "${table_name}"`);
  console.log(`${table_name}: ${count[0].c} rows`);
}

// Inspect users / servants
try {
  const users = await sql.query(`SELECT id, name, email, role, phone FROM users LIMIT 10`);
  console.log('\nSAMPLE USERS:', JSON.stringify(users, null, 2));
} catch (e) {
  console.log('Error querying users:', e.message);
}

// Inspect servants
try {
  const servants = await sql.query(`SELECT id, "userId", "assignedClassId", role FROM servants LIMIT 10`);
  console.log('\nSAMPLE SERVANTS:', JSON.stringify(servants, null, 2));
} catch (e) {
  console.log('Error querying servants:', e.message);
}

// Inspect church_settings
try {
  const churchSettings = await sql.query(`SELECT * FROM church_settings`);
  console.log('\nCHURCH SETTINGS:', JSON.stringify(churchSettings, null, 2));
} catch (e) {
  console.log('Error querying church_settings:', e.message);
}

// Inspect roles
try {
  const roles = await sql.query(`SELECT * FROM roles`);
  console.log('\nROLES:', JSON.stringify(roles, null, 2));
} catch (e) {
  console.log('Error querying roles:', e.message);
}

// Inspect servants columns & data
try {
  const servantCols = await sql.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'servants'`);
  console.log('\nSERVANTS COLS:', servantCols.map(c => c.column_name).join(', '));
  const servants = await sql.query(`SELECT * FROM servants LIMIT 5`);
  console.log('SERVANTS SAMPLE:', JSON.stringify(servants, null, 2));
} catch (e) {
  console.log('Error querying servants:', e.message);
}

// Inspect classes
try {
  const classes = await sql.query(`SELECT * FROM classes`);
  console.log('\nCLASSES:', JSON.stringify(classes, null, 2));
} catch (e) {
  console.log('Error querying classes:', e.message);
}

// Inspect servants_classes
try {
  const sc = await sql.query(`SELECT * FROM servants_classes`);
  console.log('\nSERVANTS_CLASSES:', JSON.stringify(sc, null, 2));
} catch (e) {
  console.log('Error querying servants_classes:', e.message);
}

// Inspect tenant_identity
try {
  const ti = await sql.query(`SELECT * FROM tenant_identity`);
  console.log('\nTENANT_IDENTITY:', JSON.stringify(ti, null, 2));
} catch (e) {
  console.log('Error querying tenant_identity:', e.message);
}

// Check cluster databases
try {
  const dbs = await sql.query(`SELECT datname FROM pg_database WHERE datistemplate = false`);
  console.log('\nCLUSTER DATABASES:', dbs.map(d => d.datname));
} catch (e) {
  console.log('Error querying pg_database:', e.message);
}


