import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';

// PUT /api/fcc/members/[memberId]/clinical — update clinical data
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

  // Only allow updating clinical fields
  const allowed = [
    'critical_flags', 'medications', 'history',
    'mobility_status', 'lift_method', 'precautions', 'pain_notes', 'stair_chair_needed',
    'equipment', 'life_needs',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from('fcc_member_clinical')
    .update(updates)
    .eq('member_id', params.memberId)
    .select()
    .single();

  if (error) {
    log({ level: 'error', event: 'fcc_clinical_update_error', route: `/api/fcc/members/${params.memberId}/clinical`, error: error.message });
    return NextResponse.json({ error: 'Failed to update clinical data' }, { status: 500 });
  }

  return NextResponse.json({ clinical: data });
}
