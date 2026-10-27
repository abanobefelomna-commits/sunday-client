import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeRefreshToken } from '@/src/server/auth';

export async function POST(req: Request) {
  let token: string | undefined;

  const cookieStore = await cookies();
  token = cookieStore.get('refresh_token')?.value;

  if (!token) {
    try {
      const body = await req.json();
      token = body?.refreshToken;
    } catch {
      // ignore
    }
  }

  if (token) {
    await revokeRefreshToken(token);
  }

  const res = NextResponse.json({ message: 'تم تسجيل الخروج' });
  res.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    expires: new Date(0),
  });

  return res;
}
