import { describe, it, expect } from 'vitest';
import {
  VALID_COMPLAINT_CODES, VALID_STATUSES, VALID_TRIAGE_TIERS,
  UUID_REGEX, DEFAULT_INCIDENT_ID,
  NEED_CATEGORIES, VALID_NEED_CATEGORY_CODES, VALID_PRIORITIES,
} from '@/lib/constants';

describe('VALID_COMPLAINT_CODES', () => {
  // EMS page codes
  const emsPageCodes = [
    'CHEST_PAIN', 'BLEEDING_MINOR', 'SOB', 'ANKLE_INJURY', 'BURNS',
    'MEDICATION', 'UNRESPONSIVE', 'ANXIETY', 'BLEEDING_SEVERE', 'ASTHMA',
    'ALLERGIC', 'DIZZY', 'DIABETIC', 'OTHER',
  ];

  // Help page codes
  const helpPageCodes = [
    'CHEST_PAIN', 'NOT_BREATHING', 'UNCONSCIOUS', 'SEVERE_BLEEDING',
    'CHOKING', 'BURNS', 'BROKEN_BONE', 'BREATHING_HARD', 'CUT_WOUND',
    'DIZZY_FAINT', 'ALLERGIC', 'HEAT_COLD', 'OTHER',
  ];

  it('contains all EMS page complaint codes', () => {
    for (const code of emsPageCodes) {
      expect(VALID_COMPLAINT_CODES.has(code), `Missing EMS code: ${code}`).toBe(true);
    }
  });

  it('contains all help page complaint codes', () => {
    for (const code of helpPageCodes) {
      expect(VALID_COMPLAINT_CODES.has(code), `Missing help code: ${code}`).toBe(true);
    }
  });

  it('rejects invalid codes', () => {
    expect(VALID_COMPLAINT_CODES.has('INVALID_CODE')).toBe(false);
    expect(VALID_COMPLAINT_CODES.has('')).toBe(false);
    expect(VALID_COMPLAINT_CODES.has('chest_pain')).toBe(false); // case sensitive
  });
});

describe('VALID_STATUSES', () => {
  it('contains all 7 active statuses', () => {
    const required = ['SAFE', 'EVACUATING', 'AT_MUSTER', 'SHELTERING_HERE', 'NEED_HELP', 'NEED_MEDICAL', 'LOOKING_FOR_SOMEONE'];
    for (const s of required) {
      expect(VALID_STATUSES.includes(s as typeof VALID_STATUSES[number])).toBe(true);
    }
  });

  it('contains backward compat codes', () => {
    expect(VALID_STATUSES.includes('SIP')).toBe(true);
    expect(VALID_STATUSES.includes('NEED_EMS')).toBe(true);
  });

  it('contains lifecycle statuses LEFT and MOVED', () => {
    expect(VALID_STATUSES.includes('LEFT')).toBe(true);
    expect(VALID_STATUSES.includes('MOVED')).toBe(true);
  });
});

describe('VALID_TRIAGE_TIERS', () => {
  it('contains 1, 2, 3', () => {
    expect(VALID_TRIAGE_TIERS).toEqual([1, 2, 3]);
  });
});

describe('UUID_REGEX', () => {
  it('matches valid UUIDs', () => {
    expect(UUID_REGEX.test('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects invalid strings', () => {
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false);
    expect(UUID_REGEX.test('')).toBe(false);
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716')).toBe(false);
  });
});

describe('DEFAULT_INCIDENT_ID', () => {
  it('is a valid UUID', () => {
    expect(UUID_REGEX.test(DEFAULT_INCIDENT_ID)).toBe(true);
  });

  it('is the null UUID', () => {
    expect(DEFAULT_INCIDENT_ID).toBe('00000000-0000-0000-0000-000000000000');
  });
});

describe('NEED_CATEGORIES', () => {
  it('has 10 categories', () => {
    expect(NEED_CATEGORIES).toHaveLength(10);
  });

  it('each category has code, label, and needs_ems', () => {
    for (const cat of NEED_CATEGORIES) {
      expect(typeof cat.code).toBe('string');
      expect(typeof cat.label).toBe('string');
      expect(typeof cat.needs_ems).toBe('boolean');
    }
  });

  it('has the correct EMS-critical categories', () => {
    const emsCritical = NEED_CATEGORIES.filter(c => c.needs_ems).map(c => c.code);
    expect(emsCritical).toEqual(expect.arrayContaining(['MEDICAL_EMS', 'OXYGEN', 'SAFETY']));
    expect(emsCritical).toHaveLength(3);
  });

  it('VALID_NEED_CATEGORY_CODES matches NEED_CATEGORIES', () => {
    expect(VALID_NEED_CATEGORY_CODES.size).toBe(NEED_CATEGORIES.length);
    for (const cat of NEED_CATEGORIES) {
      expect(VALID_NEED_CATEGORY_CODES.has(cat.code)).toBe(true);
    }
  });

  it('rejects invalid codes', () => {
    expect(VALID_NEED_CATEGORY_CODES.has('FAKE')).toBe(false);
    expect(VALID_NEED_CATEGORY_CODES.has('')).toBe(false);
  });
});

describe('VALID_PRIORITIES', () => {
  it('contains IMMEDIATE and CAN_WAIT', () => {
    expect(VALID_PRIORITIES).toEqual(['IMMEDIATE', 'CAN_WAIT']);
  });
});
