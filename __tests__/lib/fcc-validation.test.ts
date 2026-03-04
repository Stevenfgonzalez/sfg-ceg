import { describe, it, expect } from 'vitest';
import {
  validateFccHouseholdBody,
  validateFccMemberBody,
  validateFccContactBody,
  validateFccUnlockBody,
  validateFccClinicalBody,
} from '@/lib/api-validation';

// ── validateFccHouseholdBody ──

describe('validateFccHouseholdBody', () => {
  const validBody = {
    name: 'Delgado Household',
    address_line1: '123 Main St',
    city: 'Phoenix',
    state: 'AZ',
    zip: '85001',
    access_code: '4827',
  };

  it('accepts a valid household body', () => {
    const result = validateFccHouseholdBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('Delgado Household');
      expect(result.data.address_line1).toBe('123 Main St');
      expect(result.data.aed_onsite).toBe(false);
    }
  });

  it('rejects missing name', () => {
    const result = validateFccHouseholdBody({ ...validBody, name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/name/i);
  });

  it('rejects missing address', () => {
    const result = validateFccHouseholdBody({ ...validBody, address_line1: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/address/i);
  });

  it('rejects missing city', () => {
    const result = validateFccHouseholdBody({ ...validBody, city: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/city/i);
  });

  it('rejects invalid state code', () => {
    const result = validateFccHouseholdBody({ ...validBody, state: 'Arizona' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/state/i);
  });

  it('rejects lowercase state code', () => {
    const result = validateFccHouseholdBody({ ...validBody, state: 'az' });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid zip code', () => {
    const result = validateFccHouseholdBody({ ...validBody, zip: '8500' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/zip/i);
  });

  it('accepts ZIP+4 format', () => {
    const result = validateFccHouseholdBody({ ...validBody, zip: '85001-1234' });
    expect(result.ok).toBe(true);
  });

  it('rejects short access_code on create', () => {
    const result = validateFccHouseholdBody({ ...validBody, access_code: '12' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/access code/i);
  });

  it('allows missing access_code on update', () => {
    const { access_code: _, ...noCode } = validBody;
    const result = validateFccHouseholdBody(noCode, { isUpdate: true });
    expect(result.ok).toBe(true);
  });

  it('truncates name to 200 chars', () => {
    const result = validateFccHouseholdBody({ ...validBody, name: 'A'.repeat(300) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name.length).toBe(200);
  });

  it('handles optional fields', () => {
    const result = validateFccHouseholdBody({
      ...validBody,
      best_door: 'Front door',
      gate_code: '4491',
      animals: '1 dog',
      aed_onsite: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.best_door).toBe('Front door');
      expect(result.data.aed_onsite).toBe(true);
    }
  });

  it('coerces aed_onsite to boolean', () => {
    const result = validateFccHouseholdBody({ ...validBody, aed_onsite: 'yes' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.aed_onsite).toBe(false);
  });
});

// ── validateFccMemberBody ──

describe('validateFccMemberBody', () => {
  const validBody = {
    full_name: 'Robert Delgado',
    date_of_birth: '1948-03-15',
    code_status: 'dnr_polst',
  };

  it('accepts a valid member body', () => {
    const result = validateFccMemberBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.full_name).toBe('Robert Delgado');
      expect(result.data.date_of_birth).toBe('1948-03-15');
      expect(result.data.code_status).toBe('dnr_polst');
      expect(result.data.primary_language).toBe('English');
    }
  });

  it('rejects missing full_name', () => {
    const result = validateFccMemberBody({ ...validBody, full_name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/name/i);
  });

  it('rejects invalid DOB format', () => {
    const result = validateFccMemberBody({ ...validBody, date_of_birth: '03/15/1948' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/YYYY-MM-DD/i);
  });

  it('rejects future DOB', () => {
    const result = validateFccMemberBody({ ...validBody, date_of_birth: '2099-01-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/past date/i);
  });

  it('defaults invalid code_status to full_code', () => {
    const result = validateFccMemberBody({ ...validBody, code_status: 'invalid_status' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.code_status).toBe('full_code');
  });

  it('defaults missing code_status to full_code', () => {
    const { code_status: _, ...noCode } = validBody;
    const result = validateFccMemberBody(noCode);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.code_status).toBe('full_code');
  });

  it('clamps sort_order', () => {
    const result = validateFccMemberBody({ ...validBody, sort_order: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sort_order).toBe(20);
  });

  it('uses custom primary_language', () => {
    const result = validateFccMemberBody({ ...validBody, primary_language: 'Spanish' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.primary_language).toBe('Spanish');
  });

  it('truncates full_name to 200 chars', () => {
    const result = validateFccMemberBody({ ...validBody, full_name: 'A'.repeat(300) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.full_name.length).toBe(200);
  });
});

// ── validateFccContactBody ──

describe('validateFccContactBody', () => {
  const validBody = {
    name: 'Maria Delgado',
    relation: 'Daughter',
    phone: '(602) 555-0142',
  };

  it('accepts a valid contact body', () => {
    const result = validateFccContactBody(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('Maria Delgado');
      expect(result.data.relation).toBe('Daughter');
      expect(result.data.phone).toBe('(602) 555-0142');
      expect(result.data.sort_order).toBe(0);
    }
  });

  it('rejects missing name', () => {
    const result = validateFccContactBody({ ...validBody, name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/name/i);
  });

  it('rejects missing relation', () => {
    const result = validateFccContactBody({ ...validBody, relation: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/relation/i);
  });

  it('rejects invalid phone (too few digits)', () => {
    const result = validateFccContactBody({ ...validBody, phone: '555-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/phone/i);
  });

  it('rejects non-string phone', () => {
    const result = validateFccContactBody({ ...validBody, phone: 6025550142 });
    expect(result.ok).toBe(false);
  });

  it('clamps sort_order', () => {
    const result = validateFccContactBody({ ...validBody, sort_order: -5 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sort_order).toBe(0);
  });
});

// ── validateFccUnlockBody ──

describe('validateFccUnlockBody', () => {
  it('accepts valid resident_code', () => {
    const result = validateFccUnlockBody({ access_method: 'resident_code', access_value: '4827' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.access_method).toBe('resident_code');
      expect(result.data.access_value).toBe('4827');
    }
  });

  it('accepts valid incident_number', () => {
    const result = validateFccUnlockBody({ access_method: 'incident_number', access_value: 'INC-2026-0042' });
    expect(result.ok).toBe(true);
  });

  it('accepts valid pcr_number', () => {
    const result = validateFccUnlockBody({ access_method: 'pcr_number', access_value: 'PCR-84721' });
    expect(result.ok).toBe(true);
  });

  it('rejects missing access_method', () => {
    const result = validateFccUnlockBody({ access_value: '4827' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/access_method/i);
  });

  it('rejects invalid access_method', () => {
    const result = validateFccUnlockBody({ access_method: 'hacker_method', access_value: '1234' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/access_method/i);
  });

  it('rejects missing access_value', () => {
    const result = validateFccUnlockBody({ access_method: 'resident_code' });
    expect(result.ok).toBe(false);
  });

  it('rejects short resident_code', () => {
    const result = validateFccUnlockBody({ access_method: 'resident_code', access_value: '12' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/4 characters/i);
  });

  it('rejects short incident_number', () => {
    const result = validateFccUnlockBody({ access_method: 'incident_number', access_value: 'AB' });
    expect(result.ok).toBe(false);
  });

  it('handles agency_code', () => {
    const result = validateFccUnlockBody({
      access_method: 'resident_code',
      access_value: '4827',
      agency_code: 'PHX-FD',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.agency_code).toBe('PHX-FD');
  });

  it('nullifies non-string agency_code', () => {
    const result = validateFccUnlockBody({
      access_method: 'resident_code',
      access_value: '4827',
      agency_code: 12345,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.agency_code).toBeNull();
  });
});

// ── validateFccClinicalBody ──

describe('validateFccClinicalBody', () => {
  it('accepts valid clinical data', () => {
    const result = validateFccClinicalBody({
      critical_flags: [{ flag: 'O2 Dependent', type: 'equipment' }],
      medications: [{ name: 'Metoprolol', dose: '25mg' }],
      history: ['CHF', 'COPD'],
      mobility_status: 'ambulatory',
      stair_chair_needed: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.critical_flags).toHaveLength(1);
      expect(result.data.history).toEqual(['CHF', 'COPD']);
      expect(result.data.stair_chair_needed).toBe(true);
    }
  });

  it('rejects non-array critical_flags', () => {
    const result = validateFccClinicalBody({ critical_flags: 'not an array' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/critical_flags/i);
  });

  it('rejects non-array medications', () => {
    const result = validateFccClinicalBody({ medications: 'not an array' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/medications/i);
  });

  it('rejects non-array history', () => {
    const result = validateFccClinicalBody({ history: 'not an array' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toMatch(/history/i);
  });

  it('rejects non-array equipment', () => {
    const result = validateFccClinicalBody({ equipment: {} });
    expect(result.ok).toBe(false);
  });

  it('rejects non-array life_needs', () => {
    const result = validateFccClinicalBody({ life_needs: 42 });
    expect(result.ok).toBe(false);
  });

  it('caps arrays at max length', () => {
    const result = validateFccClinicalBody({
      critical_flags: Array.from({ length: 100 }, (_, i) => ({ flag: `Flag ${i}` })),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.critical_flags!.length).toBe(50);
  });

  it('filters non-string history items', () => {
    const result = validateFccClinicalBody({ history: ['CHF', 42, null, 'COPD'] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.history).toEqual(['CHF', 'COPD']);
  });

  it('truncates scalar fields', () => {
    const result = validateFccClinicalBody({ mobility_status: 'A'.repeat(600) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.mobility_status!.length).toBe(500);
  });

  it('coerces stair_chair_needed to boolean', () => {
    const result = validateFccClinicalBody({ stair_chair_needed: 'yes' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.stair_chair_needed).toBe(false);
  });

  it('accepts empty body (no fields to update)', () => {
    const result = validateFccClinicalBody({});
    expect(result.ok).toBe(true);
  });
});
