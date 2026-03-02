import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/dispatch-auth', () => ({
  verifyDispatchAuth: vi.fn(),
  COOKIE_NAME: 'ceg_dispatch_token',
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { GET } from '@/app/api/dispatch/queue/route';
import { verifyDispatchAuth } from '@/lib/dispatch-auth';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/dispatch/queue', {
    method: 'GET',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/dispatch/queue', () => {
  it('returns 401 when auth cookie is missing/invalid', async () => {
    vi.mocked(verifyDispatchAuth).mockReturnValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/Unauthorized/i);
  });

  it('returns checkins and help_requests when authenticated', async () => {
    vi.mocked(verifyDispatchAuth).mockReturnValue(true);

    // Mock the Promise.all parallel queries
    const checkinChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'c1', full_name: 'Test' }], error: null }),
    };

    const helpChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'h1', caller_name: 'Help' }], error: null }),
    };

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      return callIndex === 1 ? checkinChain : helpChain;
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.checkins).toHaveLength(1);
    expect(json.help_requests).toHaveLength(1);
    expect(json.timestamp).toBeDefined();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
