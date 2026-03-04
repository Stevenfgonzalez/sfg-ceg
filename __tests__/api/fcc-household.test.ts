import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──

const mockServiceFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase-auth-server', () => ({
  createAuthMiddlewareClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: mockServiceFrom,
  }),
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { GET, POST, PUT } from '@/app/api/fcc/household/route';

// ── Helpers ──

function makeRequest(method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/fcc/household', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockChain(data: unknown, error: { message: string; code?: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };
}

const MOCK_USER = { id: 'user-1', email: 'test@sfg.ac' };
const MOCK_HOUSEHOLD = {
  id: 'h-1',
  owner_id: 'user-1',
  name: 'Delgado Household',
  address_line1: '123 Main St',
  city: 'Phoenix',
  state: 'AZ',
  zip: '85001',
  access_code: '4827',
  member_count: 2,
  fcc_members: [],
  fcc_emergency_contacts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/fcc/household ──

describe('GET /api/fcc/household', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it('returns household data for authenticated owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain(MOCK_HOUSEHOLD));

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.household.name).toBe('Delgado Household');
    expect(json.household.id).toBe('h-1');
  });

  it('returns null household when none exists (PGRST116)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain(null, { message: 'No rows', code: 'PGRST116' }));

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.household).toBeNull();
  });

  it('returns 500 on non-PGRST116 database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockServiceFrom.mockImplementation(() => {
      callIndex.value++;
      // First call: getFccAuth owner check (succeed)
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      // Second call: the actual household fetch (fail with non-PGRST116)
      return mockChain(null, { message: 'Connection refused', code: 'ECONNREFUSED' });
    });

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/failed/i);
  });
});

// ── POST /api/fcc/household ──

describe('POST /api/fcc/household', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest('POST', { name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const req = new NextRequest('http://localhost/api/fcc/household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it('creates household and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain(MOCK_HOUSEHOLD));

    const res = await POST(makeRequest('POST', {
      name: 'Delgado Household',
      address_line1: '123 Main St',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85001',
      access_code: '4827',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.household.name).toBe('Delgado Household');
  });

  it('returns 500 on insert error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain(null, { message: 'unique constraint' }));

    const res = await POST(makeRequest('POST', {
      name: 'Test',
      address_line1: '123 Main St',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85001',
      access_code: '4827',
    }));
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/fcc/household ──

describe('PUT /api/fcc/household', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PUT(makeRequest('PUT', { name: 'Updated' }));
    expect(res.status).toBe(401);
  });

  it('updates household and returns data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain({ ...MOCK_HOUSEHOLD, name: 'Updated' }));

    const res = await PUT(makeRequest('PUT', {
      name: 'Updated',
      address_line1: '123 Main St',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85001',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.household.name).toBe('Updated');
  });

  it('returns 500 on update error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockServiceFrom.mockImplementation(() => {
      callIndex.value++;
      // First call: getFccAuth owner check (succeed)
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      // Second call: the actual update (fail)
      return mockChain(null, { message: 'update failed' });
    });

    const res = await PUT(makeRequest('PUT', {
      name: 'Updated',
      address_line1: '123 Main St',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85001',
    }));
    expect(res.status).toBe(500);
  });
});
