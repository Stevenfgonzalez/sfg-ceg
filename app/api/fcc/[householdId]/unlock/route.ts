import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { validateFccUnlockBody } from '@/lib/api-validation';

const SESSION_TTL_HOURS = 4;

/**
 * POST /api/fcc/[householdId]/unlock
 *
 * EMS unlock gate. Validates access code and returns a signed session token
 * with full household + member data. Logs the access event.
 *
 * Body: { access_method, access_value, agency_code? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { householdId: string } }
) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  // Rate limit: 10 attempts per minute per IP per household
  const { allowed } = await checkRateLimit(
    `fcc_unlock:${params.householdId}:${ip}`,
    10,
    60_000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Wait 60 seconds.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = validateFccUnlockBody(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  const { access_method: accessMethod, access_value: accessValue, agency_code: agencyCode } = result.data;

  const supabase = createServiceClient();

  // Fetch household
  const { data: household, error: hErr } = await supabase
    .from('fcc_households')
    .select('*')
    .eq('id', params.householdId)
    .single();

  if (hErr || !household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 });
  }

  // Validate access
  if (accessMethod === 'resident_code') {
    const a = Buffer.from(accessValue);
    const b = Buffer.from(household.access_code || '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      log({ level: 'warn', event: 'fcc_unlock_failed', route: `/api/fcc/${params.householdId}/unlock`, meta: { method: accessMethod } });
      return NextResponse.json({ error: 'Invalid access code' }, { status: 401 });
    }
  } else if (accessMethod === 'temp_code') {
    // Look up unused, unexpired temp code
    const { data: tempCode, error: tcErr } = await supabase
      .from('fcc_temp_codes')
      .select('id')
      .eq('household_id', params.householdId)
      .eq('code', accessValue)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tcErr || !tempCode) {
      log({ level: 'warn', event: 'fcc_unlock_failed', route: `/api/fcc/${params.householdId}/unlock`, meta: { method: accessMethod } });
      return NextResponse.json({ error: 'Invalid or expired temporary code' }, { status: 401 });
    }

    // Mark code as used (single-use)
    await supabase
      .from('fcc_temp_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tempCode.id);
  } else {
    // Incident number and PCR number: validate format (4+ chars)
    if (accessValue.length < 4) {
      return NextResponse.json({ error: 'Invalid access value' }, { status: 400 });
    }
  }

  // Fetch members with clinical data
  const { data: members } = await supabase
    .from('fcc_members')
    .select('*, fcc_member_clinical(*)')
    .eq('household_id', params.householdId)
    .order('sort_order');

  // Fetch emergency contacts
  const { data: contacts } = await supabase
    .from('fcc_emergency_contacts')
    .select('*')
    .eq('household_id', params.householdId)
    .order('sort_order');

  // Generate session token (opaque HMAC token — no payload leaked)
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    log({ level: 'error', event: 'fcc_unlock_missing_secret', route: `/api/fcc/${params.householdId}/unlock` });
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 503 });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_TTL_HOURS * 60 * 60;
  const tokenId = randomBytes(16).toString('hex');
  const tokenPayload = `${params.householdId}:${accessMethod}:${now}:${exp}`;
  const signature = createHmac('sha256', secret).update(tokenPayload).digest('hex');
  const sessionToken = `${tokenId}.${signature}`;

  // Log access
  await supabase.from('fcc_access_logs').insert({
    household_id: params.householdId,
    access_method: accessMethod,
    access_value: (accessMethod === 'resident_code' || accessMethod === 'temp_code') ? '****' : accessValue,
    agency_code: agencyCode,
    session_token: signature.slice(0, 16), // store partial for reference
    expires_at: new Date(exp * 1000).toISOString(),
    ip_address: ip,
    user_agent: request.headers.get('user-agent') || null,
  });

  log({
    level: 'info',
    event: 'fcc_unlock_success',
    route: `/api/fcc/${params.householdId}/unlock`,
    meta: { method: accessMethod },
  });

  return NextResponse.json({
    session_token: sessionToken,
    expires_at: new Date(exp * 1000).toISOString(),
    household: {
      id: household.id,
      name: household.name,
      address: `${household.address_line1}, ${household.city}, ${household.state} ${household.zip}`,
      best_door: household.best_door,
      gate_code: household.gate_code,
      animals: household.animals,
      stair_info: household.stair_info,
      hazards: household.hazards,
      aed_onsite: household.aed_onsite,
      backup_power: household.backup_power,
    },
    members: members || [],
    contacts: contacts || [],
  });
}
