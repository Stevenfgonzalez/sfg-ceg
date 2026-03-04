import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { createServiceClient } from '@/lib/supabase';
import { log } from '@/lib/logger';
import { validateFccMemberBody } from '@/lib/api-validation';
import { getFccAuth } from '@/lib/fcc-auth';

// GET /api/fcc/members/[memberId] — single member with clinical data
export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();
  const auth = await getFccAuth(svc, user.id);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: member, error } = await svc
    .from('fcc_members')
    .select('*, fcc_member_clinical(*)')
    .eq('id', params.memberId)
    .eq('household_id', auth.household_id)
    .single();

  if (error || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json({ member });
}

// PUT /api/fcc/members/[memberId] — update member base fields (owner or editor)
export async function PUT(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
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

  const result = validateFccMemberBody(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  const { data, error } = await svc
    .from('fcc_members')
    .update(result.data)
    .eq('id', params.memberId)
    .eq('household_id', auth.household_id)
    .select()
    .single();

  if (error) {
    log({ level: 'error', event: 'fcc_member_update_error', route: `/api/fcc/members/${params.memberId}`, error: error.message });
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }

  return NextResponse.json({ member: data });
}

// DELETE /api/fcc/members/[memberId] — remove member (owner or editor)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
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

  const { error } = await svc
    .from('fcc_members')
    .delete()
    .eq('id', params.memberId)
    .eq('household_id', auth.household_id);

  if (error) {
    log({ level: 'error', event: 'fcc_member_delete_error', route: `/api/fcc/members/${params.memberId}`, error: error.message });
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_member_deleted', route: `/api/fcc/members/${params.memberId}` });
  return NextResponse.json({ success: true });
}
