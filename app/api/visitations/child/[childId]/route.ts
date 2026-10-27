import { query } from '@/src/server/db';
import { jsonResponse, serverError } from '@/src/server/middleware';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  try {
    const { childId } = await params;

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
      servantName: string | null;
    }>(
      `SELECT
         v.*,
         s."name" AS "servantName"
       FROM "visitations" v
       LEFT JOIN "servants" s ON s."id" = v."servantId"
       WHERE v."childId" = $1
       ORDER BY v."date" DESC`,
      [childId],
    );

    const data = rows.map((r) => ({
      ...r,
      servant: r.servantId ? { id: r.servantId, name: r.servantName } : null,
    }));

    return jsonResponse(data);
  } catch (error: any) {
    console.error('Get child visitations error:', error);
    return serverError(error.message || 'فشل جلب افتقادات الطفل');
  }
}
