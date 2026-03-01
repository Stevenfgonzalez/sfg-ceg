import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { hashPhone, phoneLast4, getHashVersion } from '@/lib/phone';
import { checkGeneralRateLimit } from '@/lib/rate-limit';
import { VALID_COMPLAINT_CODES, UUID_REGEX, VALID_TRIAGE_TIERS } from '@/lib/constants';
import { log } from '@/lib/logger';

// POST /api/public/help
// Public help/triage request — writes to help_requests table
// Supports all 3 tiers: Tier 1 (911 triggered), Tier 2 (callback), Tier 3 (info)
export async function POST(request: NextRequest) {
  const start = Date.now();

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const { allowed, remaining } = await checkGeneralRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    incident_id,
    complaint_code,
    complaint_label,
    triage_tier,
    dispatch_note,
    caller_name,
    phone,
    party_size,
    assembly_point,
    lat,
    lon,
    manual_address,
    other_text,
  } = body as {
    incident_id?: string;
    complaint_code?: string;
    complaint_label?: string;
    triage_tier?: number;
    dispatch_note?: string;
    caller_name?: string;
    phone?: string;
    party_size?: number;
    assembly_point?: string;
    lat?: number;
    lon?: number;
    manual_address?: string;
    other_text?: string;
  };

  // Validate required fields
  if (!complaint_code) {
    return NextResponse.json({ error: 'Complaint code is required' }, { status: 400 });
  }

  // Validate complaint code against whitelist
  if (!VALID_COMPLAINT_CODES.has(complaint_code)) {
    return NextResponse.json({ error: 'Invalid complaint code' }, { status: 400 });
  }

  if (!triage_tier || !VALID_TRIAGE_TIERS.includes(triage_tier as typeof VALID_TRIAGE_TIERS[number])) {
    return NextResponse.json({ error: 'Valid triage tier required (1, 2, or 3)' }, { status: 400 });
  }

  if (!incident_id || !UUID_REGEX.test(incident_id)) {
    return NextResponse.json({ error: 'Valid incident ID required' }, { status: 400 });
  }

  try {
    const supabase = createBrowserClient();

    // Server-side length truncation for all text fields
    const safeComplaintLabel = typeof complaint_label === 'string' ? complaint_label.slice(0, 500) : complaint_code;
    const safeDispatchNote = typeof dispatch_note === 'string' ? dispatch_note.slice(0, 500) : null;
    const safeCallerName = caller_name?.trim().slice(0, 200) || null;
    const safeAssemblyPoint = typeof assembly_point === 'string' ? assembly_point.slice(0, 200) : null;
    const safeManualAddress = manual_address?.trim().slice(0, 500) || null;
    const safeOtherText = typeof other_text === 'string' ? other_text.slice(0, 200) : null;

    const row: Record<string, unknown> = {
      incident_id,
      complaint_code,
      complaint_label: safeComplaintLabel,
      triage_tier,
      dispatch_note: safeDispatchNote,
      caller_name: safeCallerName,
      party_size: typeof party_size === 'number' ? Math.max(1, Math.min(50, party_size)) : 1,
      assembly_point: safeAssemblyPoint,
      manual_address: safeManualAddress,
      other_text: safeOtherText,
      status: triage_tier === 3 ? 'INFO_ONLY' : 'NEW',
    };

    // GPS
    if (typeof lat === 'number' && typeof lon === 'number') {
      row.lat = lat;
      row.lon = lon;
    }

    // Phone hashing
    if (phone && typeof phone === 'string' && phone.replace(/\D/g, '').length >= 10) {
      row.phone_hash = hashPhone(phone);
      row.phone_last4 = phoneLast4(phone);
      row.phone_hash_v = getHashVersion();
    }

    // Event ID dedup — prevent duplicate submissions from outbox retries
    const eventId = typeof body.event_id === 'string' ? body.event_id.slice(0, 100) : null;
    if (eventId) {
      row.event_id = eventId;
      const { data: existing } = await supabase
        .from('help_requests')
        .select('id')
        .eq('event_id', eventId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ success: true, message: 'Help request already recorded (dedup)', deduplicated: true });
      }
    }

    const { error } = await supabase.from('help_requests').insert(row);

    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        return NextResponse.json(
          { error: 'This incident is not currently active' },
          { status: 400 }
        );
      }
      log({ level: 'error', event: 'help_failed', route: '/api/public/help', incident_id, error: error.message });
      return NextResponse.json({ error: 'Help request failed. Please call 911.' }, { status: 500 });
    }

    log({ level: 'info', event: 'help_created', route: '/api/public/help', incident_id, duration_ms: Date.now() - start, meta: { complaint_code, triage_tier } });
    return NextResponse.json({ success: true, triage_tier }, {
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    });
  } catch (err) {
    log({ level: 'error', event: 'help_error', route: '/api/public/help', incident_id, error: err instanceof Error ? err.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
