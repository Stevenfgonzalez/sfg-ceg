import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';

/** Sanitize analytics props — flat object, safe types, bounded size */
function sanitizeProps(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 20) break; // max 20 keys
    const key = String(k).slice(0, 50);
    if (typeof v === 'string') clean[key] = v.slice(0, 500);
    else if (typeof v === 'number' && Number.isFinite(v)) clean[key] = v;
    else if (typeof v === 'boolean') clean[key] = v;
    count++;
  }
  return clean;
}

// POST /api/analytics — fire-and-forget event logging
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 4096) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const body = JSON.parse(raw);
    const { event, props, page, referrer } = body;

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'Missing event' }, { status: 400 });
    }

    const supabase = createBrowserClient();
    await supabase.from('analytics_events').insert({
      event: event.slice(0, 100),
      props: sanitizeProps(props),
      page: typeof page === 'string' ? page.slice(0, 200) : null,
      referrer: typeof referrer === 'string' ? referrer.slice(0, 500) : null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Never fail visibly
  }
}
