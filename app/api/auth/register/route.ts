import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/adapter';
import { hashPassword, hashToken, generateToken, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, companyName } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const { user, workspace } = await db.createUserWithWorkspace({
      email,
      passwordHash,
      name: name || email.split('@')[0],
      companyName,
    });

    // Create session
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    await db.createSession(user.id, tokenHash, req.headers.get('user-agent') || undefined);

    await db.recordAuditEvent(workspace.id, user.id, 'account_registered', `Email: ${email}`);

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      workspace: { id: workspace.id, name: workspace.name },
    });

    res.cookies.set({
      ...SESSION_COOKIE_OPTIONS,
      value: rawToken,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
