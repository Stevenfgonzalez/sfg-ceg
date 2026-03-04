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

import { GET, POST } from '@/app/api/fcc/caregivers/route';

// ── Helpers ──

function makeRequest(method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/fcc/caregivers', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockChain(data: unknown, error: { message: string; code?: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: data ? [data] : [], error }),
  };
}

const MOCK_USER = { id: 'user-1', email: 'owner@sfg.ac' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/fcc/caregivers', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns empty list when no household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain(null, { message: 'no rows', code: 'PGRST116' }));
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.caregivers).toEqual([]);
  });
});

describe('POST /api/fcc/caregivers', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest('POST', { email: 'test@test.com', role: 'viewer' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 with invalid email', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    // household lookup
    mockFrom.mockReturnValue(mockChain({ id: 'h-1' }));
    const res = await POST(makeRequest('POST', { email: 'not-an-email', role: 'viewer' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it('returns 400 with invalid role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain({ id: 'h-1' }));
    const res = await POST(makeRequest('POST', { email: 'test@test.com', role: 'admin' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/role/i);
  });

  it('prevents self-invite', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    // First: household lookup; second: count
    const householdChain = mockChain({ id: 'h-1' });
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 0 }),
    };
    mockFrom.mockReturnValueOnce(householdChain).mockReturnValueOnce(countChain);
    const res = await POST(makeRequest('POST', { email: 'owner@sfg.ac', role: 'viewer' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/yourself/i);
  });

  it('creates caregiver invite successfully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const householdChain = mockChain({ id: 'h-1' });
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const insertChain = mockChain({ id: 'cg-1', email: 'caregiver@test.com', role: 'viewer', created_at: new Date().toISOString() });
    mockFrom.mockReturnValueOnce(householdChain).mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain);

    const res = await POST(makeRequest('POST', { email: 'caregiver@test.com', role: 'viewer' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.caregiver.email).toBe('caregiver@test.com');
  });

  it('rejects when at max caregivers', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const householdChain = mockChain({ id: 'h-1' });
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 5 }),
    };
    mockFrom.mockReturnValueOnce(householdChain).mockReturnValueOnce(countChain);
    const res = await POST(makeRequest('POST', { email: 'new@test.com', role: 'editor' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/maximum/i);
  });

  it('rejects duplicate email invite', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const householdChain = mockChain({ id: 'h-1' });
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const insertChain = mockChain(null, { message: 'duplicate key value violates unique constraint', code: '23505' });
    mockFrom.mockReturnValueOnce(householdChain).mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain);

    const res = await POST(makeRequest('POST', { email: 'dup@test.com', role: 'viewer' }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/already/i);
  });
});
