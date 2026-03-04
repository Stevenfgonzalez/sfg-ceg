import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { createServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { sendFccTempCodeSms } from '@/lib/alerting';
import { getFccAuth } from '@/lib/fcc-auth';
import { randomInt } from 'crypto';

const TEMP_CODE_TTL_MINUTES = 30;

/**
 * POST /api/fcc/[householdId]/request-code
 *
 * Owner or editor requests a temporary 6-digit code sent via SMS.
 * Rate limited to 3 codes per hour per household.
 *
 * Body: { phone }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { householdId: string } }
) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const auth = await getFccAuth(svc, user.id, ['owner', 'editor']);
  if (!auth || auth.household_id !== params.householdId) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 });
  }

  const { data: household } = await svc
    .from('fcc_households')
    .select('id, name')
    .eq('id', params.householdId)
    .single();

  if (!household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 });
  }

  // Rate limit: 3 codes per hour per household
  const { allowed } = await checkRateLimit(
    `fcc_tempcode:${params.householdId}`,
    3,
    3_600_000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many code requests. Try again in an hour.' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (phone.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
  }

  // Generate 6-digit code
  const code = randomInt(100000, 999999).toString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEMP_CODE_TTL_MINUTES * 60 * 1000);

  // Insert using service client (RLS bypass for insert)
  const { error: insertErr } = await svc
    .from('fcc_temp_codes')
    .insert({
      household_id: params.householdId,
      code,
      requested_by: user.id,
      requested_phone: phone,
      expires_at: expiresAt.toISOString(),
    });

  if (insertErr) {
    log({ level: 'error', event: 'fcc_temp_code_insert_error', route: `/api/fcc/${params.householdId}/request-code`, error: insertErr.message });
    return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
  }

  // Send SMS (fire-and-forget)
  sendFccTempCodeSms(phone, code, household.name);

  // Mask phone for response
  const digits = phone.replace(/\D/g, '');
  const maskedPhone = `(${digits.slice(0, 3)}) ***-${digits.slice(-4)}`;

  log({ level: 'info', event: 'fcc_temp_code_created', route: `/api/fcc/${params.householdId}/request-code` });

  return NextResponse.json({
    success: true,
    expires_at: expiresAt.toISOString(),
    sent_to: maskedPhone,
  });
}
