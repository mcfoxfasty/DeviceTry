import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { db } from '@/lib/db/adapter';

export async function GET(req: NextRequest) {
  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const data = await db.getInspections(subscriber.workspace.id, limit, offset);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching inspections';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const result = await db.createInspection(subscriber.workspace.id, {
      device_id: body.deviceId || null,
      device_label: body.deviceLabel || 'Untitled Hardware',
      operator_name: body.operatorName || subscriber.user.name,
      locale: body.locale || 'en',
      summary_status: body.summaryStatus || 'inconclusive',
      tests_results: body.testsResults || {},
      notes: body.notes || null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(result.record, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error saving inspection';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Inspection ID is required' }, { status: 400 });
    }

    const deleted = await db.deleteInspection(subscriber.workspace.id, id);
    return NextResponse.json({ success: deleted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting inspection';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
