import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSubscriber, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';
import { db } from '@/lib/db/adapter';
import { isProEnabled } from '@/lib/config/mode';

export async function POST(req: NextRequest) {
  if (!isProEnabled()) {
    return NextResponse.json({ error: 'Pro features are disabled in FREE_ONLY mode.' }, { status: 404 });
  }

  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { confirmEmail } = await req.json();
    if (confirmEmail?.toLowerCase() !== subscriber.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Confirmation email does not match your account email.' },
        { status: 400 }
      );
    }

    await db.deleteUserAndWorkspace(subscriber.user.id);

    const res = NextResponse.json({ success: true, message: 'Account and associated data deleted permanently.' });
    res.cookies.set({
      ...SESSION_COOKIE_OPTIONS,
      value: '',
      maxAge: 0,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Account deletion failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
