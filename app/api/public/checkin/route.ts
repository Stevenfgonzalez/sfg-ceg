import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { hashPhone, phoneLast4, getHashVersion } from '@/lib/phone';
import { checkGeneralRateLimit } from '@/lib/rate-limit';
import { NEED_CATEGORIES } from '@/lib/constants';
import { validateCheckinBody } from '@/lib/api-validation';
import { log } from '@/lib/logger';

// POST /api/public/checkin
// Public QR check-in — uses ANON key, RLS enforces insert-only + active incident
// Phone is hashed server-side before touching the database
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

  // Validate with shared validator
  const result = validateCheckinBody(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }
  const data = result.data;

  try {
    const supabase = createBrowserClient();

    // Generate update token (12 hex chars from UUID)
    const checkinToken = crypto.randomUUID().slice(0, 12);

    const row: Record<string, unknown> = {
      incident_id: data.incident_id,
      full_name: data.full_name,
      status: data.status,
      assembly_point: data.assembly_point,
      zone: data.zone,
      party_size: data.party_size,
      pet_count: data.pet_count,
      has_dependents: data.has_dependents,
      dependent_names: data.dependent_names,
      needs_transport: data.needs_transport,
      ems_notes: data.ems_notes,
      department: data.department,
      role: data.role,
      notes: data.notes,
      contact_name: data.contact_name,
      // Needs assessment fields
      adult_count: data.adult_count,
      child_count: data.child_count,
      priority: data.priority,
      needs_categories: data.needs_categories,
      checkin_token: checkinToken,
    };

    // GPS location
    if (data.lat !== undefined && data.lon !== undefined) {
      row.lat = data.lat;
      row.lon = data.lon;
    }

    // Phone hashing — raw phone NEVER touches the database
    if (data.phone && data.phone.replace(/\D/g, '').length >= 10) {
      row.phone_hash = hashPhone(data.phone);
      row.phone_last4 = phoneLast4(data.phone);
      row.phone_hash_v = getHashVersion();
    }

    // Event ID dedup — if the client sent an event_id, store it and check for duplicates
    const eventId = typeof body.event_id === 'string' ? body.event_id.slice(0, 100) : null;
    if (eventId) {
      row.event_id = eventId;
      const { data: existing } = await supabase
        .from('checkins')
        .select('id, checkin_token')
        .eq('event_id', eventId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          success: true,
          message: 'Check-in already recorded (dedup)',
          deduplicated: true,
          checkin_token: existing.checkin_token,
        });
      }
    }

    const { data: inserted, error } = await supabase
      .from('checkins')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        return NextResponse.json(
          { error: 'This incident is not currently active' },
          { status: 400 }
        );
      }
      log({ level: 'error', event: 'checkin_failed', route: '/api/public/checkin', incident_id: data.incident_id, error: error.message });
      return NextResponse.json({ error: 'Check-in failed. Please try again.' }, { status: 500 });
    }

    // Auto-create help_request if priority is IMMEDIATE or needs include EMS-critical categories
    const emsCriticalCodes: Set<string> = new Set(
      NEED_CATEGORIES.filter(c => c.needs_ems).map(c => c.code)
    );
    const hasEmsCritical = data.needs_categories.some(c => emsCriticalCodes.has(c));

    if (inserted && (data.priority === 'IMMEDIATE' || hasEmsCritical)) {
      const helpRow: Record<string, unknown> = {
        incident_id: data.incident_id,
        complaint_code: hasEmsCritical ? data.needs_categories.find(c => emsCriticalCodes.has(c))! : 'OTHER',
        complaint_label: hasEmsCritical
          ? NEED_CATEGORIES.find(c => data.needs_categories.includes(c.code) && c.needs_ems)?.label ?? 'Needs assessment escalation'
          : 'Priority: IMMEDIATE',
        triage_tier: hasEmsCritical ? 2 : 3,
        dispatch_note: `Auto-created from check-in. Priority: ${data.priority ?? 'none'}. Needs: ${data.needs_categories.join(', ') || 'none'}`,
        caller_name: data.full_name,
        party_size: data.party_size,
        assembly_point: data.assembly_point,
        status: 'NEW',
        checkin_id: inserted.id,
      };

      if (data.lat !== undefined && data.lon !== undefined) {
        helpRow.lat = data.lat;
        helpRow.lon = data.lon;
      }

      if (data.phone && data.phone.replace(/\D/g, '').length >= 10) {
        helpRow.phone_hash = hashPhone(data.phone);
        helpRow.phone_last4 = phoneLast4(data.phone);
        helpRow.phone_hash_v = getHashVersion();
      }

      const { error: helpError } = await supabase.from('help_requests').insert(helpRow);
      if (helpError) {
        log({ level: 'warn', event: 'checkin_help_link_failed', route: '/api/public/checkin', incident_id: data.incident_id, error: helpError.message });
      }
    }

    log({ level: 'info', event: 'checkin_created', route: '/api/public/checkin', incident_id: data.incident_id, duration_ms: Date.now() - start, meta: { status: data.status, party_size: data.party_size, priority: data.priority, needs_count: data.needs_categories.length } });
    return NextResponse.json({ success: true, message: 'Check-in recorded', checkin_token: checkinToken }, {
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    });
  } catch (err) {
    log({ level: 'error', event: 'checkin_error', route: '/api/public/checkin', incident_id: data.incident_id, error: err instanceof Error ? err.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
