import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { hashPhone, phoneLast4 } from '@/lib/phone';

// POST /api/public/ems
// Public EMS request — stores as a NEED_MEDICAL check-in with complaint metadata
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    complaint_code,
    complaint_label,
    tier,
    dispatch_note,
    first_name,
    phone,
    people_count,
    other_text,
    lat,
    lon,
    manual_address,
  } = body as {
    complaint_code?: string;
    complaint_label?: string;
    tier?: number;
    dispatch_note?: string;
    first_name?: string;
    phone?: string;
    people_count?: number;
    other_text?: string;
    lat?: number;
    lon?: number;
    manual_address?: string;
  };

  if (!complaint_code) {
    return NextResponse.json({ error: 'Complaint code is required' }, { status: 400 });
  }

  try {
    const supabase = createBrowserClient();

    // Build EMS notes with structured complaint data for dispatch
    const emsNoteParts = [
      `[EMS-${complaint_code}] ${complaint_label || complaint_code}`,
      `Tier: ${tier === 1 ? 'CRITICAL' : 'MINOR'}`,
      dispatch_note ? `Dispatch: ${dispatch_note}` : null,
      other_text ? `Details: ${other_text}` : null,
      manual_address ? `Address: ${manual_address}` : null,
    ].filter(Boolean);

    const row: Record<string, unknown> = {
      // Use a default incident ID — EMS requests work without a QR-scoped incident
      incident_id: '00000000-0000-0000-0000-000000000000',
      full_name: first_name?.trim() || 'EMS Caller',
      status: 'NEED_MEDICAL',
      party_size: typeof people_count === 'number' ? Math.max(1, Math.min(50, people_count)) : 1,
      pet_count: 0,
      ems_notes: emsNoteParts.join(' | '),
      needs_transport: tier === 1, // Critical complaints likely need transport
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
    }

    const { error } = await supabase.from('checkins').insert(row);

    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        return NextResponse.json(
          { error: 'Unable to submit EMS request' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'EMS request failed. Please call 911.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'EMS request recorded', tier });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
