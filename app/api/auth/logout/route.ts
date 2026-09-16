import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/adapter';
import { hashToken, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value;
    if (token) {
      const tokenHash = await hashToken(token);
      await db.deleteSessionByTokenHash(tokenHash);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set({
      ...SESSION_COOKIE_OPTIONS,
      value: '',
      maxAge: 0,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Logout failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
