import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { hashPhone } from '@/lib/phone';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/public/reunification
// Public reunification lookup — privacy proxy
//
// Uses service role server-side BY DESIGN because:
//   - Anon cannot SELECT from checkins (RLS blocks it)
//   - This route acts as the security boundary
//   - Only returns 1 of 3 fixed messages, never raw data
//   - Rate limited + audit logged
//
// Body: { phone: string, incident_id: string }
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

    // Service role: bypasses RLS to read checkins (anon can't SELECT)
    // Only fetches status column — nothing else leaves the server
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

    // Audit log
    await supabase.from('reunification_lookups').insert({
      incident_id,
      phone_hash: phoneHash,
      found: data !== null,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') ?? null,
    });

    // Return ONLY one of 3 fixed messages — never location, timestamp, or EMS flags
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
