import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { validateFccContactBody } from '@/lib/api-validation';
import { getFccAuth } from '@/lib/fcc-auth';

// PUT /api/fcc/contacts/[contactId] — update contact (owner or editor)
export async function PUT(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const auth = await getFccAuth(supabase, user.id, ['owner', 'editor']);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = validateFccContactBody(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  const { data, error } = await supabase
    .from('fcc_emergency_contacts')
    .update(result.data)
    .eq('id', params.contactId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}

// DELETE /api/fcc/contacts/[contactId] — remove contact (owner or editor)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const auth = await getFccAuth(supabase, user.id, ['owner', 'editor']);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('fcc_emergency_contacts')
    .delete()
    .eq('id', params.contactId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
