import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
function loadEnv(file = '.env') { let source; try { source = readFileSync(resolve(process.cwd(), file), 'utf8'); } catch { return; } for (const rawLine of source.split(/\r?\n/)) { const line = rawLine.trim(); if (!line || line.startsWith('#')) continue; const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (!m) continue; const [, k, v] = m; if (process.env[k] !== undefined) continue; process.env[k] = (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v; } }
loadEnv();
const sql = neon(process.env.PLATFORM_DATABASE_URL);
const cols = await sql.query(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('tenant_connections','churches') ORDER BY table_name, ordinal_position`);
console.log(JSON.stringify(cols, null, 2));
const conns = await sql.query(`SELECT * FROM tenant_connections`);
console.log(JSON.stringify(conns, null, 2));
