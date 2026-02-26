import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient, createServiceClient } from '@/lib/supabase';
import { hashPhone, phoneLast4 } from '@/lib/phone';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/public/reunify
// Public reunification — two actions:
//   action: "lookup"  → Returns same message regardless (privacy-first)
//   action: "request" → Submits "I'm looking for someone" to reunification_requests
//
// Privacy rule: NEVER confirm whether someone has checked in.
// "Authorization without identification" — same principle as TAP ID.

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const { allowed, remaining } = checkRateLimit(ip);
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

  const action = body.action as string;
  const incident_id = body.incident_id as string;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!incident_id || !uuidRegex.test(incident_id)) {
    return NextResponse.json({ error: 'Valid incident ID required' }, { status: 400 });
  }

  // ── LOOKUP ──
  // Returns the SAME message regardless of whether someone checked in.
  // This prevents stalkers/abusers from confirming a target is at an evacuation site.
  if (action === 'lookup') {
    const phone = body.phone as string;
    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    try {
      const supabase = createServiceClient();
      const phoneHash = hashPhone(phone);

      // We still do the lookup server-side for audit logging,
      // but we NEVER tell the caller whether we found a match.
      const { data } = await supabase
        .from('checkins')
        .select('id')
        .eq('incident_id', incident_id)
        .eq('phone_hash', phoneHash)
        .limit(1)
        .maybeSingle();

      // Audit log
      await supabase.from('reunification_lookups').insert({
        incident_id,
        phone_hash: phoneHash,
        found: data !== null,
        ip_address: ip,
        user_agent: request.headers.get('user-agent') ?? null,
      });

      // SAME message regardless — authorization without identification
      return NextResponse.json({
        message: 'If this person has checked in, the reunification team has been notified of your request.',
      }, {
        headers: { 'X-RateLimit-Remaining': String(remaining) },
      });
    } catch {
      return NextResponse.json(
        { error: 'Lookup failed. Please try again.' },
        { status: 500 }
      );
    }
  }

  // ── REQUEST ──
  // "I'm looking for someone" — creates a reunification request for BRASS LE view
  if (action === 'request') {
    const {
      sought_phone,
      sought_name,
      requester_phone,
      requester_name,
      relationship,
    } = body as {
      sought_phone?: string;
      sought_name?: string;
      requester_phone?: string;
      requester_name?: string;
      relationship?: string;
    };

    if (!sought_phone && !sought_name) {
      return NextResponse.json(
        { error: 'Phone number or name of the person you are looking for is required' },
        { status: 400 }
      );
    }

    try {
      const supabase = createBrowserClient();

      const row: Record<string, unknown> = {
        incident_id,
        sought_name: sought_name?.trim() || null,
        requester_name: requester_name?.trim() || null,
        relationship: relationship || null,
      };

      if (sought_phone && typeof sought_phone === 'string' && sought_phone.replace(/\D/g, '').length >= 10) {
        row.sought_phone_hash = hashPhone(sought_phone);
      }

      if (requester_phone && typeof requester_phone === 'string' && requester_phone.replace(/\D/g, '').length >= 10) {
        row.requester_phone_hash = hashPhone(requester_phone);
        row.requester_phone_last4 = phoneLast4(requester_phone);
      }

      row.ip_address = ip;
      row.user_agent = request.headers.get('user-agent') ?? null;

      const { error } = await supabase.from('reunification_requests').insert(row);

      if (error) {
        if (error.code === '42501' || error.message.includes('policy')) {
          return NextResponse.json(
            { error: 'This incident is not currently active' },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: 'Request failed. Please try again.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Your request has been submitted. The reunification team will follow up.',
      });
    } catch {
      return NextResponse.json(
        { error: 'Request failed. Please try again.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Invalid action. Use "lookup" or "request".' }, { status: 400 });
}
