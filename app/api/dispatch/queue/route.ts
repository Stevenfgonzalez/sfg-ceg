import { NextRequest, NextResponse } from 'next/server';
import { verifyDispatchAuth } from '@/lib/dispatch-auth';
import { createServiceClient } from '@/lib/supabase';
import { log } from '@/lib/logger';

// GET /api/dispatch/queue — fetch priority checkins + help requests
export async function GET(request: NextRequest) {
  if (!verifyDispatchAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();

  try {
    const supabase = createServiceClient();

    const [checkinsResult, helpResult] = await Promise.all([
      supabase
        .from('checkins')
        .select(
          'id, full_name, status, priority, party_size, assembly_point, zone, lat, lon, needs_categories, ems_notes, notes, created_at'
        )
        .eq('priority', 'IMMEDIATE')
        .order('created_at', { ascending: true })
        .limit(100),
      supabase
        .from('help_requests')
        .select(
          'id, caller_name, complaint_code, complaint_label, triage_tier, dispatch_note, party_size, assembly_point, lat, lon, status, manual_address, created_at'
        )
        .in('status', ['NEW', 'ASSIGNED'])
        .order('triage_tier', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(200),
    ]);

    if (checkinsResult.error) {
      log({
        level: 'error',
        event: 'dispatch_queue_checkins_error',
        route: '/api/dispatch/queue',
        error: checkinsResult.error.message,
      });
    }

    if (helpResult.error) {
      log({
        level: 'error',
        event: 'dispatch_queue_help_error',
        route: '/api/dispatch/queue',
        error: helpResult.error.message,
      });
    }

    log({
      level: 'info',
      event: 'dispatch_queue_fetched',
      route: '/api/dispatch/queue',
      duration_ms: Date.now() - start,
      meta: {
        checkins_count: checkinsResult.data?.length ?? 0,
        help_count: helpResult.data?.length ?? 0,
      },
    });

    return NextResponse.json(
      {
        checkins: checkinsResult.data ?? [],
        help_requests: helpResult.data ?? [],
        timestamp: new Date().toISOString(),
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    log({
      level: 'error',
      event: 'dispatch_queue_error',
      route: '/api/dispatch/queue',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
