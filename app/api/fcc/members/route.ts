import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';

// GET /api/fcc/members — list members in owner's household
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
    return NextResponse.json({ members: [] });
  }

  const { data: members, error } = await supabase
    .from('fcc_members')
    .select('*, fcc_member_clinical(*)')
    .eq('household_id', household.id)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }

  return NextResponse.json({ members: members || [] });
}

// POST /api/fcc/members — add member (max 6)
export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: household } = await supabase
    .from('fcc_households')
    .select('id, member_count')
    .eq('owner_id', user.id)
    .single();

  if (!household) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 });
  }

  if (household.member_count >= 6) {
    return NextResponse.json({ error: 'Maximum 6 members per household' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Insert member
  const { data: member, error: memberErr } = await supabase
    .from('fcc_members')
    .insert({
      household_id: household.id,
      full_name: body.full_name,
      date_of_birth: body.date_of_birth,
      baseline_mental: body.baseline_mental || null,
      primary_language: body.primary_language || 'English',
      code_status: body.code_status || 'full_code',
      directive_location: body.directive_location || null,
      sort_order: household.member_count,
    })
    .select()
    .single();

  if (memberErr || !member) {
    log({ level: 'error', event: 'fcc_member_create_error', route: '/api/fcc/members', error: memberErr?.message });
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }

  // Insert empty clinical record
  await supabase.from('fcc_member_clinical').insert({ member_id: member.id });

  log({ level: 'info', event: 'fcc_member_created', route: '/api/fcc/members' });
  return NextResponse.json({ member }, { status: 201 });
}
