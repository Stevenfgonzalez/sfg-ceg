import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';
import { createServiceClient } from '@/lib/supabase';
import { log } from '@/lib/logger';
import { getFccAuth } from '@/lib/fcc-auth';

// POST /api/fcc/access-logs/[logId]/revoke — revoke an active EMS session (owner or editor)
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

  const svc = createServiceClient();
  const auth = await getFccAuth(svc, user.id, ['owner', 'editor']);
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch the access log entry
  const { data: logEntry, error: fetchErr } = await svc
    .from('fcc_access_logs')
    .select('id, household_id, revoked_at, expires_at')
    .eq('id', params.logId)
    .single();

  if (fetchErr || !logEntry) {
    return NextResponse.json({ error: 'Access log not found' }, { status: 404 });
  }

  // Verify household match
  if (logEntry.household_id !== auth.household_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (logEntry.revoked_at) {
    return NextResponse.json({ error: 'Session already revoked' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await svc
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
