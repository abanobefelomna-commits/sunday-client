import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
function loadEnv(f='.env'){let s;try{s=readFileSync(resolve(process.cwd(),f),'utf8');}catch{return;}for(const l of s.split(/\r?\n/)){const m=l.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m||process.env[m[1]]!==undefined)continue;process.env[m[1]]=(m[2].startsWith('"')&&m[2].endsWith('"'))||(m[2].startsWith("'")&&m[2].endsWith("'"))?m[2].slice(1,-1):m[2];}}
loadEnv();
const sql=neon(process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL);
for(const t of ['users','permissions','roles','role_permissions','user_roles','church_settings','tenant_identity','tenant_migrations','friday_preparations']){
  const [r]=await sql.query(`SELECT COUNT(*)::int c FROM "${t}"`);console.log(t,r.c);
}
const roles=await sql.query(`SELECT r.code, COUNT(ur."userId")::int users FROM roles r LEFT JOIN user_roles ur ON ur."roleId"=r.id GROUP BY r.code ORDER BY r.code`);
console.log(roles);
const missing=await sql.query(`SELECT COUNT(*)::int c FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur."userId"=u.id)`);
console.log('users_without_role',missing[0].c);
const plat=neon(process.env.PLATFORM_DATABASE_URL);
for(const t of ['churches','features','subscription_plans','plan_features','platform_settings','provisioning_jobs']){
  const [r]=await plat.query(`SELECT COUNT(*)::int c FROM "${t}"`);console.log('platform.'+t,r.c);
}
