import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';

// GET /api/fcc/contacts — list emergency contacts
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
    return NextResponse.json({ contacts: [] });
  }

  const { data, error } = await supabase
    .from('fcc_emergency_contacts')
    .select('*')
    .eq('household_id', household.id)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }

  return NextResponse.json({ contacts: data || [] });
}

// POST /api/fcc/contacts — add contact
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

  const { data, error } = await supabase
    .from('fcc_emergency_contacts')
    .insert({
      household_id: household.id,
      name: body.name,
      relation: body.relation,
      phone: body.phone,
      sort_order: body.sort_order || 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }

  return NextResponse.json({ contact: data }, { status: 201 });
}
