// Dispatch dashboard PIN authentication helper
// Token = HMAC-SHA256(PIN, service_role_key || PIN) stored in httpOnly cookie

import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'ceg_dispatch_token';

/** Compute the expected token for a given PIN */
export function computeDispatchToken(pin: string): string {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '') + pin;
  return createHmac('sha256', key).update(pin).digest('hex');
}

/** Verify the dispatch cookie on a request. Returns true if authenticated. */
export function verifyDispatchAuth(request: NextRequest): boolean {
  const pin = process.env.DISPATCH_PIN;
  if (!pin) return false;

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return false;

  const expected = computeDispatchToken(pin);

  // Constant-time comparison
  try {
    const a = Buffer.from(cookie, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
