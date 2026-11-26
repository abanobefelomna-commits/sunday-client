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
const sql = neon(process.env.DATABASE_URL);

const queries = {
  counts: `SELECT
    (SELECT COUNT(*)::int FROM users) AS users,
    (SELECT COUNT(*)::int FROM servants) AS servants,
    (SELECT COUNT(*)::int FROM classes) AS classes,
    (SELECT COUNT(*)::int FROM children WHERE "deletedAt" IS NULL) AS children,
    (SELECT COUNT(*)::int FROM attendance) AS attendance,
    (SELECT COUNT(*)::int FROM servants_classes) AS servant_classes`,
  roles: `SELECT role::text AS role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role`,
  servantRoles: `SELECT role::text AS role, COUNT(*)::int AS count FROM servants GROUP BY role ORDER BY role`,
  migrations: `SELECT name FROM tenant_migrations ORDER BY name`,
  settings: `SELECT key, value FROM church_settings ORDER BY key`,
  leadNotMember: `SELECT c.id, c.name, c."leadServantId"
    FROM classes c
    WHERE c."leadServantId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM servants_classes sc
        WHERE sc."classesId" = c.id AND sc."servantsId" = c."leadServantId"
      )`,
  duplicateLeaders: `SELECT "leadServantId", COUNT(*)::int AS count
    FROM classes WHERE "leadServantId" IS NOT NULL
    GROUP BY "leadServantId" HAVING COUNT(*) > 1`,
  leaderRoleNoLead: `SELECT c.id, c.name, s.id AS "servantId", s.name AS "servantName"
    FROM classes c
    JOIN servants_classes sc ON sc."classesId" = c.id
    JOIN servants s ON s.id = sc."servantsId"
    WHERE s.role = 'قائد فصل' AND c."leadServantId" IS DISTINCT FROM s.id`,
  childAssignedNotMember: `SELECT ch.id, ch.name, ch."classId", ch."assignedServantId"
    FROM children ch
    WHERE ch."deletedAt" IS NULL
      AND ch."assignedServantId" IS NOT NULL
      AND ch."classId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM servants_classes sc
        WHERE sc."servantsId" = ch."assignedServantId" AND sc."classesId" = ch."classId"
      )`,
  attendanceOrphanRecorder: `SELECT COUNT(*)::int AS count FROM attendance a
    WHERE a."recordedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a."recordedBy")`,
  attendanceClassMismatch: `SELECT COUNT(*)::int AS count FROM attendance a
    JOIN children c ON c.id = a."childId"
    WHERE c."classId" IS DISTINCT FROM a."classId"`,
  classNoChurch: `SELECT COUNT(*)::int AS count FROM classes WHERE "churchId" IS NULL`,
  userWithoutServant: `SELECT u.id, u.name, u.role::text AS role FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM servants s WHERE s."userId" = u.id)`,
};

for (const [name, text] of Object.entries(queries)) {
  try {
    const rows = await sql.query(text);
    console.log(`\n## ${name}`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.log(`\n## ${name} ERROR ${error.message}`);
  }
}
