import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { checkGeneralRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

// POST /api/public/checkin/claim
// Links an anonymous check-in to a PASS account by email.
// Upgrades trust_tier from 0 → 2 (PASS-linked).
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const { allowed } = await checkGeneralRateLimit(ip);
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

  const checkinToken = body.checkin_token;
  const email = body.email;

  if (typeof checkinToken !== 'string' || checkinToken.length < 8) {
    return NextResponse.json({ error: 'Valid checkin_token is required' }, { status: 400 });
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const supabase = createServiceClient();

    // Look up check-in by token
    const { data: checkin, error: checkinError } = await supabase
      .from('checkins')
      .select('id, trust_tier, pass_account_id')
      .eq('checkin_token', checkinToken)
      .limit(1)
      .maybeSingle();

    if (checkinError) {
      log({ level: 'error', event: 'claim_checkin_lookup_failed', route: '/api/public/checkin/claim', error: checkinError.message });
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }

    if (!checkin) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }

    // Idempotent: if already T2+, return success
    if (checkin.trust_tier >= 2) {
      return NextResponse.json({ success: true, trust_tier: checkin.trust_tier, already_linked: true });
    }

    // Look up PASS account by email
    const { data: account, error: accountError } = await supabase
      .from('pass_accounts')
      .select('id, display_name')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (accountError) {
      log({ level: 'error', event: 'claim_account_lookup_failed', route: '/api/public/checkin/claim', error: accountError.message });
      return NextResponse.json({ error: 'Account lookup failed' }, { status: 500 });
    }

    if (!account) {
      return NextResponse.json(
        { error: 'No PASS account found for this email. Create one at pass.sfg.ac' },
        { status: 404 }
      );
    }

    // Upgrade trust tier
    const { error: updateError } = await supabase
      .from('checkins')
      .update({ trust_tier: 2, pass_account_id: account.id })
      .eq('id', checkin.id);

    if (updateError) {
      log({ level: 'error', event: 'claim_update_failed', route: '/api/public/checkin/claim', error: updateError.message });
      return NextResponse.json({ error: 'Failed to link account' }, { status: 500 });
    }

    log({ level: 'info', event: 'checkin_claimed', route: '/api/public/checkin/claim', meta: { checkin_id: checkin.id, pass_account_id: account.id } });

    return NextResponse.json({
      success: true,
      trust_tier: 2,
      display_name: account.display_name,
    });
  } catch (err) {
    log({ level: 'error', event: 'claim_error', route: '/api/public/checkin/claim', error: err instanceof Error ? err.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
