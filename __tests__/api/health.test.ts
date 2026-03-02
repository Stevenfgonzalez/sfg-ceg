import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for Supabase health check
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
});

describe('GET /api/health', () => {
  it('returns status, timestamp, and rate_limiter type', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    // Dynamic import to get fresh module with mocked env
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBeDefined();
    expect(json.timestamp).toBeDefined();
    expect(json.subsystems).toBeDefined();
    expect(json.subsystems.rate_limiter).toBeDefined();
    expect(['redis', 'in_memory']).toContain(json.subsystems.rate_limiter);
  });
});
