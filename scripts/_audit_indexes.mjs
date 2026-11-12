import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
function loadEnv(file='.env'){let s;try{s=readFileSync(resolve(process.cwd(),file),'utf8');}catch{return;}for(const raw of s.split(/\r?\n/)){const l=raw.trim();if(!l||l.startsWith('#'))continue;const m=l.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;if(process.env[m[1]]!==undefined)continue;process.env[m[1]]=(m[2].startsWith('"')&&m[2].endsWith('"'))||(m[2].startsWith("'")&&m[2].endsWith("'"))?m[2].slice(1,-1):m[2];}}
loadEnv();
const sql=neon(process.env.DATABASE_URL);
const idx=await sql.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`);
for(const r of idx) console.log(`${r.tablename} | ${r.indexname} | ${r.indexdef}`);
const con=await sql.query(`SELECT conrelid::regclass AS table, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid::regclass::text,conname`);
console.log('\nCONSTRAINTS');
for(const r of con) console.log(`${r.table} | ${r.conname} | ${r.def}`);
const dups=await sql.query(`SELECT COUNT(*)::int c FROM (SELECT lower(email) FROM users GROUP BY 1 HAVING COUNT(*)>1) x`);
console.log('\nCASE_DUP_EMAILS', dups[0].c);
const dupp=await sql.query(`SELECT COUNT(*)::int c FROM (SELECT phone FROM users GROUP BY 1 HAVING COUNT(*)>1) x`);
console.log('DUP_PHONES', dupp[0].c);
