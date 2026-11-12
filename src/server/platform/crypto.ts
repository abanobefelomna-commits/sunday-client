import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { getJwtSecret, getTenantEncryptionKey } from './config';

const VERSION = 'v1';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacLikeHash(value: string, context = 'generic'): string {
  return createHash('sha256')
    .update(context)
    .update(':')
    .update(getJwtSecret())
    .update(':')
    .update(value)
    .digest('hex');
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return hmacLikeHash(ip, 'ip');
}

/** AES-256-GCM encryption used only for tenant connection strings. */
export function encryptSecret(plaintext: string): string {
  const key = getTenantEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unsupported tenant connection secret format');
  }
  const key = getTenantEncryptionKey();
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function fingerprintConnectionUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Keep host/database but never persist a reversible credential fingerprint.
    return sha256Hex(`${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`);
  } catch {
    return sha256Hex(url);
  }
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
