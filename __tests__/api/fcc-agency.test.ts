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

import { GET } from '@/app/api/fcc/agency/[agencyCode]/route';
import { POST } from '@/app/api/fcc/agency/route';
import { checkRateLimit } from '@/lib/rate-limit';

const routeParams = { params: { agencyCode: 'PHX-FD' } };

beforeEach(() => {
  vi.clearAllMocks();
  (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true, remaining: 9 });
});

describe('GET /api/fcc/agency/[agencyCode]', () => {
  it('returns 404 for unknown agency', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    });

    const req = new NextRequest('http://localhost/api/fcc/agency/PHX-FD');
    const res = await GET(req, routeParams);
    expect(res.status).toBe(404);
  });

  it('returns agency stats and accesses', async () => {
    // First call: agency lookup
    const agencyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'a-1', name: 'Phoenix FD', code: 'PHX-FD', contact_email: 'ops@phxfd.gov', created_at: new Date().toISOString() },
        error: null,
      }),
    };
    // Second call: access logs
    const logsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'l-1',
            household_id: 'h-1',
            access_method: 'incident_number',
            accessed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            revoked_at: null,
            fcc_households: { name: 'Smith Household' },
          },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValueOnce(agencyChain).mockReturnValueOnce(logsChain);

    const req = new NextRequest('http://localhost/api/fcc/agency/PHX-FD');
    const res = await GET(req, routeParams);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.agency.name).toBe('Phoenix FD');
    expect(json.stats.accesses_this_week).toBeGreaterThanOrEqual(1);
    expect(json.recent_accesses).toHaveLength(1);
    expect(json.recent_accesses[0].household_name).toBe('Smith Household');
    // Ensure no clinical data leaked
    expect(json.recent_accesses[0]).not.toHaveProperty('members');
    expect(json.recent_accesses[0]).not.toHaveProperty('medications');
  });

  it('returns 429 when rate limited', async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: false, remaining: 0 });

    const req = new NextRequest('http://localhost/api/fcc/agency/PHX-FD');
    const res = await GET(req, routeParams);
    expect(res.status).toBe(429);
  });
});

describe('POST /api/fcc/agency', () => {
  it('returns 403 without admin key', async () => {
    const req = new NextRequest('http://localhost/api/fcc/agency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test FD', code: 'TEST' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 with invalid body', async () => {
    const req = new NextRequest('http://localhost/api/fcc/agency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.FCC_ADMIN_KEY || 'test-key' },
      body: JSON.stringify({ name: '' }),
    });
    // Set env for test
    process.env.FCC_ADMIN_KEY = 'test-key';
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
