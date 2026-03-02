import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase', () => ({
  createBrowserClient: () => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

import { POST } from '@/app/api/analytics/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeOversizedRequest(): NextRequest {
  const bigPayload = { event: 'test', props: { data: 'x'.repeat(5000) } };
  return new NextRequest('http://localhost/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bigPayload),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/analytics', () => {
  it('returns 200 for valid event', async () => {
    const res = await POST(makeRequest({ event: 'page_view', page: '/checkin' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('returns 413 for oversized payload (> 4KB)', async () => {
    const res = await POST(makeOversizedRequest());
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toMatch(/too large/i);
  });

  it('returns 400 when event_name is missing', async () => {
    const res = await POST(makeRequest({ props: { foo: 'bar' } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/event/i);
  });
});
