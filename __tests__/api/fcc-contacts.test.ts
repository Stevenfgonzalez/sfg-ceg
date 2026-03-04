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

import { GET as listContacts, POST as addContact } from '@/app/api/fcc/contacts/route';
import { PUT as updateContact, DELETE as deleteContact } from '@/app/api/fcc/contacts/[contactId]/route';

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
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: data ? [data] : [], error }),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: data ? [data] : [], error }),
  };
}

const MOCK_USER = { id: 'user-1', email: 'test@sfg.ac' };
const MOCK_HOUSEHOLD = { id: 'h-1' };
const MOCK_CONTACT = { id: 'c-1', name: 'Maria Delgado', relation: 'Daughter', phone: '(602) 555-0142', sort_order: 0 };

const makeParams = (contactId: string) => ({ params: { contactId } });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/fcc/contacts ──

describe('GET /api/fcc/contacts', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await listContacts(makeRequest('GET', '/api/fcc/contacts'));
    expect(res.status).toBe(401);
  });

  it('returns empty array when no household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain(null));

    const res = await listContacts(makeRequest('GET', '/api/fcc/contacts'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contacts).toEqual([]);
  });

  it('returns contacts for valid household', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockServiceFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [MOCK_CONTACT], error: null }),
      };
    });

    const res = await listContacts(makeRequest('GET', '/api/fcc/contacts'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contacts).toHaveLength(1);
    expect(json.contacts[0].name).toBe('Maria Delgado');
  });
});

// ── POST /api/fcc/contacts ──

describe('POST /api/fcc/contacts', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await addContact(makeRequest('POST', '/api/fcc/contacts', { name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when no household (auth fails)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain(null));

    const res = await addContact(makeRequest('POST', '/api/fcc/contacts', { name: 'Test', relation: 'Friend', phone: '555-0000' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/forbidden/i);
  });

  it('creates contact and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockServiceFrom.mockImplementation(() => {
      callIndex.value++;
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      return mockChain(MOCK_CONTACT);
    });

    const res = await addContact(makeRequest('POST', '/api/fcc/contacts', {
      name: 'Maria Delgado',
      relation: 'Daughter',
      phone: '(602) 555-0142',
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.contact.name).toBe('Maria Delgado');
  });

  it('returns 400 on invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain(MOCK_HOUSEHOLD));

    const req = new NextRequest('http://localhost/api/fcc/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await addContact(req);
    expect(res.status).toBe(400);
  });
});

// ── PUT /api/fcc/contacts/[contactId] ──

describe('PUT /api/fcc/contacts/[contactId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateContact(makeRequest('PUT', '/api/fcc/contacts/c-1', { name: 'Updated' }), makeParams('c-1'));
    expect(res.status).toBe(401);
  });

  it('updates contact with whitelisted fields only', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const chain = mockChain({ ...MOCK_CONTACT, name: 'Updated Name' });
    mockServiceFrom.mockReturnValue(chain);

    const res = await updateContact(
      makeRequest('PUT', '/api/fcc/contacts/c-1', {
        name: 'Updated Name',
        relation: 'Daughter',
        phone: '(602) 555-0142',
        household_id: 'hacker', // should be ignored
      }),
      makeParams('c-1')
    );
    expect(res.status).toBe(200);

    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg).toHaveProperty('name', 'Updated Name');
    expect(updateArg).not.toHaveProperty('household_id');
  });

  it('returns 500 on update error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockServiceFrom.mockImplementation(() => {
      callIndex.value++;
      // First call: getFccAuth owner check (succeed)
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      // Second call: the actual update (fail)
      return mockChain(null, { message: 'error' });
    });

    const res = await updateContact(
      makeRequest('PUT', '/api/fcc/contacts/c-1', { name: 'Test', relation: 'Friend', phone: '(602) 555-0000' }),
      makeParams('c-1')
    );
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/fcc/contacts/[contactId] ──

describe('DELETE /api/fcc/contacts/[contactId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await deleteContact(makeRequest('DELETE', '/api/fcc/contacts/c-1'), makeParams('c-1'));
    expect(res.status).toBe(401);
  });

  it('deletes contact and returns success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockServiceFrom.mockImplementation(() => {
      callIndex.value++;
      // First call: getFccAuth owner check (succeed)
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      // Second call: the actual delete
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const res = await deleteContact(makeRequest('DELETE', '/api/fcc/contacts/c-1'), makeParams('c-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 500 on delete error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockServiceFrom.mockImplementation(() => {
      callIndex.value++;
      // First call: getFccAuth owner check (succeed)
      if (callIndex.value === 1) return mockChain(MOCK_HOUSEHOLD);
      // Second call: the actual delete (fail)
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'constraint error' } }),
        }),
      };
    });

    const res = await deleteContact(makeRequest('DELETE', '/api/fcc/contacts/c-1'), makeParams('c-1'));
    expect(res.status).toBe(500);
  });
});
