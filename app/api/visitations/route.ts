import { query, queryOne } from '@/src/server/db';
import { jsonResponse, badRequest, serverError } from '@/src/server/middleware';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const childId = searchParams.get('childId') || null;
    const servantId = searchParams.get('servantId') || null;
    const type = searchParams.get('type') || null;
    const status = searchParams.get('status') || null;
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const rows = await query<{
      id: string;
      childId: string;
      servantId: string | null;
      date: string;
      type: string;
      status: string;
      notes: string | null;
      followUpDate: string | null;
      createdAt: Date;
      updatedAt: Date;
      childName: string | null;
      servantName: string | null;
    }>(
      `SELECT
         v."id",
         v."childId",
         v."servantId",
         v."date",
         v."type",
         v."status",
         v."notes",
         v."followUpDate",
         v."createdAt",
         v."updatedAt",
         c."name" AS "childName",
         s."name" AS "servantName"
       FROM "visitations" v
       LEFT JOIN "children" c ON c."id" = v."childId"
       LEFT JOIN "servants" s ON s."id" = v."servantId"
       WHERE ($1::uuid IS NULL OR v."childId" = $1)
         AND ($2::uuid IS NULL OR v."servantId" = $2)
         AND ($3::text IS NULL OR v."type"::text = $3)
         AND ($4::text IS NULL OR v."status"::text = $4)
         AND ($5::date IS NULL OR v."date" >= $5)
         AND ($6::date IS NULL OR v."date" <= $6)
       ORDER BY v."date" DESC
       LIMIT $7 OFFSET $8`,
      [childId, servantId, type, status, dateFrom, dateTo, limit, offset],
    );

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM "visitations" v
       WHERE ($1::uuid IS NULL OR v."childId" = $1)
         AND ($2::uuid IS NULL OR v."servantId" = $2)
         AND ($3::text IS NULL OR v."type"::text = $3)
         AND ($4::text IS NULL OR v."status"::text = $4)
         AND ($5::date IS NULL OR v."date" >= $5)
         AND ($6::date IS NULL OR v."date" <= $6)`,
      [childId, servantId, type, status, dateFrom, dateTo],
    );

    const total = countRow?.total || 0;

    const data = rows.map((r) => ({
      id: r.id,
      childId: r.childId,
      servantId: r.servantId,
      date: r.date,
      type: r.type,
      status: r.status,
      notes: r.notes,
      followUpDate: r.followUpDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      child: {
        id: r.childId,
        name: r.childName,
      },
      servant: r.servantId
        ? {
            id: r.servantId,
            name: r.servantName,
          }
        : null,
    }));

    return jsonResponse({
      data,
      total,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get visitations error:', error);
    return serverError(error.message || 'فشل جلب سجلات الافتقاد');
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      childId,
      servantId,
      date,
      type = 'home_visit',
      status = 'completed',
      notes,
      followUpDate,
    } = body;

    if (!childId || !date) {
      return badRequest('الطفل والتاريخ مطلوبان');
    }

    const created = await queryOne(
      `INSERT INTO "visitations" (
         "id", "childId", "servantId", "date", "type", "status", "notes", "followUpDate", "createdAt", "updatedAt"
       )
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING *`,
      [
        childId,
        servantId || null,
        date,
        type,
        status,
        notes || null,
        followUpDate || null,
      ],
    );

    return jsonResponse(created, 201);
  } catch (error: any) {
    console.error('Create visitation error:', error);
    return serverError(error.message || 'فشل تسجيل الافتقاد');
  }
}
