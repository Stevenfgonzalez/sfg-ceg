import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { createServiceClient } from '@/lib/supabase';
import { getFccAuth } from '@/lib/fcc-auth';

// GET /api/fcc/access-logs — household access history (owner, editor, viewer)
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
    return NextResponse.json({ logs: [] });
  }

  const { data: logs, error } = await svc
    .from('fcc_access_logs')
    .select('*')
    .eq('household_id', auth.household_id)
    .order('accessed_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to load access logs' }, { status: 500 });
  }

  return NextResponse.json({ logs: logs || [] });
}
