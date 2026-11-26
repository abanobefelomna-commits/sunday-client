import { createDecipheriv, createHash } from 'node:crypto';
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

function tenantKey() {
  const configured = process.env.TENANT_SECRET_KEY || '';
  const trimmed = configured.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, 'hex');
  const decoded = Buffer.from(trimmed, 'base64');
  if (decoded.length === 32) return decoded;
  if (trimmed.length >= 32) return createHash('sha256').update(trimmed).digest();
  return createHash('sha256').update(process.env.JWT_SECRET || '').update('tenant-connections-v1').digest();
}

function decryptSecret(encoded) {
  const parts = encoded.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('unsupported secret');
  const decipher = createDecipheriv('aes-256-gcm', tenantKey(), Buffer.from(parts[1], 'base64'));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
}

const platform = neon(process.env.PLATFORM_DATABASE_URL);
const targetSlug = process.argv[2] || 'church-ejrqnq';
const rows = await platform.query(
  `SELECT c.slug, tc."encryptedUrl"
   FROM churches c JOIN tenant_connections tc ON tc."churchId" = c.id
   WHERE c.slug = $1 LIMIT 1`,
  [targetSlug],
);
if (!rows.length) throw new Error('tenant not found');
const url = decryptSecret(rows[0].encryptedUrl);
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
const migrations = await sql.query(`SELECT name FROM tenant_migrations ORDER BY name`);
const indexes = await sql.query(`SELECT indexname FROM pg_indexes WHERE indexname = 'UQ_classes_leadServantId'`);
console.log(JSON.stringify({ slug: rows[0].slug, migrated: migrations.map((row) => row.name), indexes }, null, 2));
