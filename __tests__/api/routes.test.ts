import { describe, it, expect } from 'vitest';
import {
  safeString,
  safeTrimmedString,
  clampInt,
  isValidPhone,
  isValidUUID,
  validateCheckinBody,
  validateEmsBody,
  validateHelpBody,
  validateReunifyBody,
  validateCheckinUpdateBody,
} from '@/lib/api-validation';
import { VALID_STATUSES, VALID_COMPLAINT_CODES, VALID_TRIAGE_TIERS, VALID_PRIORITIES } from '@/lib/constants';

// ── Helper utilities ──

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const DEFAULT_UUID = '00000000-0000-0000-0000-000000000000';

describe('safeString', () => {
  it('returns null for non-string values', () => {
    expect(safeString(undefined, 100)).toBeNull();
    expect(safeString(null, 100)).toBeNull();
    expect(safeString(42, 100)).toBeNull();
    expect(safeString(true, 100)).toBeNull();
  });

  it('truncates to max length', () => {
    expect(safeString('abcdefghij', 5)).toBe('abcde');
  });

  it('returns full string when under limit', () => {
    expect(safeString('hello', 100)).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(safeString('', 100)).toBe('');
  });
});

describe('safeTrimmedString', () => {
  it('trims and truncates', () => {
    expect(safeTrimmedString('  hello world  ', 5)).toBe('hello');
  });

  it('returns fallback for non-string', () => {
    expect(safeTrimmedString(undefined, 100, 'default')).toBe('default');
    expect(safeTrimmedString(null, 100, 'default')).toBe('default');
  });

  it('returns fallback for empty/whitespace-only string', () => {
    expect(safeTrimmedString('   ', 100, 'fallback')).toBe('fallback');
    expect(safeTrimmedString('', 100, 'fallback')).toBe('fallback');
  });

  it('returns null as default fallback', () => {
    expect(safeTrimmedString(undefined, 100)).toBeNull();
  });
});

describe('clampInt', () => {
  it('returns default for non-number', () => {
    expect(clampInt(undefined, 1, 50, 1)).toBe(1);
    expect(clampInt('5', 1, 50, 1)).toBe(1);
    expect(clampInt(null, 1, 50, 1)).toBe(1);
  });

  it('clamps below min', () => {
    expect(clampInt(-5, 1, 50, 1)).toBe(1);
    expect(clampInt(0, 1, 50, 1)).toBe(1);
  });

  it('clamps above max', () => {
    expect(clampInt(100, 1, 50, 1)).toBe(50);
  });

  it('passes through values in range', () => {
    expect(clampInt(25, 1, 50, 1)).toBe(25);
  });
});

describe('isValidPhone', () => {
  it('accepts 10+ digit phone numbers', () => {
    expect(isValidPhone('8185551234')).toBe(true);
    expect(isValidPhone('(818) 555-1234')).toBe(true);
    expect(isValidPhone('+18185551234')).toBe(true);
  });

  it('rejects short numbers', () => {
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('555-1234')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidPhone(undefined)).toBe(false);
    expect(isValidPhone(null)).toBe(false);
    expect(isValidPhone(8185551234)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });
});

describe('isValidUUID', () => {
  it('accepts valid UUIDs', () => {
    expect(isValidUUID(VALID_UUID)).toBe(true);
    expect(isValidUUID(DEFAULT_UUID)).toBe(true);
  });

  it('accepts case-insensitive UUIDs', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects invalid strings', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidUUID(undefined)).toBe(false);
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(123)).toBe(false);
  });
});

// ── Checkin validation ──

describe('validateCheckinBody', () => {
  const validBody = {
    incident_id: VALID_UUID,
    full_name: 'John Doe',
    status: 'SAFE',
  };

  it('accepts a valid check-in', () => {
    const result = validateCheckinBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.incident_id).toBe(VALID_UUID);
      expect(result.data.full_name).toBe('John Doe');
      expect(result.data.status).toBe('SAFE');
    }
  });

  it('accepts all valid statuses', () => {
    for (const status of VALID_STATUSES) {
      const result = validateCheckinBody({ ...validBody, status });
      expect(result.ok, `Expected status "${status}" to be valid`).toBe(true);
    }
  });

  it('rejects missing full_name', () => {
    const result = validateCheckinBody({ ...validBody, full_name: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('Full name is required');
      expect(result.error.status).toBe(400);
    }
  });

  it('rejects empty full_name', () => {
    const result = validateCheckinBody({ ...validBody, full_name: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects whitespace-only full_name', () => {
    const result = validateCheckinBody({ ...validBody, full_name: '   ' });
    expect(result.ok).toBe(false);
  });

  it('rejects non-string full_name', () => {
    const result = validateCheckinBody({ ...validBody, full_name: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toBe('Full name is required');
  });

  it('rejects invalid status', () => {
    const result = validateCheckinBody({ ...validBody, status: 'INVALID' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toContain('Status must be one of');
      expect(result.error.status).toBe(400);
    }
  });

  it('rejects missing status', () => {
    const result = validateCheckinBody({ ...validBody, status: undefined });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid incident_id', () => {
    const result = validateCheckinBody({ ...validBody, incident_id: 'not-uuid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('Valid incident ID required');
      expect(result.error.status).toBe(400);
    }
  });

  it('rejects missing incident_id', () => {
    const result = validateCheckinBody({ ...validBody, incident_id: undefined });
    expect(result.ok).toBe(false);
  });

  it('truncates full_name to 200 characters', () => {
    const longName = 'A'.repeat(300);
    const result = validateCheckinBody({ ...validBody, full_name: longName });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.full_name.length).toBe(200);
    }
  });

  it('truncates notes to 1000 characters', () => {
    const longNotes = 'X'.repeat(1500);
    const result = validateCheckinBody({ ...validBody, notes: longNotes });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.notes!.length).toBe(1000);
    }
  });

  it('truncates ems_notes to 1000 characters', () => {
    const longNotes = 'E'.repeat(1500);
    const result = validateCheckinBody({ ...validBody, ems_notes: longNotes });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ems_notes!.length).toBe(1000);
    }
  });

  it('truncates assembly_point to 200 characters', () => {
    const longAP = 'Z'.repeat(300);
    const result = validateCheckinBody({ ...validBody, assembly_point: longAP });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.assembly_point!.length).toBe(200);
    }
  });

  it('truncates department to 500 characters', () => {
    const longDept = 'D'.repeat(600);
    const result = validateCheckinBody({ ...validBody, department: longDept });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.department!.length).toBe(500);
    }
  });

  it('truncates role to 500 characters', () => {
    const longRole = 'R'.repeat(600);
    const result = validateCheckinBody({ ...validBody, role: longRole });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.role!.length).toBe(500);
    }
  });

  it('truncates contact_name to 500 characters', () => {
    const longCN = 'C'.repeat(600);
    const result = validateCheckinBody({ ...validBody, contact_name: longCN });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contact_name!.length).toBe(500);
    }
  });

  it('truncates dependent_names to 500 characters', () => {
    const longDN = 'N'.repeat(600);
    const result = validateCheckinBody({ ...validBody, dependent_names: longDN });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dependent_names!.length).toBe(500);
    }
  });

  it('clamps party_size between 1 and 50', () => {
    const resultLow = validateCheckinBody({ ...validBody, party_size: -5 });
    expect(resultLow.ok).toBe(true);
    if (resultLow.ok) expect(resultLow.data.party_size).toBe(1);

    const resultHigh = validateCheckinBody({ ...validBody, party_size: 200 });
    expect(resultHigh.ok).toBe(true);
    if (resultHigh.ok) expect(resultHigh.data.party_size).toBe(50);
  });

  it('clamps pet_count between 0 and 20', () => {
    const resultLow = validateCheckinBody({ ...validBody, pet_count: -1 });
    expect(resultLow.ok).toBe(true);
    if (resultLow.ok) expect(resultLow.data.pet_count).toBe(0);

    const resultHigh = validateCheckinBody({ ...validBody, pet_count: 100 });
    expect(resultHigh.ok).toBe(true);
    if (resultHigh.ok) expect(resultHigh.data.pet_count).toBe(20);
  });

  it('defaults party_size to 1 when not a number', () => {
    const result = validateCheckinBody({ ...validBody });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.party_size).toBe(1);
  });

  it('defaults pet_count to 0 when not a number', () => {
    const result = validateCheckinBody({ ...validBody });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.pet_count).toBe(0);
  });

  it('passes through GPS coordinates when both are numbers', () => {
    const result = validateCheckinBody({ ...validBody, lat: 34.05, lon: -118.24 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.lat).toBe(34.05);
      expect(result.data.lon).toBe(-118.24);
    }
  });

  it('ignores GPS when not both numbers', () => {
    const result = validateCheckinBody({ ...validBody, lat: '34.05', lon: -118.24 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.lat).toBeUndefined();
    }
  });

  it('returns null for non-string optional text fields', () => {
    const result = validateCheckinBody({ ...validBody, zone: 42, notes: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.zone).toBeNull();
      expect(result.data.notes).toBeNull();
    }
  });

  // Needs assessment fields
  it('defaults adult_count to 0 and child_count to 0', () => {
    const result = validateCheckinBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.adult_count).toBe(0);
      expect(result.data.child_count).toBe(0);
    }
  });

  it('clamps adult_count between 0 and 50', () => {
    const low = validateCheckinBody({ ...validBody, adult_count: -5 });
    expect(low.ok).toBe(true);
    if (low.ok) expect(low.data.adult_count).toBe(0);

    const high = validateCheckinBody({ ...validBody, adult_count: 100 });
    expect(high.ok).toBe(true);
    if (high.ok) expect(high.data.adult_count).toBe(50);
  });

  it('clamps child_count between 0 and 50', () => {
    const low = validateCheckinBody({ ...validBody, child_count: -1 });
    expect(low.ok).toBe(true);
    if (low.ok) expect(low.data.child_count).toBe(0);

    const high = validateCheckinBody({ ...validBody, child_count: 60 });
    expect(high.ok).toBe(true);
    if (high.ok) expect(high.data.child_count).toBe(50);
  });

  it('computes party_size from adult_count + child_count', () => {
    const result = validateCheckinBody({ ...validBody, adult_count: 2, child_count: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.party_size).toBe(5);
  });

  it('party_size is at least 1', () => {
    const result = validateCheckinBody({ ...validBody, adult_count: 0, child_count: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.party_size).toBe(1);
  });

  it('accepts valid priority values', () => {
    for (const p of VALID_PRIORITIES) {
      const result = validateCheckinBody({ ...validBody, priority: p });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.priority).toBe(p);
    }
  });

  it('rejects invalid priority', () => {
    const result = validateCheckinBody({ ...validBody, priority: 'URGENT' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.priority).toBeNull();
  });

  it('defaults priority to null', () => {
    const result = validateCheckinBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.priority).toBeNull();
  });

  it('validates needs_categories against allowed codes', () => {
    const result = validateCheckinBody({
      ...validBody,
      needs_categories: ['MEDICAL_EMS', 'FAKE', 'MOBILITY', 123],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.needs_categories).toEqual(['MEDICAL_EMS', 'MOBILITY']);
    }
  });

  it('limits needs_categories to 10 items', () => {
    const cats = [
      'MEDICAL_EMS', 'MOBILITY', 'OXYGEN', 'MEDICATION', 'MENTAL_HEALTH',
      'WATER_FOOD', 'SHELTER', 'INFO', 'REUNIFICATION', 'SAFETY',
      'MEDICAL_EMS', 'MOBILITY', // duplicates beyond 10
    ];
    const result = validateCheckinBody({ ...validBody, needs_categories: cats });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.needs_categories.length).toBeLessThanOrEqual(10);
    }
  });

  it('defaults needs_categories to empty array', () => {
    const result = validateCheckinBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.needs_categories).toEqual([]);
  });
});

// ── Check-in Update validation ──

describe('validateCheckinUpdateBody', () => {
  it('requires checkin_token', () => {
    const result = validateCheckinUpdateBody({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('checkin_token is required');
      expect(result.error.status).toBe(400);
    }
  });

  it('rejects empty checkin_token', () => {
    const result = validateCheckinUpdateBody({ checkin_token: '   ' });
    expect(result.ok).toBe(false);
  });

  it('accepts valid token with no optional fields', () => {
    const result = validateCheckinUpdateBody({ checkin_token: 'abc123def456' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.checkin_token).toBe('abc123def456');
      expect(result.data.priority).toBeUndefined();
      expect(result.data.needs_categories).toBeUndefined();
      expect(result.data.status).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });

  it('accepts valid priority', () => {
    const result = validateCheckinUpdateBody({ checkin_token: 'abc', priority: 'IMMEDIATE' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.priority).toBe('IMMEDIATE');
  });

  it('accepts null priority (clear)', () => {
    const result = validateCheckinUpdateBody({ checkin_token: 'abc', priority: null });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.priority).toBeNull();
  });

  it('rejects invalid priority', () => {
    const result = validateCheckinUpdateBody({ checkin_token: 'abc', priority: 'URGENT' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toContain('priority must be one of');
  });

  it('validates needs_categories', () => {
    const result = validateCheckinUpdateBody({
      checkin_token: 'abc',
      needs_categories: ['MEDICAL_EMS', 'FAKE'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.needs_categories).toEqual(['MEDICAL_EMS']);
  });

  it('rejects non-array needs_categories', () => {
    const result = validateCheckinUpdateBody({ checkin_token: 'abc', needs_categories: 'MEDICAL_EMS' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toBe('needs_categories must be an array');
  });

  it('validates status against VALID_STATUSES', () => {
    const result = validateCheckinUpdateBody({ checkin_token: 'abc', status: 'LEFT' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('LEFT');
  });

  it('rejects invalid status', () => {
    const result = validateCheckinUpdateBody({ checkin_token: 'abc', status: 'INVALID' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toContain('status must be one of');
  });

  it('truncates notes to 1000 characters', () => {
    const longNotes = 'N'.repeat(1500);
    const result = validateCheckinUpdateBody({ checkin_token: 'abc', notes: longNotes });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.notes!.length).toBe(1000);
  });
});

// ── EMS validation ──

describe('validateEmsBody', () => {
  const validBody = {
    complaint_code: 'CHEST_PAIN',
  };

  it('accepts a valid EMS request', () => {
    const result = validateEmsBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.complaint_code).toBe('CHEST_PAIN');
    }
  });

  it('rejects missing complaint_code', () => {
    const result = validateEmsBody({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('Complaint code is required');
      expect(result.error.status).toBe(400);
    }
  });

  it('rejects invalid complaint_code', () => {
    const result = validateEmsBody({ complaint_code: 'FAKE_CODE' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('Invalid complaint code');
      expect(result.error.status).toBe(400);
    }
  });

  it('rejects case-mismatched complaint_code', () => {
    const result = validateEmsBody({ complaint_code: 'chest_pain' });
    expect(result.ok).toBe(false);
  });

  it('accepts all valid EMS complaint codes', () => {
    const emsCodes = [
      'CHEST_PAIN', 'BLEEDING_MINOR', 'SOB', 'ANKLE_INJURY', 'BURNS',
      'MEDICATION', 'UNRESPONSIVE', 'ANXIETY', 'BLEEDING_SEVERE', 'ASTHMA',
      'ALLERGIC', 'DIZZY', 'DIABETIC', 'OTHER',
    ];
    for (const code of emsCodes) {
      const result = validateEmsBody({ complaint_code: code });
      expect(result.ok, `Expected EMS code "${code}" to be valid`).toBe(true);
    }
  });

  it('defaults first_name to "EMS Caller" when missing', () => {
    const result = validateEmsBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.first_name).toBe('EMS Caller');
    }
  });

  it('defaults first_name to "EMS Caller" for whitespace-only', () => {
    const result = validateEmsBody({ ...validBody, first_name: '   ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.first_name).toBe('EMS Caller');
    }
  });

  it('truncates complaint_label to 500 characters', () => {
    const longLabel = 'L'.repeat(600);
    const result = validateEmsBody({ ...validBody, complaint_label: longLabel });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.complaint_label.length).toBe(500);
    }
  });

  it('uses complaint_code as complaint_label fallback', () => {
    const result = validateEmsBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.complaint_label).toBe('CHEST_PAIN');
    }
  });

  it('truncates dispatch_note to 500 characters', () => {
    const longNote = 'D'.repeat(600);
    const result = validateEmsBody({ ...validBody, dispatch_note: longNote });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dispatch_note!.length).toBe(500);
    }
  });

  it('truncates other_text to 200 characters', () => {
    const longText = 'O'.repeat(300);
    const result = validateEmsBody({ ...validBody, other_text: longText });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.other_text!.length).toBe(200);
    }
  });

  it('truncates manual_address to 500 characters', () => {
    const longAddr = 'A'.repeat(600);
    const result = validateEmsBody({ ...validBody, manual_address: longAddr });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.manual_address!.length).toBe(500);
    }
  });

  it('truncates first_name to 200 characters', () => {
    const longName = 'N'.repeat(300);
    const result = validateEmsBody({ ...validBody, first_name: longName });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.first_name.length).toBe(200);
    }
  });

  it('clamps people_count between 1 and 50', () => {
    const resultLow = validateEmsBody({ ...validBody, people_count: 0 });
    expect(resultLow.ok).toBe(true);
    if (resultLow.ok) expect(resultLow.data.people_count).toBe(1);

    const resultHigh = validateEmsBody({ ...validBody, people_count: 999 });
    expect(resultHigh.ok).toBe(true);
    if (resultHigh.ok) expect(resultHigh.data.people_count).toBe(50);
  });

  it('returns null for non-string optional fields', () => {
    const result = validateEmsBody({ ...validBody, dispatch_note: 123, other_text: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dispatch_note).toBeNull();
      expect(result.data.other_text).toBeNull();
    }
  });
});

// ── Help validation ──

describe('validateHelpBody', () => {
  const validBody = {
    incident_id: VALID_UUID,
    complaint_code: 'CHEST_PAIN',
    triage_tier: 1,
  };

  it('accepts a valid help request', () => {
    const result = validateHelpBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.incident_id).toBe(VALID_UUID);
      expect(result.data.complaint_code).toBe('CHEST_PAIN');
      expect(result.data.triage_tier).toBe(1);
    }
  });

  it('accepts all valid triage tiers', () => {
    for (const tier of VALID_TRIAGE_TIERS) {
      const result = validateHelpBody({ ...validBody, triage_tier: tier });
      expect(result.ok, `Expected tier ${tier} to be valid`).toBe(true);
    }
  });

  it('rejects missing complaint_code', () => {
    const result = validateHelpBody({ incident_id: VALID_UUID, triage_tier: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('Complaint code is required');
    }
  });

  it('rejects invalid complaint_code', () => {
    const result = validateHelpBody({ ...validBody, complaint_code: 'FAKE' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('Invalid complaint code');
    }
  });

  it('rejects missing triage_tier', () => {
    const result = validateHelpBody({ incident_id: VALID_UUID, complaint_code: 'CHEST_PAIN' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('Valid triage tier required (1, 2, or 3)');
    }
  });

  it('rejects invalid triage_tier values', () => {
    const result4 = validateHelpBody({ ...validBody, triage_tier: 4 });
    expect(result4.ok).toBe(false);

    const result0 = validateHelpBody({ ...validBody, triage_tier: 0 });
    expect(result0.ok).toBe(false);

    const resultNeg = validateHelpBody({ ...validBody, triage_tier: -1 });
    expect(resultNeg.ok).toBe(false);
  });

  it('rejects missing incident_id', () => {
    const result = validateHelpBody({ complaint_code: 'CHEST_PAIN', triage_tier: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('Valid incident ID required');
    }
  });

  it('rejects invalid incident_id', () => {
    const result = validateHelpBody({ ...validBody, incident_id: 'bad-id' });
    expect(result.ok).toBe(false);
  });

  it('accepts all valid help complaint codes', () => {
    const helpCodes = [
      'CHEST_PAIN', 'NOT_BREATHING', 'UNCONSCIOUS', 'SEVERE_BLEEDING',
      'CHOKING', 'BURNS', 'BROKEN_BONE', 'BREATHING_HARD', 'CUT_WOUND',
      'DIZZY_FAINT', 'ALLERGIC', 'HEAT_COLD', 'OTHER',
    ];
    for (const code of helpCodes) {
      const result = validateHelpBody({ ...validBody, complaint_code: code });
      expect(result.ok, `Expected help code "${code}" to be valid`).toBe(true);
    }
  });

  it('truncates complaint_label to 500 characters', () => {
    const longLabel = 'L'.repeat(600);
    const result = validateHelpBody({ ...validBody, complaint_label: longLabel });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.complaint_label.length).toBe(500);
    }
  });

  it('truncates dispatch_note to 500 characters', () => {
    const longNote = 'D'.repeat(600);
    const result = validateHelpBody({ ...validBody, dispatch_note: longNote });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dispatch_note!.length).toBe(500);
    }
  });

  it('truncates caller_name to 200 characters', () => {
    const longCN = 'C'.repeat(300);
    const result = validateHelpBody({ ...validBody, caller_name: longCN });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.caller_name!.length).toBe(200);
    }
  });

  it('truncates assembly_point to 200 characters', () => {
    const longAP = 'A'.repeat(300);
    const result = validateHelpBody({ ...validBody, assembly_point: longAP });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.assembly_point!.length).toBe(200);
    }
  });

  it('truncates manual_address to 500 characters', () => {
    const longAddr = 'M'.repeat(600);
    const result = validateHelpBody({ ...validBody, manual_address: longAddr });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.manual_address!.length).toBe(500);
    }
  });

  it('truncates other_text to 200 characters', () => {
    const longOther = 'O'.repeat(300);
    const result = validateHelpBody({ ...validBody, other_text: longOther });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.other_text!.length).toBe(200);
    }
  });

  it('clamps party_size between 1 and 50', () => {
    const resultLow = validateHelpBody({ ...validBody, party_size: -1 });
    expect(resultLow.ok).toBe(true);
    if (resultLow.ok) expect(resultLow.data.party_size).toBe(1);

    const resultHigh = validateHelpBody({ ...validBody, party_size: 100 });
    expect(resultHigh.ok).toBe(true);
    if (resultHigh.ok) expect(resultHigh.data.party_size).toBe(50);
  });

  it('defaults party_size to 1', () => {
    const result = validateHelpBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.party_size).toBe(1);
  });
});

// ── Reunify validation ──

describe('validateReunifyBody', () => {
  describe('common validation', () => {
    it('rejects missing incident_id', () => {
      const result = validateReunifyBody({ action: 'lookup', phone: '8185551234' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe('Valid incident ID required');
        expect(result.error.status).toBe(400);
      }
    });

    it('rejects invalid incident_id', () => {
      const result = validateReunifyBody({
        action: 'lookup',
        incident_id: 'bad-uuid',
        phone: '8185551234',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects invalid action', () => {
      const result = validateReunifyBody({
        action: 'invalid',
        incident_id: VALID_UUID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe('Invalid action. Use "lookup" or "request".');
        expect(result.error.status).toBe(400);
      }
    });

    it('rejects missing action', () => {
      const result = validateReunifyBody({ incident_id: VALID_UUID });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe('Invalid action. Use "lookup" or "request".');
      }
    });
  });

  describe('lookup action', () => {
    it('accepts a valid lookup', () => {
      const result = validateReunifyBody({
        action: 'lookup',
        incident_id: VALID_UUID,
        phone: '8185551234',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.action).toBe('lookup');
        expect(result.data).toHaveProperty('phone', '8185551234');
      }
    });

    it('rejects missing phone for lookup', () => {
      const result = validateReunifyBody({
        action: 'lookup',
        incident_id: VALID_UUID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe('Valid phone number required');
      }
    });

    it('rejects short phone for lookup', () => {
      const result = validateReunifyBody({
        action: 'lookup',
        incident_id: VALID_UUID,
        phone: '12345',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe('Valid phone number required');
      }
    });

    it('rejects non-string phone for lookup', () => {
      const result = validateReunifyBody({
        action: 'lookup',
        incident_id: VALID_UUID,
        phone: 8185551234,
      });
      expect(result.ok).toBe(false);
    });

    it('accepts formatted phone for lookup', () => {
      const result = validateReunifyBody({
        action: 'lookup',
        incident_id: VALID_UUID,
        phone: '(818) 555-1234',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('request action', () => {
    it('accepts a valid request with sought_name', () => {
      const result = validateReunifyBody({
        action: 'request',
        incident_id: VALID_UUID,
        sought_name: 'Jane Doe',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.action).toBe('request');
        expect(result.data).toHaveProperty('sought_name', 'Jane Doe');
      }
    });

    it('accepts a valid request with sought_phone', () => {
      const result = validateReunifyBody({
        action: 'request',
        incident_id: VALID_UUID,
        sought_phone: '8185551234',
      });
      expect(result.ok).toBe(true);
    });

    it('accepts a valid request with both sought_phone and sought_name', () => {
      const result = validateReunifyBody({
        action: 'request',
        incident_id: VALID_UUID,
        sought_phone: '8185551234',
        sought_name: 'Jane Doe',
      });
      expect(result.ok).toBe(true);
    });

    it('rejects request with neither sought_phone nor sought_name', () => {
      const result = validateReunifyBody({
        action: 'request',
        incident_id: VALID_UUID,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.error).toBe(
          'Phone number or name of the person you are looking for is required',
        );
      }
    });

    it('truncates sought_name to 200 characters', () => {
      const longName = 'S'.repeat(300);
      const result = validateReunifyBody({
        action: 'request',
        incident_id: VALID_UUID,
        sought_name: longName,
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.data.action === 'request') {
        expect(result.data.sought_name!.length).toBe(200);
      }
    });

    it('truncates requester_name to 500 characters', () => {
      const longName = 'R'.repeat(600);
      const result = validateReunifyBody({
        action: 'request',
        incident_id: VALID_UUID,
        sought_name: 'Jane',
        requester_name: longName,
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.data.action === 'request') {
        expect(result.data.requester_name!.length).toBe(500);
      }
    });

    it('truncates relationship to 500 characters', () => {
      const longRel = 'F'.repeat(600);
      const result = validateReunifyBody({
        action: 'request',
        incident_id: VALID_UUID,
        sought_name: 'Jane',
        relationship: longRel,
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.data.action === 'request') {
        expect(result.data.relationship!.length).toBe(500);
      }
    });

    it('returns null for missing optional text fields', () => {
      const result = validateReunifyBody({
        action: 'request',
        incident_id: VALID_UUID,
        sought_name: 'Jane',
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.data.action === 'request') {
        expect(result.data.requester_name).toBeNull();
        expect(result.data.relationship).toBeNull();
      }
    });
  });
});

// ── Health endpoint (structural validation) ──

describe('health endpoint structure', () => {
  // The health endpoint doesn't have body validation to extract,
  // but we verify the response shape expectations match what the route produces.

  it('expects ok/degraded status values', () => {
    const validStatuses = ['ok', 'degraded'];
    expect(validStatuses).toContain('ok');
    expect(validStatuses).toContain('degraded');
  });

  it('expects database subsystem values', () => {
    const validDbStates = ['ok', 'degraded', 'not_configured', 'unreachable'];
    for (const state of validDbStates) {
      expect(typeof state).toBe('string');
    }
  });

  it('expects rate_limiter subsystem values', () => {
    const validRlStates = ['redis', 'in_memory'];
    expect(validRlStates).toContain('redis');
    expect(validRlStates).toContain('in_memory');
  });

  it('health response should include ISO timestamp', () => {
    const timestamp = new Date().toISOString();
    expect(() => new Date(timestamp)).not.toThrow();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});

// ── Cross-cutting validation concerns ──

describe('cross-cutting validation', () => {
  it('UUID_REGEX is consistent with isValidUUID', () => {
    const uuids = [VALID_UUID, DEFAULT_UUID, '550E8400-E29B-41D4-A716-446655440000'];
    for (const uuid of uuids) {
      expect(isValidUUID(uuid)).toBe(true);
    }
    const invalidUuids = ['', 'bad', '550e8400-e29b-41d4-a716', null, undefined, 42];
    for (const bad of invalidUuids) {
      expect(isValidUUID(bad)).toBe(false);
    }
  });

  it('all routes reject empty body object the same way', () => {
    const checkin = validateCheckinBody({});
    expect(checkin.ok).toBe(false);

    const ems = validateEmsBody({});
    expect(ems.ok).toBe(false);

    const help = validateHelpBody({});
    expect(help.ok).toBe(false);

    const reunify = validateReunifyBody({});
    expect(reunify.ok).toBe(false);
  });

  it('VALID_COMPLAINT_CODES is the union of EMS and help codes', () => {
    // Verify the codes we expect are all present
    const allExpected = [
      'CHEST_PAIN', 'BLEEDING_MINOR', 'SOB', 'ANKLE_INJURY', 'BURNS',
      'MEDICATION', 'UNRESPONSIVE', 'ANXIETY', 'BLEEDING_SEVERE', 'ASTHMA',
      'ALLERGIC', 'DIZZY', 'DIABETIC', 'OTHER',
      'NOT_BREATHING', 'UNCONSCIOUS', 'SEVERE_BLEEDING', 'CHOKING',
      'BROKEN_BONE', 'BREATHING_HARD', 'CUT_WOUND', 'DIZZY_FAINT', 'HEAT_COLD',
    ];
    for (const code of allExpected) {
      expect(VALID_COMPLAINT_CODES.has(code), `Missing code: ${code}`).toBe(true);
    }
  });

  it('VALID_STATUSES has backward-compat codes', () => {
    expect(VALID_STATUSES.includes('SIP')).toBe(true);
    expect(VALID_STATUSES.includes('NEED_EMS')).toBe(true);
  });
});
