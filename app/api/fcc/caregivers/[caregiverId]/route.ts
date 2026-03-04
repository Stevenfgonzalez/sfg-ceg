import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';

// PUT /api/fcc/caregivers/[caregiverId] — update role (owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { caregiverId: string } }
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

  const role = body.role;
  if (role !== 'viewer' && role !== 'editor') {
    return NextResponse.json({ error: 'Role must be viewer or editor' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('fcc_caregivers')
    .update({ role })
    .eq('id', params.caregiverId)
    .select('id, email, role, accepted_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Caregiver not found' }, { status: 404 });
  }

  return NextResponse.json({ caregiver: data });
}

// DELETE /api/fcc/caregivers/[caregiverId] — remove caregiver (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { caregiverId: string } }
) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('fcc_caregivers')
    .delete()
    .eq('id', params.caregiverId);

  if (error) {
    log({ level: 'error', event: 'fcc_caregiver_delete_error', route: `/api/fcc/caregivers/${params.caregiverId}`, error: error.message });
    return NextResponse.json({ error: 'Failed to remove caregiver' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
