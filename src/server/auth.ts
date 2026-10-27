import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { query, queryOne } from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'd7e486f7e570d45ece8d04f3ffd8a879a1d3ca03a0aaef83898b71c61dc98ab6',
);

const ACCESS_TOKEN_EXPIRY = Number(process.env.JWT_EXPIRES_SECONDS || 900); // 15 mins default
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 7);

export interface JwtUserPayload {
  sub: string;
  role: string;
  name?: string;
  email?: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifyPassword(storedHash: string, candidate: string): Promise<boolean> {
  if (storedHash.startsWith('$argon2')) {
    try {
      return await argon2.verify(storedHash, candidate);
    } catch {
      return false;
    }
  }

  // Fallback to bcrypt for legacy hashes
  try {
    return await bcrypt.compare(candidate, storedHash);
  } catch {
    return false;
  }
}

export async function signAccessToken(payload: JwtUserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRY}s`)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<JwtUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtUserPayload;
  } catch {
    return null;
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function issueRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(48).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO "refresh_tokens" ("id", "tokenHash", "userId", "expiresAt", "createdAt")
     VALUES (uuid_generate_v4(), $1, $2, $3, now())`,
    [tokenHash, userId, expiresAt],
  );

  return { token, expiresAt };
}

export async function verifyAndRotateRefreshToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const row = await queryOne<{ id: string; userId: string; expiresAt: Date }>(
    `SELECT "id", "userId", "expiresAt" FROM "refresh_tokens"
     WHERE "tokenHash" = $1 AND "revokedAt" IS NULL AND "expiresAt" > now()`,
    [tokenHash],
  );

  if (!row) {
    return null;
  }

  // Revoke old token
  await query(
    `UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "id" = $1`,
    [row.id],
  );

  return row.userId;
}

export async function revokeRefreshToken(rawToken?: string | null): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await query(
    `UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "tokenHash" = $1`,
    [tokenHash],
  );
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await query(
    `UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "userId" = $1 AND "revokedAt" IS NULL`,
    [userId],
  );
}
