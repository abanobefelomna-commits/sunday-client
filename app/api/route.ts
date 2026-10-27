import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    name: 'Sunday School API (Next.js)',
    timestamp: new Date().toISOString(),
  });
}
