import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';
import { validateFccCaregiverInvite } from '@/lib/api-validation';

const MAX_CAREGIVERS = 5;

// GET /api/fcc/caregivers — list caregivers (owner only)
export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: household } = await supabase
    .from('fcc_households')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!household) {
    return NextResponse.json({ caregivers: [] });
  }

  const { data: caregivers, error } = await supabase
    .from('fcc_caregivers')
    .select('id, email, role, accepted_at, created_at')
    .eq('household_id', household.id)
    .order('created_at');

  if (error) {
    return NextResponse.json({ error: 'Failed to load caregivers' }, { status: 500 });
  }

  return NextResponse.json({ caregivers: caregivers || [] });
}

// POST /api/fcc/caregivers — invite caregiver (owner only)
export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: household } = await supabase
    .from('fcc_households')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!household) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = validateFccCaregiverInvite(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  // Check max limit
  const { count } = await supabase
    .from('fcc_caregivers')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', household.id);

  if ((count ?? 0) >= MAX_CAREGIVERS) {
    return NextResponse.json({ error: `Maximum ${MAX_CAREGIVERS} caregivers per household` }, { status: 400 });
  }

  // Can't invite yourself
  if (result.data.email === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 });
  }

  const { data: caregiver, error: insertErr } = await supabase
    .from('fcc_caregivers')
    .insert({
      household_id: household.id,
      email: result.data.email,
      role: result.data.role,
      invited_by: user.id,
    })
    .select('id, email, role, created_at')
    .single();

  if (insertErr) {
    if (insertErr.message?.includes('duplicate') || insertErr.code === '23505') {
      return NextResponse.json({ error: 'This email has already been invited' }, { status: 409 });
    }
    log({ level: 'error', event: 'fcc_caregiver_invite_error', route: '/api/fcc/caregivers', error: insertErr.message });
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_caregiver_invited', route: '/api/fcc/caregivers' });
  return NextResponse.json({ caregiver }, { status: 201 });
}
