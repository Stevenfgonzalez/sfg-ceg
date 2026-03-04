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

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { POST as revokeSession } from '@/app/api/fcc/access-logs/[logId]/revoke/route';

// ── Helpers ──

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/fcc/access-logs/log-1/revoke', {
    method: 'POST',
  });
}

const makeParams = (logId: string) => ({ params: { logId } });
const MOCK_USER = { id: 'user-1' };
const MOCK_HOUSEHOLD = { id: 'h-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/fcc/access-logs/[logId]/revoke', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await revokeSession(makeRequest(), makeParams('log-1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when no household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const res = await revokeSession(makeRequest(), makeParams('log-1'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when log not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: MOCK_HOUSEHOLD, error: null }),
      };
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      };
    });

    const res = await revokeSession(makeRequest(), makeParams('log-999'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when log belongs to different household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: MOCK_HOUSEHOLD, error: null }),
      };
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'log-1', household_id: 'h-other', revoked_at: null, expires_at: '2026-12-31T00:00:00Z' },
          error: null,
        }),
      };
    });

    const res = await revokeSession(makeRequest(), makeParams('log-1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when already revoked', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: MOCK_HOUSEHOLD, error: null }),
      };
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'log-1', household_id: 'h-1', revoked_at: '2026-03-03T12:00:00Z', expires_at: '2026-12-31T00:00:00Z' },
          error: null,
        }),
      };
    });

    const res = await revokeSession(makeRequest(), makeParams('log-1'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already revoked/i);
  });

  it('successfully revokes an active session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: MOCK_HOUSEHOLD, error: null }),
      };
      if (callIndex.value === 2) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'log-1', household_id: 'h-1', revoked_at: null, expires_at: '2026-12-31T00:00:00Z' },
          error: null,
        }),
      };
      // Update call
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const res = await revokeSession(makeRequest(), makeParams('log-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.revoked_at).toBeDefined();
  });
});
