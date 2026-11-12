#!/usr/bin/env node
/**
 * Wrap existing tenant API route handlers with `withTenant` so every request
 * runs inside an AsyncLocalStorage-scoped tenant connection.
 *
 * Public platform routes, the health endpoint, and the two auth entry points
 * (login / member registration) are handled separately because they resolve a
 * tenant explicitly. Running this script twice is a no-op.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const apiDir = join(root, 'app', 'api');
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const skip = new Set([
  'app/api/route.ts',
  ['app', 'api', 'auth', 'login', 'route.ts'].join(sep),
  ['app', 'api', 'auth', 'register', 'route.ts'].join(sep),
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name === 'route.ts') files.push(full);
  }
  return files;
}

const files = await walk(apiDir);
let changed = 0;

for (const file of files) {
  const relativePath = relative(root, file).split(sep).join('/');
  if (skip.has(relativePath.split('/').join(sep)) || skip.has(relativePath)) continue;
  if (relativePath.startsWith('app/api/platform/')) continue;
  if (relativePath.startsWith('app/api/cron/')) continue;

  let source = await readFile(file, 'utf8');
  if (source.includes("tenant/route")) continue;

  const found = [];
  for (const method of methods) {
    const pattern = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`, 'g');
    if (pattern.test(source)) found.push(method);
  }
  if (found.length === 0) continue;

  for (const method of found) {
    source = source.replace(
      new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`),
      `async function ${method}Handler(`,
    );
  }

  const importLine = "import { withTenant } from '@/src/server/tenant/route';\n";
  source = importLine + source.trimEnd() + '\n\n' +
    found.map((method) => `export const ${method} = withTenant(${method}Handler);`).join('\n') +
    '\n';

  await writeFile(file, source, 'utf8');
  changed += 1;
  console.log(`wrapped ${relativePath}: ${found.join(', ')}`);
}

console.log(`\n${changed} route file(s) wrapped.`);
