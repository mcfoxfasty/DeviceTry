import { NextResponse } from 'next/server';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { db } from '@/lib/db/adapter';

export async function GET() {
  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const data = await db.exportWorkspaceData(subscriber.workspace.id);
    await db.recordAuditEvent(subscriber.workspace.id, subscriber.user.id, 'data_exported');

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="devicetry-export-${Date.now()}.json"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
