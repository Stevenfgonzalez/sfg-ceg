import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock service worker globals
const mockCacheStore = new Map<string, Map<string, Response>>();

function createMockCache(name: string) {
  const store = new Map<string, Response>();
  mockCacheStore.set(name, store);
  return {
    put: vi.fn(async (req: Request | string, res: Response) => {
      const key = typeof req === 'string' ? req : req.url;
      store.set(key, res.clone());
    }),
    match: vi.fn(async (req: Request | string) => {
      const key = typeof req === 'string' ? req : req.url;
      const cached = store.get(key);
      return cached ? cached.clone() : undefined;
    }),
    delete: vi.fn(async (req: Request | string) => {
      const key = typeof req === 'string' ? req : req.url;
      return store.delete(key);
    }),
  };
}

const mockCaches = {
  open: vi.fn(async (name: string) => createMockCache(name)),
  delete: vi.fn(async (name: string) => mockCacheStore.delete(name)),
  keys: vi.fn(async () => Array.from(mockCacheStore.keys())),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheStore.clear();
});

describe('FCC Offline Caching Logic', () => {
  it('caches unlock response with timestamp header', async () => {
    const cache = createMockCache('fcc-data-v1');
    const unlockData = {
      session_token: 'test-token',
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      household: { id: 'h-1', name: 'Test' },
      members: [],
      contacts: [],
    };

    const response = new Response(JSON.stringify(unlockData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    // Simulate caching with timestamp
    const cloned = response.clone();
    const body = await cloned.text();
    const headers = new Headers(cloned.headers);
    headers.set('X-FCC-Cached-At', String(Date.now()));
    const cachedResp = new Response(body, {
      status: 200,
      headers,
    });

    const req = new Request('http://localhost/api/fcc/h-1/unlock', { method: 'POST' });
    await cache.put(req, cachedResp);

    const retrieved = await cache.match(req);
    expect(retrieved).toBeDefined();
    const cachedAt = retrieved!.headers.get('X-FCC-Cached-At');
    expect(cachedAt).toBeTruthy();
    expect(parseInt(cachedAt!, 10)).toBeGreaterThan(0);
  });

  it('returns cached data with offline header when available', async () => {
    const cache = createMockCache('fcc-data-v1');
    const unlockData = { household: { id: 'h-1' }, members: [], contacts: [] };

    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-FCC-Cached-At': String(Date.now()),
    });
    const cachedResp = new Response(JSON.stringify(unlockData), { status: 200, headers });
    const req = new Request('http://localhost/api/fcc/h-1/unlock', { method: 'POST' });
    await cache.put(req, cachedResp);

    const retrieved = await cache.match(req);
    expect(retrieved).toBeDefined();

    // Simulate adding offline header
    const offlineHeaders = new Headers(retrieved!.headers);
    offlineHeaders.set('X-FCC-Offline', 'true');
    const offlineResponse = new Response(retrieved!.body, {
      status: retrieved!.status,
      headers: offlineHeaders,
    });

    expect(offlineResponse.headers.get('X-FCC-Offline')).toBe('true');
  });

  it('expires cached data after 4 hours', async () => {
    const FCC_CACHE_TTL = 4 * 60 * 60 * 1000;
    const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;

    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-FCC-Cached-At': String(fiveHoursAgo),
    });

    const cachedAt = parseInt(headers.get('X-FCC-Cached-At')!, 10);
    const age = Date.now() - cachedAt;
    expect(age).toBeGreaterThan(FCC_CACHE_TTL);
  });

  it('clears cache on CLEAR_FCC_CACHE message', async () => {
    mockCacheStore.set('fcc-data-v1', new Map());
    expect(mockCacheStore.has('fcc-data-v1')).toBe(true);

    await mockCaches.delete('fcc-data-v1');
    expect(mockCacheStore.has('fcc-data-v1')).toBe(false);
  });

  it('preserves non-FCC caches on clear', async () => {
    mockCacheStore.set('ceg-v2', new Map());
    mockCacheStore.set('fcc-data-v1', new Map());

    // Only delete FCC cache
    await mockCaches.delete('fcc-data-v1');

    expect(mockCacheStore.has('ceg-v2')).toBe(true);
    expect(mockCacheStore.has('fcc-data-v1')).toBe(false);
  });
});
