import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase-auth-server', () => ({
  createAuthMiddlewareClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { GET } from '@/app/api/fcc/access-logs/route';

// ── Helpers ──

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/fcc/access-logs');
}

function mockChain(data: unknown, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: data ? (Array.isArray(data) ? data : [data]) : [], error }),
  };
}

const MOCK_USER = { id: 'user-1' };
const MOCK_HOUSEHOLD = { id: 'h-1' };
const MOCK_LOG = {
  id: 'log-1',
  household_id: 'h-1',
  access_method: 'resident_code',
  access_value: '****',
  accessed_at: '2026-03-03T12:00:00Z',
  expires_at: '2026-03-03T16:00:00Z',
  ip_address: '10.0.0.1',
  user_agent: 'Mozilla/5.0 (iPhone)',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/fcc/access-logs', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns empty array when no household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain(null));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.logs).toEqual([]);
  });

  it('returns access logs ordered by date', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [MOCK_LOG], error: null }),
      };
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.logs).toHaveLength(1);
    expect(json.logs[0].access_method).toBe('resident_code');
    expect(json.logs[0].access_value).toBe('****');
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
