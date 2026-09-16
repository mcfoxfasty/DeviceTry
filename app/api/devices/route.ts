import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { db } from '@/lib/db/adapter';

export async function GET() {
  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const devices = await db.getDevices(subscriber.workspace.id);
    return NextResponse.json(devices);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching devices';
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
    if (!body.name) {
      return NextResponse.json({ error: 'Device name is required' }, { status: 400 });
    }

    const result = await db.createDevice(subscriber.workspace.id, {
      name: body.name,
      model_identifier: body.modelIdentifier || null,
      serial_number: body.serialNumber || null,
      assigned_to: body.assignedTo || null,
      category: body.category || 'laptop',
      notes: body.notes || null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(result.device, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating device';
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
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const deleted = await db.deleteDevice(subscriber.workspace.id, id);
    return NextResponse.json({ success: deleted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting device';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
