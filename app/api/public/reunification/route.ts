import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { hashPhone, hashPhoneLegacy, getHashVersion } from '@/lib/phone';
import { checkReunificationRateLimit } from '@/lib/rate-limit';
import { UUID_REGEX } from '@/lib/constants';
import { log } from '@/lib/logger';

// POST /api/public/reunification
// DEPRECATED — use /api/public/reunify instead
//
// Privacy-first reunification lookup.
// Returns the SAME message regardless of match — "authorization without identification."
// Never reveals whether someone has checked in or their triage status.
export async function POST(request: NextRequest) {
  const start = Date.now();

  // Rate limit by IP — anti-stalking measure
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const { allowed, remaining } = await checkReunificationRateLimit(ip);

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

  if (!incident_id || !UUID_REGEX.test(incident_id)) {
    return NextResponse.json({ error: 'Valid incident ID required' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const phoneHash = hashPhone(phone);

    // Dual-version lookup: try current hash first, then legacy if different
    let found = false;
    const { data } = await supabase
      .from('checkins')
      .select('id')
      .eq('incident_id', incident_id)
      .eq('phone_hash', phoneHash)
      .limit(1)
      .maybeSingle();

    found = data !== null;

    // If using v2 hashing and no match, try legacy v1 hash
    if (!found && getHashVersion() === 2) {
      const legacyHash = hashPhoneLegacy(phone);
      if (legacyHash !== phoneHash) {
        const { data: legacyData } = await supabase
          .from('checkins')
          .select('id')
          .eq('incident_id', incident_id)
          .eq('phone_hash', legacyHash)
          .limit(1)
          .maybeSingle();
        found = legacyData !== null;
      }
    }

    // Audit log — records lookup for LE analysis
    await supabase.from('reunification_lookups').insert({
      incident_id,
      phone_hash: phoneHash,
      found,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') ?? null,
    });

    log({ level: 'info', event: 'reunification_lookup', route: '/api/public/reunification', incident_id, duration_ms: Date.now() - start });

    // SAME message regardless — authorization without identification
    return NextResponse.json({
      message: 'If this person has checked in, the reunification team has been notified of your request.',
    }, {
      headers: {
        'X-RateLimit-Remaining': String(remaining),
        'Deprecation': 'true',
        'Link': '</api/public/reunify>; rel="successor-version"',
      },
    });
  } catch (err) {
    log({ level: 'error', event: 'reunification_error', route: '/api/public/reunification', incident_id, error: err instanceof Error ? err.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Lookup failed. Please try again.' },
      { status: 500 }
    );
  }
}
