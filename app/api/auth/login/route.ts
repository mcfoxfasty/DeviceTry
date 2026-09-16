import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/adapter';
import { verifyPassword, hashToken, generateToken, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';
import { isProEnabled } from '@/lib/config/mode';

export async function POST(req: NextRequest) {
  if (!isProEnabled()) {
    return NextResponse.json({ error: 'Pro features are disabled in FREE_ONLY mode.' }, { status: 404 });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await db.getUserByEmail(email);
    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const workspace = await db.getWorkspaceByUserId(user.id);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 500 });
    }

    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    await db.createSession(user.id, tokenHash, req.headers.get('user-agent') || undefined);

    await db.recordAuditEvent(workspace.id, user.id, 'subscriber_signin', `Email: ${email}`);

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
    const msg = err instanceof Error ? err.message : 'Sign-in failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
