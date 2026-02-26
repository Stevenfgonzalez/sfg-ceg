import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { hashPhone, phoneLast4 } from '@/lib/phone';

const VALID_STATUSES = [
  'SAFE',
  'EVACUATING',
  'AT_MUSTER',
  'SHELTERING_HERE',
  'NEED_HELP',
  'NEED_MEDICAL',
  'LOOKING_FOR_SOMEONE',
  // Backward compat with Phase 1 codes
  'SIP',
  'NEED_EMS',
];

// POST /api/public/checkin
// Public QR check-in — uses ANON key, RLS enforces insert-only + active incident
// Phone is hashed server-side before touching the database
export async function POST(request: NextRequest) {
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

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!incident_id || !uuidRegex.test(incident_id)) {
    return NextResponse.json({ error: 'Valid incident ID required' }, { status: 400 });
  }

  try {
    const supabase = createBrowserClient();

    // Build insert row — hash phone, never store raw
    const row: Record<string, unknown> = {
      incident_id,
      full_name: (full_name as string).trim(),
      status,
      assembly_point: body.assembly_point ?? null,
      zone: body.zone ?? null,
      party_size: typeof body.party_size === 'number' ? Math.max(1, Math.min(50, body.party_size)) : 1,
      pet_count: typeof body.pet_count === 'number' ? Math.max(0, Math.min(20, body.pet_count)) : 0,
      has_dependents: body.has_dependents ?? false,
      dependent_names: body.dependent_names ?? null,
      needs_transport: body.needs_transport ?? false,
      ems_notes: body.ems_notes ?? null,
      department: body.department ?? null,
      role: body.role ?? null,
      notes: body.notes ?? null,
      contact_name: typeof body.contact_name === 'string' ? body.contact_name.trim() || null : null,
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
    }

    const { error } = await supabase.from('checkins').insert(row);

    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        return NextResponse.json(
          { error: 'This incident is not currently active' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Check-in failed. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Check-in recorded' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
