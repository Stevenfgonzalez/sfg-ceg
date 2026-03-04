import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/fcc/agency/[agencyCode] — public agency dashboard data
export async function GET(
  request: NextRequest,
  { params }: { params: { agencyCode: string } }
) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  // Rate limit: 10 requests per minute per IP
  const { allowed } = await checkRateLimit(`fcc_agency:${ip}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Wait 60 seconds.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const supabase = createServiceClient();

  // Lookup agency
  const { data: agency, error: agencyErr } = await supabase
    .from('fcc_agencies')
    .select('id, name, code, contact_email, created_at')
    .eq('code', params.agencyCode.toUpperCase())
    .single();

  if (agencyErr || !agency) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
  }

  // Fetch recent access logs for this agency (last 100)
  const { data: logs } = await supabase
    .from('fcc_access_logs')
    .select('id, household_id, access_method, accessed_at, expires_at, revoked_at, fcc_households(name)')
    .eq('agency_code', agency.code)
    .order('accessed_at', { ascending: false })
    .limit(100);

  const accessLogs = (logs || []).map((l: Record<string, unknown>) => ({
    id: l.id,
    household_name: (l.fcc_households as { name?: string })?.name || 'Unknown',
    access_method: l.access_method,
    accessed_at: l.accessed_at,
    status: l.revoked_at ? 'revoked' : (l.expires_at && new Date(l.expires_at as string).getTime() < Date.now()) ? 'expired' : 'active',
  }));

  // Compute stats
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const uniqueHouseholds = new Set<string>();

  let weekCount = 0;
  let monthCount = 0;

  for (const log of accessLogs) {
    const ts = new Date(log.accessed_at as string).getTime();
    if (ts > oneWeekAgo) weekCount++;
    if (ts > oneMonthAgo) {
      monthCount++;
      uniqueHouseholds.add(log.household_name);
    }
  }

  return NextResponse.json({
    agency: {
      name: agency.name,
      code: agency.code,
      contact_email: agency.contact_email,
    },
    stats: {
      accesses_this_week: weekCount,
      accesses_this_month: monthCount,
      unique_households_this_month: uniqueHouseholds.size,
    },
    recent_accesses: accessLogs,
  });
}
