import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { log } from '@/lib/logger';

// POST /api/edge-sync
// Receives batched events from edge-api (Pi 5) when backhaul returns.
// Inserts check-in events into the checkins table (same as phone check-ins)
// and logs all events to lorawan_events.

interface EdgeSyncEvent {
  event_id: string;
  event_type: string;
  system: string;
  fport?: number | null;
  dev_eui?: string | null;
  zone_id?: string | null;
  payload: Record<string, unknown>;
  source: string;
  occurred_at: string;
}

interface EdgeSyncBatch {
  edge_node_id: string;
  batch: EdgeSyncEvent[];
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const start = Date.now();

  // Authenticate edge node
  const secret = request.headers.get('x-edge-sync-secret');
  const expectedSecret = process.env.EDGE_SYNC_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    log.warn('[edge-sync] Invalid secret', { ip: request.headers.get('x-forwarded-for') });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: EdgeSyncBatch;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }

  if (!body.edge_node_id || !Array.isArray(body.batch) || body.batch.length === 0) {
    return NextResponse.json({ error: 'edge_node_id and non-empty batch required' }, { status: 400 });
  }

  if (body.batch.length > 200) {
    return NextResponse.json({ error: 'batch too large (max 200)' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const accepted: string[] = [];
  const rejected: string[] = [];

  for (const event of body.batch) {
    try {
      // Log to lorawan_events (dedup on event_id)
      const { error: logError } = await supabase
        .from('lorawan_events')
        .upsert(
          {
            event_id: event.event_id,
            event_type: event.event_type,
            system: event.system,
            fport: event.fport ?? null,
            dev_eui: event.dev_eui ?? null,
            zone_id: event.zone_id ?? null,
            payload: event.payload,
            source: event.source,
            edge_node_id: body.edge_node_id,
            occurred_at: event.occurred_at,
          },
          { onConflict: 'event_id', ignoreDuplicates: true }
        );

      if (logError) {
        log.warn('[edge-sync] lorawan_events insert error', { event_id: event.event_id, error: logError.message });
      }

      // For check-in type events, also insert into checkins table
      if (event.event_type === 'PHONE_CHECKIN' || event.event_type === 'MUSTER_BUTTON') {
        await processCheckinEvent(supabase, event);
      }

      accepted.push(event.event_id);
    } catch (err) {
      log.error('[edge-sync] event processing error', {
        event_id: event.event_id,
        error: err instanceof Error ? err.message : String(err),
      });
      rejected.push(event.event_id);
    }
  }

  const duration = Date.now() - start;
  log.info('[edge-sync] batch processed', {
    edge_node_id: body.edge_node_id,
    total: body.batch.length,
    accepted: accepted.length,
    rejected: rejected.length,
    duration_ms: duration,
  });

  return NextResponse.json({
    accepted_event_ids: accepted,
    rejected_event_ids: rejected,
  });
}

async function processCheckinEvent(
  supabase: ReturnType<typeof createServiceClient>,
  event: EdgeSyncEvent
): Promise<void> {
  const payload = event.payload;

  // Map edge check-in payload to CEG checkins table format
  const checkinData: Record<string, unknown> = {
    event_id: event.event_id,
    zone_id: payload.zone_id ?? event.zone_id,
    status: payload.status ?? 'SAFE',
    party_size: Math.min(Math.max(Number(payload.party_size) || 1, 1), 50),
    source: 'edge_lora',
    created_at: event.occurred_at,
  };

  // Muster button payloads have a different structure
  if (event.event_type === 'MUSTER_BUTTON') {
    checkinData.status = payload.status ?? 'AT_MUSTER';
    checkinData.party_size = payload.partySize ?? 1;
    if (payload.flags) {
      const flags = payload.flags as Record<string, boolean>;
      checkinData.needs_medical = flags.needsMedical ?? false;
      checkinData.needs_transport = flags.needsTransport ?? false;
    }
  }

  const { error } = await supabase
    .from('checkins')
    .upsert(checkinData, { onConflict: 'event_id', ignoreDuplicates: true });

  if (error) {
    log.warn('[edge-sync] checkins insert error', {
      event_id: event.event_id,
      error: error.message,
    });
  }
}
