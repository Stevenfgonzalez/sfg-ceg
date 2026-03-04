import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9 }),
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { GET as getInfo } from '@/app/api/fcc/[householdId]/info/route';
import { POST as unlock } from '@/app/api/fcc/[householdId]/unlock/route';
import { checkRateLimit } from '@/lib/rate-limit';

// ── Helpers ──

function makeRequest(method: string, url: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '10.0.0.1',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockChain(data: unknown, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: data ? (Array.isArray(data) ? data : [data]) : [], error }),
  };
}

const makeParams = (householdId: string) => ({ params: { householdId } });

const MOCK_HOUSEHOLD = {
  id: 'h-1',
  name: 'Delgado Household',
  address_line1: '123 Main St',
  city: 'Phoenix',
  state: 'AZ',
  zip: '85001',
  hazards: 'Oxygen in use',
  member_count: 2,
  access_code: '4827',
  best_door: 'Front door',
  gate_code: '4491',
  animals: '1 dog',
  stair_info: null,
  aed_onsite: false,
  backup_power: null,
};

const MOCK_MEMBER = {
  id: 'm-1',
  full_name: 'Robert Delgado',
  date_of_birth: '1948-03-15',
  code_status: 'dnr_polst',
  fcc_member_clinical: [],
};

const MOCK_CONTACT = { id: 'c-1', name: 'Maria Delgado', relation: 'Daughter', phone: '(602) 555-0142' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret-key-for-hmac');
});

// ── GET /api/fcc/[householdId]/info ──

describe('GET /api/fcc/[householdId]/info', () => {
  it('returns 404 when household not found', async () => {
    mockFrom.mockReturnValue(mockChain(null, { message: 'not found' }));

    const res = await getInfo(makeRequest('GET', '/api/fcc/h-999/info'), makeParams('h-999'));
    expect(res.status).toBe(404);
  });

  it('returns limited public info', async () => {
    mockFrom.mockReturnValue(mockChain(MOCK_HOUSEHOLD));

    const res = await getInfo(makeRequest('GET', '/api/fcc/h-1/info'), makeParams('h-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('h-1');
    expect(json.name).toBe('Delgado Household');
    expect(json.address).toContain('123 Main St');
    expect(json.hazards).toBe('Oxygen in use');
    expect(json.member_count).toBe(2);
    // Must NOT leak access_code
    expect(json.access_code).toBeUndefined();
  });
});

// ── POST /api/fcc/[householdId]/unlock ──

describe('POST /api/fcc/[householdId]/unlock', () => {
  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 });

    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_method: 'resident_code', access_value: '4827' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/fcc/h-1/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    const res = await unlock(req, makeParams('h-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when access_method is missing', async () => {
    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_value: '4827' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/access_method/i);
  });

  it('returns 400 when access_value is missing', async () => {
    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_method: 'resident_code' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid access_method', async () => {
    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_method: 'hacker_method', access_value: '1234' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid access_method/i);
  });

  it('returns 404 when household not found', async () => {
    mockFrom.mockReturnValue(mockChain(null, { message: 'not found' }));

    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-999/unlock', { access_method: 'resident_code', access_value: '1234' }),
      makeParams('h-999')
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 on wrong resident code', async () => {
    mockFrom.mockReturnValue(mockChain(MOCK_HOUSEHOLD));

    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_method: 'resident_code', access_value: '0000' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it('returns 400 when incident number too short', async () => {
    mockFrom.mockReturnValue(mockChain(MOCK_HOUSEHOLD));

    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_method: 'incident_number', access_value: 'AB' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(400);
  });

  it('unlocks successfully with correct resident code', async () => {
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD); // household fetch
      if (callIndex.value === 2) return { // members fetch
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [MOCK_MEMBER], error: null }),
      };
      if (callIndex.value === 3) return { // contacts fetch
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [MOCK_CONTACT], error: null }),
      };
      // access log insert
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_method: 'resident_code', access_value: '4827' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session_token).toBeDefined();
    expect(json.session_token).toContain('.'); // base64.signature format
    expect(json.expires_at).toBeDefined();
    expect(json.household.id).toBe('h-1');
    expect(json.household.name).toBe('Delgado Household');
    expect(json.members).toHaveLength(1);
    expect(json.contacts).toHaveLength(1);
    // Must NOT leak access_code in response
    expect(json.household.access_code).toBeUndefined();
  });

  it('unlocks successfully with incident number', async () => {
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      if (callIndex.value === 2) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [MOCK_MEMBER], error: null }),
      };
      if (callIndex.value === 3) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [MOCK_CONTACT], error: null }),
      };
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_method: 'incident_number', access_value: 'INC-2026-0042' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session_token).toBeDefined();
  });

  it('unlocks successfully with PCR number', async () => {
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      if (callIndex.value === 2) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      if (callIndex.value === 3) return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const res = await unlock(
      makeRequest('POST', '/api/fcc/h-1/unlock', { access_method: 'pcr_number', access_value: 'PCR-84721' }),
      makeParams('h-1')
    );
    expect(res.status).toBe(200);
  });
});
