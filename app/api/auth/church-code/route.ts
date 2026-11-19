import { NextResponse } from 'next/server';
import { platformQueryOne } from '@/src/server/platform/db';
import { getRequestIp, rateLimit } from '@/src/server/security';

/**
 * Validate a church invitation code for the public registration flow.
 * Only the church name and slug are returned. The code itself is never
 * echoed back, and no administrative information is exposed.
 */
export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const limit = rateLimit(`church-code-lookup:${ip}`, 20, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'محاولات كثيرة. حاول مرة أخرى بعد قليل.' },
      { status: 429 },
    );
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'بيانات غير صالحة' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!code) {
    return NextResponse.json({ message: 'رمز دعوة الكنيسة مطلوب' }, { status: 400 });
  }

  const row = await platformQueryOne<{ id: string; slug: string; name: string }>(
    `SELECT c."id", c."slug", c."name"
     FROM "church_codes" cc
     JOIN "churches" c ON c."id" = cc."churchId"
     WHERE upper(cc."code") = upper($1)
       AND cc."revoked" = false
       AND (cc."expiresAt" IS NULL OR cc."expiresAt" > now())
       AND c."status" = 'active'
     LIMIT 1`,
    [code],
  );

  if (!row) {
    return NextResponse.json(
      { message: 'رمز دعوة الكنيسة غير صالح أو منتهي الصلاحية' },
      { status: 404 },
    );
  }

  return NextResponse.json({ church: { id: row.id, slug: row.slug, name: row.name } });
}
