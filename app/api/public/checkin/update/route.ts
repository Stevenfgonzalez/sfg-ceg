import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { checkGeneralRateLimit } from '@/lib/rate-limit';
import { NEED_CATEGORIES } from '@/lib/constants';
import { validateCheckinUpdateBody } from '@/lib/api-validation';
import { log } from '@/lib/logger';

// PATCH /api/public/checkin/update
// Token-based update for "Update My Needs" flow — no auth required.
// Client must provide the checkin_token returned from the original POST.
export async function PATCH(request: NextRequest) {
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

  const result = validateCheckinUpdateBody(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }
  const data = result.data;

  try {
    const supabase = createBrowserClient();

    // Look up checkin by token
    const { data: checkin, error: lookupError } = await supabase
      .from('checkins')
      .select('id, incident_id, priority, needs_categories')
      .eq('checkin_token', data.checkin_token)
      .limit(1)
      .maybeSingle();

    if (lookupError || !checkin) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }

    // Build update payload — only set fields that were provided
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.needs_categories !== undefined) updates.needs_categories = data.needs_categories;
    if (data.status !== undefined) updates.status = data.status;
    if (data.notes !== undefined) updates.notes = data.notes;

    const { error: updateError } = await supabase
      .from('checkins')
      .update(updates)
      .eq('id', checkin.id);

    if (updateError) {
      log({ level: 'error', event: 'checkin_update_failed', route: '/api/public/checkin/update', incident_id: checkin.incident_id, error: updateError.message });
      return NextResponse.json({ error: 'Update failed. Please try again.' }, { status: 500 });
    }

    // Check if needs escalated — create/update linked help_request
    const newPriority = data.priority ?? checkin.priority;
    const newNeeds: string[] = data.needs_categories ?? checkin.needs_categories ?? [];
    const emsCriticalCodes: Set<string> = new Set(
      NEED_CATEGORIES.filter(c => c.needs_ems).map(c => c.code)
    );
    const hasEmsCritical = newNeeds.some(c => emsCriticalCodes.has(c));

    if (newPriority === 'IMMEDIATE' || hasEmsCritical) {
      // Check if a linked help_request already exists
      const { data: existingHelp } = await supabase
        .from('help_requests')
        .select('id')
        .eq('checkin_id', checkin.id)
        .limit(1)
        .maybeSingle();

      if (existingHelp) {
        // Update existing help_request
        const helpUpdates: Record<string, unknown> = {
          dispatch_note: `Updated from check-in. Priority: ${newPriority ?? 'none'}. Needs: ${newNeeds.join(', ') || 'none'}`,
        };
        if (hasEmsCritical) {
          helpUpdates.complaint_code = newNeeds.find(c => emsCriticalCodes.has(c))!;
          helpUpdates.triage_tier = 2;
        }
        await supabase.from('help_requests').update(helpUpdates).eq('id', existingHelp.id);
      } else {
        // Create new help_request linked to this checkin
        const { data: checkinFull } = await supabase
          .from('checkins')
          .select('full_name, assembly_point, party_size, lat, lon, phone_hash, phone_last4, phone_hash_v')
          .eq('id', checkin.id)
          .single();

        if (checkinFull) {
          const helpRow: Record<string, unknown> = {
            incident_id: checkin.incident_id,
            complaint_code: hasEmsCritical ? newNeeds.find(c => emsCriticalCodes.has(c))! : 'OTHER',
            complaint_label: hasEmsCritical
              ? NEED_CATEGORIES.find(c => newNeeds.includes(c.code) && c.needs_ems)?.label ?? 'Needs escalation'
              : 'Priority: IMMEDIATE',
            triage_tier: hasEmsCritical ? 2 : 3,
            dispatch_note: `Auto-created from check-in update. Priority: ${newPriority ?? 'none'}. Needs: ${newNeeds.join(', ') || 'none'}`,
            caller_name: checkinFull.full_name,
            party_size: checkinFull.party_size,
            assembly_point: checkinFull.assembly_point,
            status: 'NEW',
            checkin_id: checkin.id,
          };

          if (checkinFull.lat != null && checkinFull.lon != null) {
            helpRow.lat = checkinFull.lat;
            helpRow.lon = checkinFull.lon;
          }
          if (checkinFull.phone_hash) {
            helpRow.phone_hash = checkinFull.phone_hash;
            helpRow.phone_last4 = checkinFull.phone_last4;
            helpRow.phone_hash_v = checkinFull.phone_hash_v;
          }

          const { error: helpError } = await supabase.from('help_requests').insert(helpRow);
          if (helpError) {
            log({ level: 'warn', event: 'checkin_update_help_link_failed', route: '/api/public/checkin/update', incident_id: checkin.incident_id, error: helpError.message });
          }
        }
      }
    }

    log({ level: 'info', event: 'checkin_updated', route: '/api/public/checkin/update', incident_id: checkin.incident_id, duration_ms: Date.now() - start });
    return NextResponse.json({ success: true, message: 'Check-in updated' }, {
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    });
  } catch (err) {
    log({ level: 'error', event: 'checkin_update_error', route: '/api/public/checkin/update', error: err instanceof Error ? err.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
