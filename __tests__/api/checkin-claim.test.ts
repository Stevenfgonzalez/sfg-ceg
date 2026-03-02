import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkGeneralRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29 }),
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { POST } from '@/app/api/public/checkin/claim/route';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/public/checkin/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Helper to chain Supabase query builder methods
function mockSupabaseChain(data: unknown, error: { message: string } | null = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    update: vi.fn().mockReturnThis(),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/public/checkin/claim', () => {
  it('returns 400 when checkin_token is missing', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/checkin_token/i);
  });

  it('returns 400 when checkin_token is too short', async () => {
    const res = await POST(makeRequest({ checkin_token: 'abc', email: 'test@example.com' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/checkin_token/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ checkin_token: 'validtoken123' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest({ checkin_token: 'validtoken123', email: 'notanemail' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it('returns 404 when check-in not found', async () => {
    const checkinChain = mockSupabaseChain(null);
    mockFrom.mockReturnValue(checkinChain);

    const res = await POST(makeRequest({ checkin_token: 'validtoken123', email: 'test@example.com' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it('returns 404 when PASS account not found', async () => {
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) {
        // checkins lookup — found with trust_tier 0
        return mockSupabaseChain({ id: 'c1', trust_tier: 0, pass_account_id: null });
      }
      // pass_accounts lookup — not found
      return mockSupabaseChain(null);
    });

    const res = await POST(makeRequest({ checkin_token: 'validtoken123', email: 'nobody@example.com' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/PASS account/i);
  });

  it('returns 200 with trust_tier=2 on successful claim', async () => {
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) {
        // checkins lookup
        return mockSupabaseChain({ id: 'c1', trust_tier: 0, pass_account_id: null });
      }
      if (callIndex.value === 2) {
        // pass_accounts lookup
        return mockSupabaseChain({ id: 'p1', display_name: 'Jane Doe' });
      }
      // checkins update
      const updateChain = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
      return updateChain;
    });

    const res = await POST(makeRequest({ checkin_token: 'validtoken123', email: 'jane@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.trust_tier).toBe(2);
    expect(json.display_name).toBe('Jane Doe');
  });

  it('returns 200 with already_linked when trust_tier >= 2', async () => {
    mockFrom.mockReturnValue(
      mockSupabaseChain({ id: 'c1', trust_tier: 3, pass_account_id: 'p1' })
    );

    const res = await POST(makeRequest({ checkin_token: 'validtoken123', email: 'jane@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.already_linked).toBe(true);
    expect(json.trust_tier).toBe(3);
  });
});
