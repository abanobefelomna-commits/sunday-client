import { getAuthUser, jsonResponse, unauthorized, forbidden, badRequest, serverError } from '@/src/server/middleware';
import { query, queryOne } from '@/src/server/db';

async function getRole(userId: string) {
  const user = await queryOne<{ id: string; name: string; role: string; phone: string; email: string }>(
    `SELECT "id", "name", "role", "phone", "email" FROM "users" WHERE "id" = $1`, [userId],
  );
  if (!user) return null;
  const servant = await queryOne<{ role: string }>(
    `SELECT "role" FROM "servants" WHERE "phone" = $1 OR ("email" IS NOT NULL AND "email" = $2) LIMIT 1`, [user.phone, user.email],
  );
  const role = ['admin', 'priest'].includes(user.role) ? user.role : servant?.role || user.role;
  return { ...user, role };
}

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS "friday_preparations" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL,
    "attendanceChecked" boolean NOT NULL, "lessonTopic" text NOT NULL,
    "prepDate" date NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("userId", "prepDate"))`);
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const account = await getRole(auth.sub);
    if (!account) return unauthorized();
    const admin = ['admin', 'priest', 'مسؤول', 'أب كاهن'].includes(account.role);
    const server = ['servant', 'خادم', 'خادم فقرة عامة', 'قائد فصل'].includes(account.role);
    if (!admin && !server) return forbidden();
    await ensureTable();
    if (admin) {
      const rows = await query(`SELECT p."userId", u."name" AS "serverName", p."attendanceChecked", p."lessonTopic", p."prepDate"
        FROM "friday_preparations" p JOIN "users" u ON u."id" = p."userId" ORDER BY p."prepDate" DESC, u."name"`);
      return jsonResponse({ role: 'admin', data: rows });
    }
    const rows = await query(`SELECT "attendanceChecked", "lessonTopic", "prepDate" FROM "friday_preparations" WHERE "userId" = $1 ORDER BY "prepDate" DESC`, [auth.sub]);
    return jsonResponse({ role: 'server', data: rows });
  } catch { return serverError('تعذر تحميل بيانات التحضير'); }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const account = await getRole(auth.sub);
    if (!account || !['servant', 'خادم', 'خادم فقرة عامة', 'قائد فصل'].includes(account.role)) return forbidden();
    const body = await req.json();
    if (!body.attendanceChecked || typeof body.lessonTopic !== 'string' || !body.lessonTopic.trim() || typeof body.prepDate !== 'string') return badRequest('أكمل بيانات التحضير المطلوبة');
    const today = new Date();
    if (today.getDay() !== 5) return forbidden('نموذج التحضير متاح يوم الجمعة فقط');
    const day = new Date(`${body.prepDate}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.prepDate) || Number.isNaN(day.getTime()) || day > today || day.getDay() !== 5) return badRequest('اختر يوم جمعة صالحًا للتحضير');
    await ensureTable();
    const saved = await queryOne(`INSERT INTO "friday_preparations" ("userId", "attendanceChecked", "lessonTopic", "prepDate") VALUES ($1, true, $2, $3)
      ON CONFLICT ("userId", "prepDate") DO UPDATE SET "attendanceChecked" = true, "lessonTopic" = EXCLUDED."lessonTopic", "updatedAt" = now()
      RETURNING "attendanceChecked", "lessonTopic", "prepDate"`, [auth.sub, body.lessonTopic.trim(), body.prepDate]);
    return jsonResponse(saved, 201);
  } catch { return serverError('تعذر حفظ التحضير'); }
}
