import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { POST } from '@/app/api/dispatch/auth/route';
import { checkRateLimit } from '@/lib/rate-limit';

const TEST_PIN = 'dispatch-1234';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/dispatch/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('DISPATCH_PIN', TEST_PIN);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
});

describe('POST /api/dispatch/auth', () => {
  it('returns 401 for wrong PIN', async () => {
    const res = await POST(makeRequest({ pin: 'wrong-pin' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid PIN/i);
  });

  it('returns 200 and sets cookie for correct PIN', async () => {
    const res = await POST(makeRequest({ pin: TEST_PIN }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Check that a cookie was set
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('ceg_dispatch_token');
    expect(setCookie).toContain('HttpOnly');
  });

  it('returns 429 after rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 });

    const res = await POST(makeRequest({ pin: TEST_PIN }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/too many/i);
  });
});
