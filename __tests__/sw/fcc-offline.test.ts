import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cacheFccSession, getCachedFccSession, clearFccCache, CachedSession } from '@/lib/fcc-cache';

// ── IndexedDB mock ──
// Vitest runs in Node (no real IndexedDB). We mock the full IDBFactory interface
// at the minimum level needed by fcc-cache.ts.

let dbStore: Map<string, CachedSession>;

function createMockIndexedDB() {
  dbStore = new Map();

  const mockObjectStore = {
    put: vi.fn((entry: CachedSession) => {
      dbStore.set(entry.householdId, entry);
      return mockRequest(undefined);
    }),
    get: vi.fn((key: string) => {
      const result = dbStore.get(key) ?? undefined;
      return mockRequest(result);
    }),
    delete: vi.fn((key: string) => {
      dbStore.delete(key);
      return mockRequest(undefined);
    }),
    clear: vi.fn(() => {
      dbStore.clear();
      return mockRequest(undefined);
    }),
  };

  function mockRequest(result: unknown) {
    const req: Record<string, unknown> = { result };
    // onsuccess fires synchronously after microtask
    queueMicrotask(() => {
      if (typeof req.onsuccess === 'function') req.onsuccess();
    });
    return req;
  }

  const mockTransaction = {
    objectStore: vi.fn(() => mockObjectStore),
    oncomplete: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };

  // Auto-fire oncomplete on next microtask
  const origObjectStore = mockTransaction.objectStore;
  mockTransaction.objectStore = vi.fn((...args) => {
    queueMicrotask(() => {
      if (typeof mockTransaction.oncomplete === 'function') mockTransaction.oncomplete();
    });
    return origObjectStore(...args);
  });

  const mockDB = {
    transaction: vi.fn(() => mockTransaction),
    objectStoreNames: { contains: vi.fn(() => true) },
    createObjectStore: vi.fn(),
  };

  const mockOpen = {
    result: mockDB,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onupgradeneeded: null as (() => void) | null,
  };

  const mockIndexedDB = {
    open: vi.fn(() => {
      queueMicrotask(() => {
        if (typeof mockOpen.onupgradeneeded === 'function') mockOpen.onupgradeneeded();
        if (typeof mockOpen.onsuccess === 'function') mockOpen.onsuccess();
      });
      return mockOpen;
    }),
  };

  // Install globally
  (globalThis as Record<string, unknown>).indexedDB = mockIndexedDB;

  return { mockObjectStore, mockTransaction, mockDB };
}

let mocks: ReturnType<typeof createMockIndexedDB>;

beforeEach(() => {
  mocks = createMockIndexedDB();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).indexedDB;
});

const SAMPLE_DATA = {
  session_token: 'tok-abc',
  expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  household: { id: 'h-1', name: 'Smith Family', address: '123 Main St' },
  members: [{ id: 'm-1', full_name: 'John Smith' }],
  contacts: [{ id: 'c-1', name: 'Jane Smith', phone: '555-1234' }],
};

describe('FCC Client-Side Cache (fcc-cache.ts)', () => {
  it('stores and retrieves session data', async () => {
    await cacheFccSession('h-1', SAMPLE_DATA);
    const result = await getCachedFccSession('h-1');
    expect(result).toBeDefined();
    expect((result as Record<string, unknown>).session_token).toBe('tok-abc');
  });

  it('returns null for non-existent household', async () => {
    const result = await getCachedFccSession('h-nonexistent');
    expect(result).toBeNull();
  });

  it('returns null and deletes expired data (>4h)', async () => {
    // Manually insert an expired entry
    const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
    dbStore.set('h-old', {
      householdId: 'h-old',
      data: SAMPLE_DATA,
      cachedAt: fiveHoursAgo,
    });

    const result = await getCachedFccSession('h-old');
    expect(result).toBeNull();
    // Verify delete was called
    expect(mocks.mockObjectStore.delete).toHaveBeenCalledWith('h-old');
  });

  it('returns data that is still within 4h TTL', async () => {
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    dbStore.set('h-recent', {
      householdId: 'h-recent',
      data: SAMPLE_DATA,
      cachedAt: threeHoursAgo,
    });

    const result = await getCachedFccSession('h-recent');
    expect(result).toBeDefined();
    expect((result as Record<string, unknown>).session_token).toBe('tok-abc');
  });

  it('clearFccCache removes all entries', async () => {
    dbStore.set('h-1', { householdId: 'h-1', data: SAMPLE_DATA, cachedAt: Date.now() });
    dbStore.set('h-2', { householdId: 'h-2', data: SAMPLE_DATA, cachedAt: Date.now() });

    await clearFccCache();
    expect(mocks.mockObjectStore.clear).toHaveBeenCalled();
    expect(dbStore.size).toBe(0);
  });

  it('throws when IndexedDB is unavailable', async () => {
    delete (globalThis as Record<string, unknown>).indexedDB;
    await expect(cacheFccSession('h-1', SAMPLE_DATA)).rejects.toThrow('IndexedDB not available');
    await expect(getCachedFccSession('h-1')).rejects.toThrow('IndexedDB not available');
    await expect(clearFccCache()).rejects.toThrow('IndexedDB not available');
  });
});
