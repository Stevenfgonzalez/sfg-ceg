import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { hashPhone, phoneLast4 } from '@/lib/phone';

// POST /api/checkin
// Public QR check-in — hashes phone server-side before storing
//
// Body: {
//   incident_id: string,
//   full_name: string,
//   phone?: string,
//   status: "SAFE" | "SIP" | "NEED_EMS",
//   assembly_point?: string,
//   zone?: string,
//   party_size?: number,
//   has_dependents?: boolean,
//   dependent_names?: string[],
//   needs_transport?: boolean,
//   ems_notes?: string,
//   department?: string,
//   role?: string,
//   notes?: string,
// }
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
    const supabase = createServiceClient();

    // Verify incident is active
    const { data: incident } = await supabase
      .from('incidents')
      .select('status')
      .eq('id', incident_id)
      .single();

    if (!incident || incident.status !== 'active') {
      return NextResponse.json(
        { error: 'This incident is not currently active' },
        { status: 400 }
      );
    }

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
