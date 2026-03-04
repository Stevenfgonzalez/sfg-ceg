import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { createServiceClient } from '@/lib/supabase';
import { log } from '@/lib/logger';
import { validateFccMemberBody } from '@/lib/api-validation';
import { getFccAuth } from '@/lib/fcc-auth';

// GET /api/fcc/members — list members (owner, editor, viewer)
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
    return NextResponse.json({ members: [] });
  }

  const { data: members, error } = await svc
    .from('fcc_members')
    .select('*, fcc_member_clinical(*)')
    .eq('household_id', auth.household_id)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }

  return NextResponse.json({ members: members || [] });
}

// POST /api/fcc/members — add member (owner or editor, max 6)
export async function POST(request: NextRequest) {
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

  const { data: household } = await svc
    .from('fcc_households')
    .select('id, member_count')
    .eq('id', auth.household_id)
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

  const result = validateFccMemberBody(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  const { data: member, error: memberErr } = await svc
    .from('fcc_members')
    .insert({
      household_id: household.id,
      ...result.data,
      sort_order: household.member_count,
    })
    .select()
    .single();

  if (memberErr || !member) {
    log({ level: 'error', event: 'fcc_member_create_error', route: '/api/fcc/members', error: memberErr?.message });
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }

  await svc.from('fcc_member_clinical').insert({ member_id: member.id });

  log({ level: 'info', event: 'fcc_member_created', route: '/api/fcc/members' });
  return NextResponse.json({ member }, { status: 201 });
}
