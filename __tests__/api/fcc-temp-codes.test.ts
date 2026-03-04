import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──

const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockServiceFrom = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockSendFccTempCodeSms = vi.fn();

vi.mock('@/lib/supabase-auth-server', () => ({
  createAuthMiddlewareClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: mockServiceFrom,
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@/lib/alerting', () => ({
  sendFccTempCodeSms: (...args: unknown[]) => mockSendFccTempCodeSms(...args),
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { POST as requestCode } from '@/app/api/fcc/[householdId]/request-code/route';

// ── Helpers ──

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/fcc/h-1/request-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const makeParams = (householdId: string) => ({ params: { householdId } });
const MOCK_USER = { id: 'user-1' };
const MOCK_HOUSEHOLD = { id: 'h-1', name: 'Smith Family' };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
});

describe('POST /api/fcc/[householdId]/request-code', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await requestCode(makeRequest({ phone: '6025550142' }), makeParams('h-1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when household not owned by user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    });

    const res = await requestCode(makeRequest({ phone: '6025550142' }), makeParams('h-1'));
    expect(res.status).toBe(404);
  });

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_HOUSEHOLD }),
    });
    mockCheckRateLimit.mockResolvedValue({ allowed: false });

    const res = await requestCode(makeRequest({ phone: '6025550142' }), makeParams('h-1'));
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid phone number', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_HOUSEHOLD }),
    });

    const res = await requestCode(makeRequest({ phone: '123' }), makeParams('h-1'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/phone/i);
  });

  it('generates code, inserts, sends SMS, and returns masked phone', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_HOUSEHOLD }),
    });
    mockServiceFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await requestCode(makeRequest({ phone: '(602) 555-0142' }), makeParams('h-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.expires_at).toBeDefined();
    expect(json.sent_to).toBe('(602) ***-0142');
    expect(mockSendFccTempCodeSms).toHaveBeenCalledOnce();
    expect(mockSendFccTempCodeSms.mock.calls[0][0]).toBe('(602) 555-0142');
    expect(mockSendFccTempCodeSms.mock.calls[0][1]).toHaveLength(6);
    expect(mockSendFccTempCodeSms.mock.calls[0][2]).toBe('Smith Family');
  });

  it('returns 500 when insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_HOUSEHOLD }),
    });
    mockServiceFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
    });

    const res = await requestCode(makeRequest({ phone: '6025550142' }), makeParams('h-1'));
    expect(res.status).toBe(500);
  });
});
