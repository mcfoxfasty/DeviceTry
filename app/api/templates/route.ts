import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { db } from '@/lib/db/adapter';

export async function GET() {
  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const templates = await db.getTemplates(subscriber.workspace.id);
    return NextResponse.json(templates);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching templates';
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
    if (!body.title) {
      return NextResponse.json({ error: 'Template title is required' }, { status: 400 });
    }

    const result = await db.createTemplate(subscriber.workspace.id, {
      title: body.title,
      description: body.description || null,
      tests_config: Array.isArray(body.testsConfig) ? body.testsConfig : ['mic', 'webcam', 'keyboard'],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(result.template, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating template';
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
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const deleted = await db.deleteTemplate(subscriber.workspace.id, id);
    return NextResponse.json({ success: deleted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting template';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
