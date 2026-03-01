import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { computeDispatchToken, COOKIE_NAME } from '@/lib/dispatch-auth';
import { log } from '@/lib/logger';

// POST /api/dispatch/auth — verify PIN and set httpOnly cookie
export async function POST(request: NextRequest) {
  const pin = process.env.DISPATCH_PIN;
  if (!pin) {
    return NextResponse.json(
      { error: 'Dispatch not configured' },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  // Strict rate limit: 5 attempts per minute per IP
  const { allowed } = await checkRateLimit(`dispatch_auth:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Wait 60 seconds.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const submittedPin = typeof body.pin === 'string' ? body.pin : '';

  if (submittedPin !== pin) {
    log({ level: 'warn', event: 'dispatch_auth_failed', route: '/api/dispatch/auth' });
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }

  // Set httpOnly cookie with token
  const token = computeDispatchToken(pin);
  const res = NextResponse.json({ success: true });

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60, // 8 hours
    path: '/',
  });

  log({ level: 'info', event: 'dispatch_auth_success', route: '/api/dispatch/auth' });
  return res;
}
