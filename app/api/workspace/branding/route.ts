import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { db } from '@/lib/db/adapter';

export async function PUT(req: NextRequest) {
  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { companyName, logoUrl } = await req.json();
    const updated = await db.updateWorkspaceBranding(subscriber.workspace.id, {
      companyName: typeof companyName === 'string' ? companyName.trim() : undefined,
      logoUrl: typeof logoUrl === 'string' ? logoUrl.trim() : undefined,
    });

    await db.recordAuditEvent(subscriber.workspace.id, subscriber.user.id, 'branding_updated');
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating branding';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
