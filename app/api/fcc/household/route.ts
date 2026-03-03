import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';

// GET /api/fcc/household — get owner's household
export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('fcc_households')
    .select('*, fcc_members(*, fcc_member_clinical(*)), fcc_emergency_contacts(*)')
    .eq('owner_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    log({ level: 'error', event: 'fcc_household_get_error', route: '/api/fcc/household', error: error.message });
    return NextResponse.json({ error: 'Failed to load household' }, { status: 500 });
  }

  return NextResponse.json({ household: data || null });
}

// POST /api/fcc/household — create household
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

  const { data, error } = await supabase
    .from('fcc_households')
    .insert({
      owner_id: user.id,
      name: body.name,
      address_line1: body.address_line1,
      address_line2: body.address_line2 || null,
      city: body.city,
      state: body.state,
      zip: body.zip,
      access_code: body.access_code,
      best_door: body.best_door || null,
      gate_code: body.gate_code || null,
      animals: body.animals || null,
      stair_info: body.stair_info || null,
      hazards: body.hazards || null,
      aed_onsite: body.aed_onsite || false,
      backup_power: body.backup_power || null,
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

// PUT /api/fcc/household — update household
export async function PUT(request: NextRequest) {
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

  const { data, error } = await supabase
    .from('fcc_households')
    .update(body)
    .eq('owner_id', user.id)
    .select()
    .single();

  if (error) {
    log({ level: 'error', event: 'fcc_household_update_error', route: '/api/fcc/household', error: error.message });
    return NextResponse.json({ error: 'Failed to update household' }, { status: 500 });
  }

  return NextResponse.json({ household: data });
}
