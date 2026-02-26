import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// GET /api/dashboard
// Returns all incidents (active first, then closed by most recent)
export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('incidents')
      .select(`
        id,
        name,
        type,
        status,
        declared_at,
        closed_at,
        expected_headcount,
        location
      `)
      .order('status', { ascending: true })   // 'active' before 'closed'
      .order('declared_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ incidents: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
