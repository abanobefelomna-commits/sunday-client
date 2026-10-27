import { NextResponse } from 'next/server';
import { verifyAccessToken, type JwtUserPayload } from './auth';

export async function getAuthUser(req: Request): Promise<JwtUserPayload | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;

  return verifyAccessToken(token);
}

export function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers });
}

export function badRequest(message: string) {
  return NextResponse.json({ message, statusCode: 400 }, { status: 400 });
}

export function unauthorized(message = 'لازم تسجّل الدخول الأول') {
  return NextResponse.json({ message, statusCode: 401 }, { status: 401 });
}

export function forbidden(message = 'مش مسموح لك بالوصول') {
  return NextResponse.json({ message, statusCode: 403 }, { status: 403 });
}

export function notFound(message = 'العنصر غير موجود') {
  return NextResponse.json({ message, statusCode: 404 }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ message, statusCode: 409 }, { status: 409 });
}

export function serverError(message = 'حدث خطأ في الخادم') {
  return NextResponse.json({ message, statusCode: 500 }, { status: 500 });
}
