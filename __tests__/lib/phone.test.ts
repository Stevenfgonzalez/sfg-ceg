import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { normalizePhone, hashPhone, hashPhoneLegacy, phoneLast4, getHashVersion } from '@/lib/phone';

describe('normalizePhone', () => {
  it('normalizes 10-digit number', () => {
    expect(normalizePhone('8185551234')).toBe('+18185551234');
  });

  it('normalizes formatted number with parens and dashes', () => {
    expect(normalizePhone('(818) 555-1234')).toBe('+18185551234');
  });

  it('normalizes 11-digit number starting with 1', () => {
    expect(normalizePhone('18185551234')).toBe('+18185551234');
  });

  it('normalizes number with country code prefix', () => {
    expect(normalizePhone('+18185551234')).toBe('+18185551234');
  });

  it('strips all non-digit characters', () => {
    // 11 digits starting with non-1 go through the fallback path
    expect(normalizePhone('(818) 555-1234 ext. 5')).toBe('+81855512345');
  });
});

describe('hashPhone', () => {
  it('produces deterministic output', () => {
    const h1 = hashPhone('8185551234');
    const h2 = hashPhone('8185551234');
    expect(h1).toBe(h2);
  });

  it('produces same hash for different formats of same number', () => {
    const h1 = hashPhone('(818) 555-1234');
    const h2 = hashPhone('8185551234');
    const h3 = hashPhone('+18185551234');
    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it('returns hex string', () => {
    const hash = hashPhone('8185551234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  describe('with PHONE_HASH_SECRET set', () => {
    beforeEach(() => {
      process.env.PHONE_HASH_SECRET = 'test-secret-key-32-bytes-minimum';
    });

    afterEach(() => {
      delete process.env.PHONE_HASH_SECRET;
    });

    it('produces different hash than legacy', () => {
      const hmacHash = hashPhone('8185551234');
      const legacyHash = hashPhoneLegacy('8185551234');
      expect(hmacHash).not.toBe(legacyHash);
    });

    it('is still deterministic', () => {
      const h1 = hashPhone('8185551234');
      const h2 = hashPhone('8185551234');
      expect(h1).toBe(h2);
    });
  });
});

describe('hashPhoneLegacy', () => {
  it('produces unsalted SHA-256 hash', () => {
    const hash = hashPhoneLegacy('8185551234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches hashPhone when no secret is set', () => {
    delete process.env.PHONE_HASH_SECRET;
    const legacy = hashPhoneLegacy('8185551234');
    const current = hashPhone('8185551234');
    expect(legacy).toBe(current);
  });
});

describe('phoneLast4', () => {
  it('extracts last 4 digits', () => {
    expect(phoneLast4('(818) 555-1234')).toBe('1234');
  });

  it('works with short numbers', () => {
    expect(phoneLast4('1234')).toBe('1234');
  });
});

describe('getHashVersion', () => {
  it('returns 1 when no secret', () => {
    delete process.env.PHONE_HASH_SECRET;
    expect(getHashVersion()).toBe(1);
  });

  it('returns 2 when secret is set', () => {
    process.env.PHONE_HASH_SECRET = 'test-secret';
    expect(getHashVersion()).toBe(2);
    delete process.env.PHONE_HASH_SECRET;
  });
});
