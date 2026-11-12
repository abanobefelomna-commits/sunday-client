import { withTenant } from '@/src/server/tenant/route';
import { getAuthUser, jsonResponse, unauthorized, forbidden, badRequest, serverError } from '@/src/server/middleware';
import { query, queryOne } from '@/src/server/db';

async function currentRole(id: string) {
  const user = await queryOne<{ id: string; name: string; role: string; phone: string; email: string }>(`SELECT "id", "name", "role", "phone", "email" FROM "users" WHERE "id" = $1`, [id]);
  if (!user) return null;
  const servant = await queryOne<{ id: string; role: string }>(`SELECT "id", "role" FROM "servants" WHERE "phone" = $1 OR ("email" IS NOT NULL AND "email" = $2) LIMIT 1`, [user.phone, user.email]);
  const role = ['admin', 'priest'].includes(user.role) ? user.role : servant?.role || user.role;
  return { ...user, role, servantId: servant?.id };
}

const privileged = (role: string) => ['admin', 'priest', 'مسؤول', 'أب كاهن'].includes(role);
const cairoWeekday = (date: Date) => new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'short' }).format(date);

async function GETHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const account = await currentRole(auth.sub);
    if (!account) return unauthorized();
    const manager = privileged(account.role);
    const isServer = ['servant', 'خادم', 'خادم فقرة عامة', 'قائد فصل'].includes(account.role);
    if (!manager && !isServer) return forbidden();
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const search = url.searchParams.get('search')?.trim() || '';
    const rows = manager
      ? await query(`SELECT p."id", p."userId", u."name" AS "serverName", p."attendanceChecked", p."lessonTopic", p."prepDate", p."content", p."submittedAt", p."status" FROM "friday_preparations" p JOIN "users" u ON u."id" = p."userId" WHERE ($1::date IS NULL OR p."prepDate" = $1::date) AND ($2 = '' OR u."name" ILIKE '%' || $2 || '%') ORDER BY p."submittedAt" DESC`, [date || null, search])
      : await query(`SELECT "id", "attendanceChecked", "lessonTopic", "prepDate", "content", "submittedAt", "status" FROM "friday_preparations" WHERE "userId" = $1 ORDER BY "submittedAt" DESC`, [auth.sub]);
    return jsonResponse({ role: manager ? 'manager' : 'servant', data: rows });
  } catch { return serverError('تعذر تحميل بيانات التحضير'); }
}

async function POSTHandler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();
    const account = await currentRole(auth.sub);
    if (!account || privileged(account.role) || !['servant', 'خادم', 'خادم فقرة عامة', 'قائد فصل'].includes(account.role)) return forbidden();
    const body = await req.json();
    const topic = typeof body.lessonTopic === 'string' ? body.lessonTopic.trim() : '';
    const prepDate = typeof body.prepDate === 'string' ? body.prepDate : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!body.attendanceChecked || !topic || !/^\d{4}-\d{2}-\d{2}$/.test(prepDate) || !content) return badRequest('أكمل بيانات التحضير المطلوبة');
    const row = await queryOne(`INSERT INTO "friday_preparations" ("userId", "attendanceChecked", "lessonTopic", "prepDate", "content") VALUES ($1, true, $2, $3, $4) ON CONFLICT ("userId", "prepDate") DO UPDATE SET "attendanceChecked" = true, "lessonTopic" = EXCLUDED."lessonTopic", "content" = EXCLUDED."content", "submittedAt" = now(), "status" = 'submitted' RETURNING *`, [auth.sub, topic, prepDate, content]);
    return jsonResponse(row, 201);
  } catch { return serverError('تعذر حفظ التحضير'); }
}

export const GET = withTenant(GETHandler);
export const POST = withTenant(POSTHandler);
