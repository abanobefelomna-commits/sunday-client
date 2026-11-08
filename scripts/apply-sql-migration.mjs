#!/usr/bin/env node
/**
 * Apply an idempotent SQL migration to the configured Neon database.
 * Usage: node scripts/apply-sql-migration.mjs db/migrations/<file>.sql
 *
 * Splits on top-level semicolons while respecting single-quoted strings,
 * dollar-quoted blocks and line comments.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

// Plain Node does not load .env files the way Next.js does.
function loadEnv(file = '.env') {
  let source;
  try {
    source = readFileSync(resolve(process.cwd(), file), 'utf8');
  } catch {
    return;
  }
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
    process.env[key] = value;
  }
}

loadEnv();

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-sql-migration.mjs <migration.sql>');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

function splitStatements(source) {
  const statements = [];
  let current = '';
  let i = 0;
  let quote = null; // "'" or '"'
  let dollarTag = null;
  let lineComment = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      current += ch;
      if (ch === '\n') lineComment = false;
      i += 1;
      continue;
    }

    if (dollarTag) {
      current += ch;
      if (source.startsWith(dollarTag, i)) {
        current += dollarTag.slice(1);
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i += 1;
      continue;
    }

    if (quote) {
      current += ch;
      if (ch === quote) {
        if (next === quote) {
          current += next;
          i += 2;
          continue;
        }
        quote = null;
      }
      i += 1;
      continue;
    }

    if (ch === '-' && next === '-') {
      lineComment = true;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === '$') {
      const match = source.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

const sql = neon(connectionString);
const source = readFileSync(resolve(process.cwd(), file), 'utf8');
const statements = splitStatements(source);
console.log(`Applying ${statements.length} statements from ${file}`);

for (let index = 0; index < statements.length; index += 1) {
  const statement = statements[index];
  try {
    await sql.query(statement);
  } catch (error) {
    console.error(`\nStatement ${index + 1} failed:\n${statement.slice(0, 400)}\n`);
    throw error;
  }
}

console.log('Migration applied successfully.');
