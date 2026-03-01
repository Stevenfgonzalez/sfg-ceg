import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';

// POST /api/analytics — fire-and-forget event logging
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, props, page, referrer } = body;

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'Missing event' }, { status: 400 });
    }

    const supabase = createBrowserClient();
    await supabase.from('analytics_events').insert({
      event: event.slice(0, 100),
      props: props || {},
      page: page?.slice(0, 200) || null,
      referrer: referrer?.slice(0, 500) || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Never fail visibly
  }
}
