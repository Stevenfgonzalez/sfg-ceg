import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { computeDispatchToken, verifyDispatchAuth } from '@/lib/dispatch-auth';

const TEST_PIN = 'secure-pin-1234';
const TEST_SERVICE_KEY = 'test-service-role-key';

beforeEach(() => {
  vi.stubEnv('DISPATCH_PIN', TEST_PIN);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', TEST_SERVICE_KEY);
});

describe('computeDispatchToken', () => {
  it('produces deterministic output for same inputs', () => {
    const t1 = computeDispatchToken(TEST_PIN);
    const t2 = computeDispatchToken(TEST_PIN);
    expect(t1).toBe(t2);
    expect(t1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('produces different tokens for different PINs', () => {
    const t1 = computeDispatchToken('pin-a');
    const t2 = computeDispatchToken('pin-b');
    expect(t1).not.toBe(t2);
  });
});

describe('verifyDispatchAuth', () => {
  it('accepts valid dispatch cookie', () => {
    const token = computeDispatchToken(TEST_PIN);
    const req = new NextRequest('http://localhost/api/dispatch/queue', {
      headers: { cookie: `ceg_dispatch_token=${token}` },
    });
    expect(verifyDispatchAuth(req)).toBe(true);
  });

  it('rejects invalid cookie value', () => {
    const req = new NextRequest('http://localhost/api/dispatch/queue', {
      headers: { cookie: 'ceg_dispatch_token=deadbeef' },
    });
    expect(verifyDispatchAuth(req)).toBe(false);
  });

  it('rejects missing cookie', () => {
    const req = new NextRequest('http://localhost/api/dispatch/queue');
    expect(verifyDispatchAuth(req)).toBe(false);
  });

  it('rejects when DISPATCH_PIN is not set', () => {
    vi.stubEnv('DISPATCH_PIN', '');
    const token = computeDispatchToken(TEST_PIN);
    const req = new NextRequest('http://localhost/api/dispatch/queue', {
      headers: { cookie: `ceg_dispatch_token=${token}` },
    });
    expect(verifyDispatchAuth(req)).toBe(false);
  });
});
