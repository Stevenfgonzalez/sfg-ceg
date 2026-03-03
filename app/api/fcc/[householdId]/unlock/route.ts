import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { createHmac } from 'crypto';

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

  const accessMethod = body.access_method as string;
  const accessValue = body.access_value as string;
  const agencyCode = (body.agency_code as string) || null;

  if (!accessMethod || !accessValue) {
    return NextResponse.json({ error: 'Missing access_method or access_value' }, { status: 400 });
  }

  if (!['resident_code', 'incident_number', 'pcr_number'].includes(accessMethod)) {
    return NextResponse.json({ error: 'Invalid access_method' }, { status: 400 });
  }

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
    // Compare hashed access code
    // For pilot: direct comparison (hash implementation comes with production hardening)
    if (accessValue !== household.access_code) {
      log({ level: 'warn', event: 'fcc_unlock_failed', route: `/api/fcc/${params.householdId}/unlock`, meta: { method: accessMethod } });
      return NextResponse.json({ error: 'Invalid access code' }, { status: 401 });
    }
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

  // Generate session token (signed JWT-like HMAC token)
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_TTL_HOURS * 60 * 60;
  const tokenPayload = `${params.householdId}:${accessMethod}:${now}:${exp}`;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
  const signature = createHmac('sha256', secret).update(tokenPayload).digest('hex');
  const sessionToken = `${Buffer.from(tokenPayload).toString('base64')}.${signature}`;

  // Log access
  await supabase.from('fcc_access_logs').insert({
    household_id: params.householdId,
    access_method: accessMethod,
    access_value: accessMethod === 'resident_code' ? '****' : accessValue,
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
