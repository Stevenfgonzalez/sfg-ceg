import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { log } from '@/lib/logger';

// POST /api/fcc/access-logs/[logId]/revoke — revoke an active EMS session
export async function POST(
  request: NextRequest,
  { params }: { params: { logId: string } }
) {
  const response = NextResponse.next();
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get owner's household
  const { data: household } = await supabase
    .from('fcc_households')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!household) {
    return NextResponse.json({ error: 'No household found' }, { status: 404 });
  }

  // Fetch the access log entry
  const { data: logEntry, error: fetchErr } = await supabase
    .from('fcc_access_logs')
    .select('id, household_id, revoked_at, expires_at')
    .eq('id', params.logId)
    .single();

  if (fetchErr || !logEntry) {
    return NextResponse.json({ error: 'Access log not found' }, { status: 404 });
  }

  // Verify ownership
  if (logEntry.household_id !== household.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check if already revoked
  if (logEntry.revoked_at) {
    return NextResponse.json({ error: 'Session already revoked' }, { status: 400 });
  }

  // Revoke
  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('fcc_access_logs')
    .update({ revoked_at: now, revoked_by: user.id })
    .eq('id', params.logId);

  if (updateErr) {
    log({ level: 'error', event: 'fcc_revoke_error', route: `/api/fcc/access-logs/${params.logId}/revoke`, error: updateErr.message });
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_session_revoked', route: `/api/fcc/access-logs/${params.logId}/revoke` });
  return NextResponse.json({ success: true, revoked_at: now });
}
