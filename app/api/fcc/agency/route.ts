import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { log } from '@/lib/logger';
import { validateFccAgencyBody } from '@/lib/api-validation';
import { timingSafeEqual } from 'crypto';

// POST /api/fcc/agency — admin seed endpoint (protected by FCC_ADMIN_KEY)
export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  const expected = process.env.FCC_ADMIN_KEY;
  if (!adminKey || !expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const a = Buffer.from(adminKey);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = validateFccAgencyBody(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.error }, { status: result.error.status });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('fcc_agencies')
    .insert(result.data)
    .select()
    .single();

  if (error) {
    log({ level: 'error', event: 'fcc_agency_create_error', route: '/api/fcc/agency', error: error.message });
    return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 });
  }

  log({ level: 'info', event: 'fcc_agency_created', route: '/api/fcc/agency' });
  return NextResponse.json({ agency: data }, { status: 201 });
}
