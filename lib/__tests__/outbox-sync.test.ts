import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock offline-store before importing outbox-sync
vi.mock('@/lib/offline-store', () => ({
  getOutboxItems: vi.fn().mockResolvedValue([]),
  markSynced: vi.fn().mockResolvedValue(undefined),
  isOnline: vi.fn().mockReturnValue(true),
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Provide a minimal window for the sync engine
vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('outbox-sync', () => {
  it('startOutboxSync is idempotent (second call is no-op)', async () => {
    vi.resetModules();
    const mod = await import('@/lib/outbox-sync');

    mod.startOutboxSync();
    mod.startOutboxSync(); // Second call should be a no-op

    // window.addEventListener should only be called once per event type
    const addListenerCalls = vi.mocked(window.addEventListener).mock.calls;
    const onlineCalls = addListenerCalls.filter(([evt]) => evt === 'online');
    expect(onlineCalls).toHaveLength(1);

    mod.stopOutboxSync();
  });

  it('stopOutboxSync clears interval', async () => {
    vi.resetModules();
    const mod = await import('@/lib/outbox-sync');

    mod.startOutboxSync();
    mod.stopOutboxSync();

    // After stop, can start again (proves it truly reset)
    mod.startOutboxSync();
    const addListenerCalls = vi.mocked(window.addEventListener).mock.calls;
    const onlineCalls = addListenerCalls.filter(([evt]) => evt === 'online');
    expect(onlineCalls).toHaveLength(2); // Once from first start, once from second

    mod.stopOutboxSync();
  });

  it('resetEdgeDetection clears cache', async () => {
    vi.resetModules();
    const mod = await import('@/lib/outbox-sync');

    // After reset, isEdgeMode should return false
    mod.resetEdgeDetection();
    expect(mod.isEdgeMode()).toBe(false);
  });

  it('isEdgeMode reflects edge state (defaults to false)', async () => {
    vi.resetModules();
    const mod = await import('@/lib/outbox-sync');
    expect(mod.isEdgeMode()).toBe(false);
  });

  it('onSyncChange returns unsubscribe function', async () => {
    vi.resetModules();
    const mod = await import('@/lib/outbox-sync');

    const listener = vi.fn();
    const unsub = mod.onSyncChange(listener);
    expect(typeof unsub).toBe('function');

    // Unsubscribe should not throw
    unsub();
  });
});
