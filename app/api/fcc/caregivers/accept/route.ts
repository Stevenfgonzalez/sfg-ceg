import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';

// POST /api/fcc/caregivers/accept — accept pending invite
export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find pending invite matching user's email
  const { data: invite, error: findErr } = await supabase
    .from('fcc_caregivers')
    .select('id, household_id, email, role')
    .eq('email', user.email.toLowerCase())
    .is('accepted_at', null)
    .single();

  if (findErr || !invite) {
    return NextResponse.json({ error: 'No pending invite found' }, { status: 404 });
  }

  // Accept the invite
  const { error: updateErr } = await supabase
    .from('fcc_caregivers')
    .update({
      user_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateErr) {
    log({ level: 'error', event: 'fcc_caregiver_accept_error', route: '/api/fcc/caregivers/accept', error: updateErr.message });
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_caregiver_accepted', route: '/api/fcc/caregivers/accept' });
  return NextResponse.json({
    success: true,
    household_id: invite.household_id,
    role: invite.role,
  });
}
