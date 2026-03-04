import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';
import { validateFccMemberBody } from '@/lib/api-validation';

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

  const { data: member, error } = await supabase
    .from('fcc_members')
    .select('*, fcc_member_clinical(*)')
    .eq('id', params.memberId)
    .single();

  if (error || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json({ member });
}

// PUT /api/fcc/members/[memberId] — update member base fields
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

  const { data, error } = await supabase
    .from('fcc_members')
    .update(result.data)
    .eq('id', params.memberId)
    .select()
    .single();

  if (error) {
    log({ level: 'error', event: 'fcc_member_update_error', route: `/api/fcc/members/${params.memberId}`, error: error.message });
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }

  return NextResponse.json({ member: data });
}

// DELETE /api/fcc/members/[memberId] — remove member
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

  const { error } = await supabase
    .from('fcc_members')
    .delete()
    .eq('id', params.memberId);

  if (error) {
    log({ level: 'error', event: 'fcc_member_delete_error', route: `/api/fcc/members/${params.memberId}`, error: error.message });
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_member_deleted', route: `/api/fcc/members/${params.memberId}` });
  return NextResponse.json({ success: true });
}
