import { describe, it, expect, vi, beforeEach } from 'vitest';

// Clear env so we test in-memory path by default
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('rate-limit (in-memory fallback)', () => {
  it('allows requests under the limit', async () => {
    // Fresh import each time to reset fallbackStore
    vi.resetModules();
    const { checkRateLimit } = await import('@/lib/rate-limit');

    const result = await checkRateLimit('test:under', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks when over limit', async () => {
    vi.resetModules();
    const { checkRateLimit } = await import('@/lib/rate-limit');

    const key = 'test:over';
    // Exhaust all 3 requests
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key, 3, 60_000);
    }
    const result = await checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('reunification preset has 5/min limit', async () => {
    vi.resetModules();
    const { checkReunificationRateLimit } = await import('@/lib/rate-limit');

    // First call should succeed
    const result = await checkReunificationRateLimit('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 5 max - 1 used = 4
  });

  it('general preset has 30/min limit', async () => {
    vi.resetModules();
    const { checkGeneralRateLimit } = await import('@/lib/rate-limit');

    const result = await checkGeneralRateLimit('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29); // 30 max - 1 used = 29
  });
});
