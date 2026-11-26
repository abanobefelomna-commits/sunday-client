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
const sql = neon(process.env.PLATFORM_DATABASE_URL);

const tables = await sql.query(`SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' ORDER BY table_name`);
console.log('tables', tables.map((row) => row.table_name));
const columns = await sql.query(`SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema='public' AND (column_name ILIKE '%database%' OR column_name ILIKE '%connection%' OR column_name ILIKE '%tenant%' OR column_name ILIKE '%secret%')
  ORDER BY table_name, column_name`);
console.log('columns', columns);
const churches = await sql.query(`SELECT id, slug, name, status FROM churches ORDER BY "createdAt"`);
console.log('churches', churches);
