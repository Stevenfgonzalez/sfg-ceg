import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { hashPhone, phoneLast4 } from '@/lib/phone';

// POST /api/public/help
// Public help/triage request — writes to help_requests table
// Supports all 3 tiers: Tier 1 (911 triggered), Tier 2 (callback), Tier 3 (info)
export async function POST(request: NextRequest) {
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

  if (!triage_tier || ![1, 2, 3].includes(triage_tier)) {
    return NextResponse.json({ error: 'Valid triage tier required (1, 2, or 3)' }, { status: 400 });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!incident_id || !uuidRegex.test(incident_id)) {
    return NextResponse.json({ error: 'Valid incident ID required' }, { status: 400 });
  }

  try {
    const supabase = createBrowserClient();

    const row: Record<string, unknown> = {
      incident_id,
      complaint_code,
      complaint_label: complaint_label || complaint_code,
      triage_tier,
      dispatch_note: dispatch_note || null,
      caller_name: caller_name?.trim() || null,
      party_size: typeof party_size === 'number' ? Math.max(1, Math.min(50, party_size)) : 1,
      assembly_point: assembly_point || null,
      manual_address: manual_address?.trim() || null,
      other_text: typeof other_text === 'string' ? other_text.slice(0, 200) : null,
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
    }

    const { error } = await supabase.from('help_requests').insert(row);

    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        return NextResponse.json(
          { error: 'This incident is not currently active' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Help request failed. Please call 911.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, triage_tier });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
