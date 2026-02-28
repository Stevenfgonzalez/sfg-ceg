import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { hashPhone, phoneLast4, getHashVersion } from '@/lib/phone';
import { checkGeneralRateLimit } from '@/lib/rate-limit';
import { VALID_COMPLAINT_CODES, DEFAULT_INCIDENT_ID } from '@/lib/constants';
import { log } from '@/lib/logger';

// POST /api/public/ems
// Public EMS request — stores as a NEED_MEDICAL check-in with complaint metadata
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

  // Validate complaint code against whitelist
  if (!VALID_COMPLAINT_CODES.has(complaint_code)) {
    return NextResponse.json({ error: 'Invalid complaint code' }, { status: 400 });
  }

  try {
    const supabase = createBrowserClient();

    // Server-side length truncation for all text fields
    const safeFirstName = first_name?.trim().slice(0, 200) || 'EMS Caller';
    const safeComplaintLabel = typeof complaint_label === 'string' ? complaint_label.slice(0, 500) : complaint_code;
    const safeDispatchNote = typeof dispatch_note === 'string' ? dispatch_note.slice(0, 500) : null;
    const safeOtherText = typeof other_text === 'string' ? other_text.slice(0, 200) : null;
    const safeManualAddress = typeof manual_address === 'string' ? manual_address.slice(0, 500) : null;

    // Build EMS notes with structured complaint data for dispatch
    const emsNoteParts = [
      `[EMS-${complaint_code}] ${safeComplaintLabel}`,
      `Tier: ${tier === 1 ? 'CRITICAL' : 'MINOR'}`,
      safeDispatchNote ? `Dispatch: ${safeDispatchNote}` : null,
      safeOtherText ? `Details: ${safeOtherText}` : null,
      safeManualAddress ? `Address: ${safeManualAddress}` : null,
    ].filter(Boolean);

    const row: Record<string, unknown> = {
      incident_id: DEFAULT_INCIDENT_ID,
      full_name: safeFirstName,
      status: 'NEED_MEDICAL',
      party_size: typeof people_count === 'number' ? Math.max(1, Math.min(50, people_count)) : 1,
      pet_count: 0,
      ems_notes: emsNoteParts.join(' | ').slice(0, 1000),
      needs_transport: tier === 1,
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

    const { error } = await supabase.from('checkins').insert(row);

    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        return NextResponse.json(
          { error: 'Unable to submit EMS request' },
          { status: 400 }
        );
      }
      log({ level: 'error', event: 'ems_failed', route: '/api/public/ems', error: error.message, meta: { complaint_code } });
      return NextResponse.json({ error: 'EMS request failed. Please call 911.' }, { status: 500 });
    }

    log({ level: 'info', event: 'ems_created', route: '/api/public/ems', duration_ms: Date.now() - start, meta: { complaint_code, tier } });
    return NextResponse.json({ success: true, message: 'EMS request recorded', tier }, {
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    });
  } catch (err) {
    log({ level: 'error', event: 'ems_error', route: '/api/public/ems', error: err instanceof Error ? err.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
