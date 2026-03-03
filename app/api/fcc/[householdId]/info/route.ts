import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// GET /api/fcc/[householdId]/info — public: limited household info for EMS entry screen
export async function GET(
  _request: NextRequest,
  { params }: { params: { householdId: string } }
) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('fcc_households')
    .select('id, name, address_line1, city, state, zip, hazards, member_count')
    .eq('id', params.householdId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    address: `${data.address_line1}, ${data.city}, ${data.state} ${data.zip}`,
    hazards: data.hazards,
    member_count: data.member_count,
  });
}
