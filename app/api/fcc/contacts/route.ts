import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { createServiceClient } from '@/lib/supabase';
import { validateFccContactBody } from '@/lib/api-validation';
import { getFccAuth } from '@/lib/fcc-auth';

// GET /api/fcc/contacts — list emergency contacts (owner, editor, viewer)
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
    return NextResponse.json({ contacts: [] });
  }

  const { data, error } = await svc
    .from('fcc_emergency_contacts')
    .select('*')
    .eq('household_id', auth.household_id)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }

  return NextResponse.json({ contacts: data || [] });
}

// POST /api/fcc/contacts — add contact (owner or editor)
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

  const { data, error } = await svc
    .from('fcc_emergency_contacts')
    .insert({
      household_id: auth.household_id,
      ...result.data,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }

  return NextResponse.json({ contact: data }, { status: 201 });
}
