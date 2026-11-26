import { platformQueryOne } from './platform/db';

export type JoinCodeResult =
  | { ok: true; slug: string }
  | { ok: false; reason: 'invalid' | 'unavailable' };

/** Resolve an active church join code to its church slug (never grants a role). */
export async function resolveJoinCode(rawCode: string): Promise<JoinCodeResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code || code.length > 64) return { ok: false, reason: 'invalid' };
  try {
    const row = await platformQueryOne<{ slug: string }>(
      `SELECT c."slug"
       FROM "church_codes" cc
       JOIN "churches" c ON c."id" = cc."churchId"
       WHERE upper(cc."code") = upper($1) AND cc."purpose" = 'join'
         AND cc."revoked" = false
         AND (cc."expiresAt" IS NULL OR cc."expiresAt" > now())
         AND c."status" = 'active'
       LIMIT 1`,
      [code],
    );
    return row ? { ok: true, slug: row.slug } : { ok: false, reason: 'invalid' };
  } catch (error) {
    console.error('[join-code] lookup failed:', error instanceof Error ? error.name : 'UnknownError');
    return { ok: false, reason: 'unavailable' };
  }
}
