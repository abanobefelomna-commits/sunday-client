#!/usr/bin/env node
// Local-only environment bootstrapper. Appends missing development keys to .env
// without printing or overwriting existing values. Never run against production.
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const envPath = resolve(process.cwd(), '.env');
let source = readFileSync(envPath, 'utf8');
const has = (key) => new RegExp(`^${key}=`, 'm').test(source);

const additions = [];
if (!has('PLATFORM_DATABASE_URL')) {
  const base = source.match(/^DATABASE_URL_UNPOOLED\s*=\s*"?([^"\r\n]+)"?/m)?.[1]
    || source.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
  if (!base) throw new Error('DATABASE_URL is required to derive PLATFORM_DATABASE_URL');
  const url = new URL(base);
  url.pathname = '/sunday_platform';
  additions.push(`PLATFORM_DATABASE_URL="${url.toString()}"`);
}
if (!has('TENANT_SECRET_KEY')) additions.push(`TENANT_SECRET_KEY=${randomBytes(32).toString('base64')}`);
if (!has('PLATFORM_JWT_SECRET')) additions.push(`PLATFORM_JWT_SECRET=${randomBytes(48).toString('base64url')}`);
if (!has('PLATFORM_ADMIN_SESSION_SECRET')) additions.push(`PLATFORM_ADMIN_SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
if (!has('DEFAULT_TENANT_SLUG')) additions.push('DEFAULT_TENANT_SLUG=sunday-school');
if (!has('ALLOW_DEFAULT_TENANT')) additions.push('ALLOW_DEFAULT_TENANT=true');
if (!has('PLATFORM_ROOT_DOMAIN')) additions.push('PLATFORM_ROOT_DOMAIN=');
if (!has('TENANT_PROVISIONING_PROVIDER')) additions.push('TENANT_PROVISIONING_PROVIDER=postgres');
if (!has('PROVISIONING_CRON_SECRET')) additions.push(`PROVISIONING_CRON_SECRET=${randomBytes(32).toString('base64url')}`);

if (additions.length > 0) {
  appendFileSync(envPath, `\n# Multi-church platform (local bootstrap)\n${additions.join('\n')}\n`);
  console.log(`Appended ${additions.length} development variable(s) to .env (values not printed).`);
} else {
  console.log('No environment changes needed.');
}
