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

import { GET as listMembers, POST as addMember } from '@/app/api/fcc/members/route';
import { GET as getMember, PUT as updateMember, DELETE as deleteMember } from '@/app/api/fcc/members/[memberId]/route';
import { PUT as updateClinical } from '@/app/api/fcc/members/[memberId]/clinical/route';

// ── Helpers ──

function makeRequest(method: string, url: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockChain(data: unknown, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: data ? [data] : [], error }),
  };
}

const MOCK_USER = { id: 'user-1', email: 'test@sfg.ac' };
const MOCK_HOUSEHOLD = { id: 'h-1', member_count: 2 };
const MOCK_MEMBER = {
  id: 'm-1',
  household_id: 'h-1',
  full_name: 'Robert Delgado',
  date_of_birth: '1948-03-15',
  code_status: 'dnr_polst',
  primary_language: 'English',
};
const MOCK_CLINICAL = {
  member_id: 'm-1',
  critical_flags: [{ flag: 'O2 Dependent', type: 'equipment' }],
  medications: [{ name: 'Metoprolol', dose: '25mg', freq: 'BID', last_dose: '0600' }],
  history: ['CHF', 'COPD'],
  equipment: [{ item: 'Oxygen Concentrator', location: 'Bedroom' }],
  life_needs: ['Continuous O2 at 2L/min'],
};

const makeParams = (memberId: string) => ({ params: { memberId } });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/fcc/members ──

describe('GET /api/fcc/members', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await listMembers(makeRequest('GET', '/api/fcc/members'));
    expect(res.status).toBe(401);
  });

  it('returns empty array when no household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain(null));

    const res = await listMembers(makeRequest('GET', '/api/fcc/members'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toEqual([]);
  });

  it('returns members for valid household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [MOCK_MEMBER], error: null }),
      };
    });

    const res = await listMembers(makeRequest('GET', '/api/fcc/members'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toHaveLength(1);
    expect(json.members[0].full_name).toBe('Robert Delgado');
  });
});

// ── POST /api/fcc/members ──

describe('POST /api/fcc/members', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await addMember(makeRequest('POST', '/api/fcc/members', { full_name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when no household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain(null));

    const res = await addMember(makeRequest('POST', '/api/fcc/members', { full_name: 'Test', date_of_birth: '2000-01-01' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/no household/i);
  });

  it('returns 400 when max 6 members reached', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain({ id: 'h-1', member_count: 6 }));

    const res = await addMember(makeRequest('POST', '/api/fcc/members', { full_name: 'Test', date_of_birth: '2000-01-01' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/maximum 6/i);
  });

  it('creates member and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      if (callIndex.value === 2) return mockChain(MOCK_MEMBER);
      // Clinical insert (fire and forget)
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const res = await addMember(makeRequest('POST', '/api/fcc/members', {
      full_name: 'Robert Delgado',
      date_of_birth: '1948-03-15',
      code_status: 'dnr_polst',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.member.full_name).toBe('Robert Delgado');
  });

  it('returns 400 on invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain(MOCK_HOUSEHOLD));

    const req = new NextRequest('http://localhost/api/fcc/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken',
    });
    const res = await addMember(req);
    expect(res.status).toBe(400);
  });
});

// ── GET /api/fcc/members/[memberId] ──

describe('GET /api/fcc/members/[memberId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await getMember(makeRequest('GET', '/api/fcc/members/m-1'), makeParams('m-1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when member not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain(null, { message: 'not found' }));

    const res = await getMember(makeRequest('GET', '/api/fcc/members/m-999'), makeParams('m-999'));
    expect(res.status).toBe(404);
  });

  it('returns member with clinical data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain({ ...MOCK_MEMBER, fcc_member_clinical: MOCK_CLINICAL }));

    const res = await getMember(makeRequest('GET', '/api/fcc/members/m-1'), makeParams('m-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.member.full_name).toBe('Robert Delgado');
  });
});

// ── PUT /api/fcc/members/[memberId] ──

describe('PUT /api/fcc/members/[memberId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateMember(makeRequest('PUT', '/api/fcc/members/m-1', { full_name: 'Updated' }), makeParams('m-1'));
    expect(res.status).toBe(401);
  });

  it('updates only whitelisted fields', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const chain = mockChain({ ...MOCK_MEMBER, full_name: 'Updated Name' });
    mockFrom.mockReturnValue(chain);

    const res = await updateMember(
      makeRequest('PUT', '/api/fcc/members/m-1', {
        full_name: 'Updated Name',
        owner_id: 'hacker',  // should be ignored
        household_id: 'hacker', // should be ignored
      }),
      makeParams('m-1')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.member.full_name).toBe('Updated Name');

    // Verify update was called (chain.update is the mock)
    expect(chain.update).toHaveBeenCalled();
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg).toHaveProperty('full_name', 'Updated Name');
    expect(updateArg).not.toHaveProperty('owner_id');
    expect(updateArg).not.toHaveProperty('household_id');
  });

  it('returns 500 on update error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain(null, { message: 'update failed' }));

    const res = await updateMember(makeRequest('PUT', '/api/fcc/members/m-1', { full_name: 'X' }), makeParams('m-1'));
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/fcc/members/[memberId] ──

describe('DELETE /api/fcc/members/[memberId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await deleteMember(makeRequest('DELETE', '/api/fcc/members/m-1'), makeParams('m-1'));
    expect(res.status).toBe(401);
  });

  it('deletes member and returns success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const res = await deleteMember(makeRequest('DELETE', '/api/fcc/members/m-1'), makeParams('m-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 500 on delete error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'FK constraint' } }),
      }),
    });

    const res = await deleteMember(makeRequest('DELETE', '/api/fcc/members/m-1'), makeParams('m-1'));
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/fcc/members/[memberId]/clinical ──

describe('PUT /api/fcc/members/[memberId]/clinical', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateClinical(
      makeRequest('PUT', '/api/fcc/members/m-1/clinical', { medications: [] }),
      makeParams('m-1')
    );
    expect(res.status).toBe(401);
  });

  it('updates clinical data with whitelisted fields only', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const chain = mockChain(MOCK_CLINICAL);
    mockFrom.mockReturnValue(chain);

    const res = await updateClinical(
      makeRequest('PUT', '/api/fcc/members/m-1/clinical', {
        critical_flags: [{ flag: 'Peanut Allergy', type: 'allergy' }],
        medications: [],
        member_id: 'hacker', // should be ignored
      }),
      makeParams('m-1')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clinical).toBeDefined();

    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg).toHaveProperty('critical_flags');
    expect(updateArg).not.toHaveProperty('member_id');
  });

  it('returns 500 on clinical update error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockFrom.mockReturnValue(mockChain(null, { message: 'update error' }));

    const res = await updateClinical(
      makeRequest('PUT', '/api/fcc/members/m-1/clinical', { medications: [] }),
      makeParams('m-1')
    );
    expect(res.status).toBe(500);
  });
});
