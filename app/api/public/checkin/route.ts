import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { hashPhone, phoneLast4 } from '@/lib/phone';

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

  const validStatuses = ['SAFE', 'SIP', 'NEED_EMS'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: 'Status must be SAFE, SIP, or NEED_EMS' },
      { status: 400 }
    );
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!incident_id || !uuidRegex.test(incident_id)) {
    return NextResponse.json({ error: 'Valid incident ID required' }, { status: 400 });
  }

  try {
    // Anon key client — RLS enforces:
    //   - INSERT only (no select/update/delete)
    //   - incident must be active (with check subquery)
    const supabase = createBrowserClient();

    // Build insert row — hash phone, never store raw
    const row: Record<string, unknown> = {
      incident_id,
      full_name: (full_name as string).trim(),
      status,
      assembly_point: body.assembly_point ?? null,
      zone: body.zone ?? null,
      party_size: body.party_size ?? 1,
      has_dependents: body.has_dependents ?? false,
      dependent_names: body.dependent_names ?? null,
      needs_transport: body.needs_transport ?? false,
      ems_notes: body.ems_notes ?? null,
      department: body.department ?? null,
      role: body.role ?? null,
      notes: body.notes ?? null,
    };

    // Phone hashing — raw phone NEVER touches the database
    if (phone && typeof phone === 'string' && phone.replace(/\D/g, '').length >= 10) {
      row.phone_hash = hashPhone(phone);
      row.phone_last4 = phoneLast4(phone);
    }

    const { error } = await supabase.from('checkins').insert(row);

    if (error) {
      // RLS will reject if incident is not active
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
