import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { createServiceClient } from '@/lib/supabase';
import { log } from '@/lib/logger';
import { validateFccHouseholdBody } from '@/lib/api-validation';
import { getFccAuth } from '@/lib/fcc-auth';

// GET /api/fcc/household — get user's household (owner or caregiver)
export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const auth = await getFccAuth(svc, user.id);
  if (!auth) {
    return NextResponse.json({ household: null });
  }

  const { data, error } = await svc
    .from('fcc_households')
    .select('*, fcc_members(*, fcc_member_clinical(*)), fcc_emergency_contacts(*)')
    .eq('id', auth.household_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    log({ level: 'error', event: 'fcc_household_get_error', route: '/api/fcc/household', error: error.message });
    return NextResponse.json({ error: 'Failed to load household' }, { status: 500 });
  }

  return NextResponse.json({ household: data || null, role: auth.role });
}

// POST /api/fcc/household — create household (owner only)
export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = validateFccHouseholdBody(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  const svc = createServiceClient();

  // Check if user already owns a household (prevent duplicates)
  const { data: existing } = await svc
    .from('fcc_households')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Household already exists', household_id: existing[0].id }, { status: 409 });
  }

  const { data, error } = await svc
    .from('fcc_households')
    .insert({
      owner_id: user.id,
      ...result.data,
    })
    .select()
    .single();

  if (error) {
    log({ level: 'error', event: 'fcc_household_create_error', route: '/api/fcc/household', error: error.message });
    return NextResponse.json({ error: 'Failed to create household' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_household_created', route: '/api/fcc/household' });
  return NextResponse.json({ household: data }, { status: 201 });
}

// PUT /api/fcc/household — update household (owner or editor)
export async function PUT(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const auth = await getFccAuth(svc, user.id, ['owner', 'editor']);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = validateFccHouseholdBody(body, { isUpdate: true });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  const { data, error } = await svc
    .from('fcc_households')
    .update(result.data)
    .eq('id', auth.household_id)
    .select()
    .single();

  if (error) {
    log({ level: 'error', event: 'fcc_household_update_error', route: '/api/fcc/household', error: error.message });
    return NextResponse.json({ error: 'Failed to update household' }, { status: 500 });
  }

  return NextResponse.json({ household: data });
}
