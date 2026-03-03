import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';

// GET /api/fcc/access-logs — owner's household access history
export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get owner's household first
  const { data: household } = await supabase
    .from('fcc_households')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!household) {
    return NextResponse.json({ logs: [] });
  }

  const { data: logs, error } = await supabase
    .from('fcc_access_logs')
    .select('*')
    .eq('household_id', household.id)
    .order('accessed_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to load access logs' }, { status: 500 });
  }

  return NextResponse.json({ logs: logs || [] });
}
