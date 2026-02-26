import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { hashPhone } from '@/lib/phone';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/reunification
// Public reunification lookup — returns minimal status only
//
// Body: { phone: string, incident_id: string }
// Returns: { status: "safe" | "not_found" | "reunification_notified" }
export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const { allowed, remaining } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      }
    );
  }

  // Parse body
  let body: { phone?: string; incident_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { phone, incident_id } = body;

  if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!incident_id || !uuidRegex.test(incident_id)) {
    return NextResponse.json({ error: 'Valid incident ID required' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const phoneHash = hashPhone(phone);

    // Check if this phone has checked in for this incident
    const { data, error } = await supabase
      .from('checkins')
      .select('status')
      .eq('incident_id', incident_id)
      .eq('phone_hash', phoneHash)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Lookup failed. Please try again.' },
        { status: 500 }
      );
    }

    // Log the lookup attempt (audit trail)
    await supabase.from('reunification_lookups').insert({
      incident_id,
      phone_hash: phoneHash,
      found: data !== null,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') ?? null,
    });

    // Return minimal information — NEVER location, timestamp, or EMS flags
    let result: { message: string; checked_in: boolean };

    if (!data) {
      result = {
        message: 'No check-in found for this number.',
        checked_in: false,
      };
    } else if (data.status === 'SAFE') {
      result = {
        message: 'This number is marked SAFE.',
        checked_in: true,
      };
    } else {
      // SIP or NEED_EMS — do NOT reveal medical status to public
      // Use the same neutral message for both
      result = {
        message: 'This person has checked in. The reunification team has been notified.',
        checked_in: true,
      };
    }

    return NextResponse.json(result, {
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
