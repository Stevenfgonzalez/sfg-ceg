import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { hashPhone, phoneLast4, getHashVersion } from '@/lib/phone';
import { checkGeneralRateLimit } from '@/lib/rate-limit';
import { VALID_STATUSES, UUID_REGEX } from '@/lib/constants';
import { log } from '@/lib/logger';

// POST /api/public/checkin
// Public QR check-in — uses ANON key, RLS enforces insert-only + active incident
// Phone is hashed server-side before touching the database
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

  const { incident_id, full_name, phone, status } = body as {
    incident_id?: string;
    full_name?: string;
    phone?: string;
    status?: string;
  };

  // Validate required fields
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 1) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }

  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  if (!incident_id || !UUID_REGEX.test(incident_id)) {
    return NextResponse.json({ error: 'Valid incident ID required' }, { status: 400 });
  }

  try {
    const supabase = createBrowserClient();

    // Build insert row — hash phone, never store raw
    // Server-side length truncation for all text fields
    const safeName = (full_name as string).trim().slice(0, 200);
    const safeAssembly = typeof body.assembly_point === 'string' ? body.assembly_point.slice(0, 200) : null;
    const safeZone = typeof body.zone === 'string' ? body.zone.slice(0, 200) : null;
    const safeEmsNotes = typeof body.ems_notes === 'string' ? body.ems_notes.slice(0, 1000) : null;
    const safeDepartment = typeof body.department === 'string' ? body.department.slice(0, 500) : null;
    const safeRole = typeof body.role === 'string' ? body.role.slice(0, 500) : null;
    const safeNotes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null;
    const safeContactName = typeof body.contact_name === 'string' ? body.contact_name.trim().slice(0, 500) || null : null;
    const safeDependentNames = typeof body.dependent_names === 'string' ? body.dependent_names.slice(0, 500) : null;

    const row: Record<string, unknown> = {
      incident_id,
      full_name: safeName,
      status,
      assembly_point: safeAssembly,
      zone: safeZone,
      party_size: typeof body.party_size === 'number' ? Math.max(1, Math.min(50, body.party_size)) : 1,
      pet_count: typeof body.pet_count === 'number' ? Math.max(0, Math.min(20, body.pet_count)) : 0,
      has_dependents: body.has_dependents ?? false,
      dependent_names: safeDependentNames,
      needs_transport: body.needs_transport ?? false,
      ems_notes: safeEmsNotes,
      department: safeDepartment,
      role: safeRole,
      notes: safeNotes,
      contact_name: safeContactName,
    };

    // GPS location
    if (typeof body.lat === 'number' && typeof body.lon === 'number') {
      row.lat = body.lat;
      row.lon = body.lon;
    }

    // Phone hashing — raw phone NEVER touches the database
    if (phone && typeof phone === 'string' && phone.replace(/\D/g, '').length >= 10) {
      row.phone_hash = hashPhone(phone);
      row.phone_last4 = phoneLast4(phone);
      row.phone_hash_v = getHashVersion();
    }

    // Event ID dedup — if the client sent an event_id, store it and check for duplicates
    const eventId = typeof body.event_id === 'string' ? body.event_id.slice(0, 100) : null;
    if (eventId) {
      row.event_id = eventId;
      const { data: existing } = await supabase
        .from('checkins')
        .select('id')
        .eq('event_id', eventId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ success: true, message: 'Check-in already recorded (dedup)', deduplicated: true });
      }
    }

    const { error } = await supabase.from('checkins').insert(row);

    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        return NextResponse.json(
          { error: 'This incident is not currently active' },
          { status: 400 }
        );
      }
      log({ level: 'error', event: 'checkin_failed', route: '/api/public/checkin', incident_id, error: error.message });
      return NextResponse.json({ error: 'Check-in failed. Please try again.' }, { status: 500 });
    }

    log({ level: 'info', event: 'checkin_created', route: '/api/public/checkin', incident_id, duration_ms: Date.now() - start, meta: { status, party_size: row.party_size } });
    return NextResponse.json({ success: true, message: 'Check-in recorded' }, {
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    });
  } catch (err) {
    log({ level: 'error', event: 'checkin_error', route: '/api/public/checkin', incident_id, error: err instanceof Error ? err.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
