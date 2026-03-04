// Shared validation logic for API routes.
// Extracted so it can be unit-tested without mocking NextRequest / Supabase.

import {
  VALID_STATUSES,
  VALID_COMPLAINT_CODES,
  VALID_TRIAGE_TIERS,
  VALID_NEED_CATEGORY_CODES,
  VALID_PRIORITIES,
  UUID_REGEX,
} from '@/lib/constants';

// ── Types ──

export interface ValidationError {
  error: string;
  status: number;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ValidationError };

// ── Helpers ──

/** Truncate a string value to a max length, or return null. */
export function safeString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  return value.slice(0, maxLen);
}

/** Truncate and trim a string value, or return null / fallback. */
export function safeTrimmedString(
  value: unknown,
  maxLen: number,
  fallback: string | null = null,
): string | null {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Clamp a number between min and max, defaulting if not a number. */
export function clampInt(value: unknown, min: number, max: number, defaultVal: number): number {
  if (typeof value !== 'number') return defaultVal;
  return Math.max(min, Math.min(max, value));
}

/** Check if a phone string has at least 10 digits. */
export function isValidPhone(phone: unknown): phone is string {
  return typeof phone === 'string' && phone.replace(/\D/g, '').length >= 10;
}

/** Check if a string is a valid UUID. */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

// ── Route Validators ──

export interface CheckinInput {
  incident_id: string;
  full_name: string;
  status: string;
  phone?: string;
  assembly_point?: string | null;
  zone?: string | null;
  party_size?: number;
  pet_count?: number;
  has_dependents?: boolean;
  dependent_names?: string | null;
  needs_transport?: boolean;
  ems_notes?: string | null;
  department?: string | null;
  role?: string | null;
  notes?: string | null;
  contact_name?: string | null;
  lat?: number;
  lon?: number;
  // Needs assessment fields
  adult_count: number;
  child_count: number;
  priority: string | null;
  needs_categories: string[];
}

export function validateCheckinBody(body: Record<string, unknown>): ValidationResult<CheckinInput> {
  const { incident_id, full_name, status } = body as {
    incident_id?: string;
    full_name?: string;
    status?: string;
  };

  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 1) {
    return { ok: false, error: { error: 'Full name is required', status: 400 } };
  }

  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return {
      ok: false,
      error: { error: `Status must be one of: ${VALID_STATUSES.join(', ')}`, status: 400 },
    };
  }

  if (!incident_id || !UUID_REGEX.test(incident_id)) {
    return { ok: false, error: { error: 'Valid incident ID required', status: 400 } };
  }

  // Needs assessment fields
  const adultCount = clampInt(body.adult_count, 0, 50, 0);
  const childCount = clampInt(body.child_count, 0, 50, 0);
  const partySize = Math.max(1, adultCount + childCount);

  const rawPriority = typeof body.priority === 'string' ? body.priority : null;
  const priority = rawPriority && VALID_PRIORITIES.includes(rawPriority as typeof VALID_PRIORITIES[number])
    ? rawPriority
    : null;

  const needsCategories = Array.isArray(body.needs_categories)
    ? (body.needs_categories as unknown[])
        .filter((c): c is string => typeof c === 'string' && VALID_NEED_CATEGORY_CODES.has(c))
        .slice(0, 10)
    : [];

  return {
    ok: true,
    data: {
      incident_id: incident_id as string,
      full_name: (full_name as string).trim().slice(0, 200),
      status: status as string,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      assembly_point: safeString(body.assembly_point, 200),
      zone: safeString(body.zone, 200),
      party_size: body.party_size !== undefined ? clampInt(body.party_size, 1, 50, partySize) : partySize,
      pet_count: clampInt(body.pet_count, 0, 20, 0),
      has_dependents: (body.has_dependents as boolean) ?? false,
      dependent_names: safeString(body.dependent_names, 500),
      needs_transport: (body.needs_transport as boolean) ?? false,
      ems_notes: safeString(body.ems_notes, 1000),
      department: safeString(body.department, 500),
      role: safeString(body.role, 500),
      notes: safeString(body.notes, 1000),
      contact_name: safeTrimmedString(body.contact_name, 500),
      lat: typeof body.lat === 'number' ? body.lat : undefined,
      lon: typeof body.lon === 'number' ? body.lon : undefined,
      adult_count: adultCount,
      child_count: childCount,
      priority,
      needs_categories: needsCategories,
    },
  };
}

export interface EmsInput {
  complaint_code: string;
  complaint_label: string;
  dispatch_note: string | null;
  first_name: string;
  other_text: string | null;
  manual_address: string | null;
  people_count: number;
  tier?: number;
  phone?: string;
  lat?: number;
  lon?: number;
}

export function validateEmsBody(body: Record<string, unknown>): ValidationResult<EmsInput> {
  const { complaint_code } = body as { complaint_code?: string };

  if (!complaint_code) {
    return { ok: false, error: { error: 'Complaint code is required', status: 400 } };
  }

  if (!VALID_COMPLAINT_CODES.has(complaint_code)) {
    return { ok: false, error: { error: 'Invalid complaint code', status: 400 } };
  }

  return {
    ok: true,
    data: {
      complaint_code,
      complaint_label: safeString(body.complaint_label, 500) ?? complaint_code,
      dispatch_note: safeString(body.dispatch_note, 500),
      first_name: safeTrimmedString(body.first_name, 200, 'EMS Caller') as string,
      other_text: safeString(body.other_text, 200),
      manual_address: safeTrimmedString(body.manual_address, 500),
      people_count: clampInt(body.people_count, 1, 50, 1),
      tier: typeof body.tier === 'number' ? body.tier : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      lat: typeof body.lat === 'number' ? body.lat : undefined,
      lon: typeof body.lon === 'number' ? body.lon : undefined,
    },
  };
}

export interface HelpInput {
  incident_id: string;
  complaint_code: string;
  triage_tier: number;
  complaint_label: string;
  dispatch_note: string | null;
  caller_name: string | null;
  party_size: number;
  assembly_point: string | null;
  manual_address: string | null;
  other_text: string | null;
  phone?: string;
  lat?: number;
  lon?: number;
}

export function validateHelpBody(body: Record<string, unknown>): ValidationResult<HelpInput> {
  const { complaint_code, triage_tier, incident_id } = body as {
    complaint_code?: string;
    triage_tier?: number;
    incident_id?: string;
  };

  if (!complaint_code) {
    return { ok: false, error: { error: 'Complaint code is required', status: 400 } };
  }

  if (!VALID_COMPLAINT_CODES.has(complaint_code)) {
    return { ok: false, error: { error: 'Invalid complaint code', status: 400 } };
  }

  if (!triage_tier || !VALID_TRIAGE_TIERS.includes(triage_tier as typeof VALID_TRIAGE_TIERS[number])) {
    return { ok: false, error: { error: 'Valid triage tier required (1, 2, or 3)', status: 400 } };
  }

  if (!incident_id || !UUID_REGEX.test(incident_id)) {
    return { ok: false, error: { error: 'Valid incident ID required', status: 400 } };
  }

  return {
    ok: true,
    data: {
      incident_id: incident_id as string,
      complaint_code,
      triage_tier: triage_tier as number,
      complaint_label: safeString(body.complaint_label, 500) ?? complaint_code,
      dispatch_note: safeString(body.dispatch_note, 500),
      caller_name: safeTrimmedString(body.caller_name, 200),
      party_size: clampInt(body.party_size, 1, 50, 1),
      assembly_point: safeString(body.assembly_point, 200),
      manual_address: safeTrimmedString(body.manual_address, 500),
      other_text: safeString(body.other_text, 200),
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      lat: typeof body.lat === 'number' ? body.lat : undefined,
      lon: typeof body.lon === 'number' ? body.lon : undefined,
    },
  };
}

export type ReunifyAction = 'lookup' | 'request';

export interface ReunifyLookupInput {
  action: 'lookup';
  incident_id: string;
  phone: string;
}

export interface ReunifyRequestInput {
  action: 'request';
  incident_id: string;
  sought_phone?: string;
  sought_name: string | null;
  requester_phone?: string;
  requester_name: string | null;
  relationship: string | null;
}

export function validateReunifyBody(
  body: Record<string, unknown>,
): ValidationResult<ReunifyLookupInput | ReunifyRequestInput> {
  const action = body.action as string;
  const incident_id = body.incident_id as string;

  if (!incident_id || !UUID_REGEX.test(incident_id)) {
    return { ok: false, error: { error: 'Valid incident ID required', status: 400 } };
  }

  if (action === 'lookup') {
    const phone = body.phone;
    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      return { ok: false, error: { error: 'Valid phone number required', status: 400 } };
    }
    return {
      ok: true,
      data: { action: 'lookup', incident_id, phone },
    };
  }

  if (action === 'request') {
    const sought_phone = body.sought_phone;
    const sought_name = body.sought_name;

    if (!sought_phone && !sought_name) {
      return {
        ok: false,
        error: {
          error: 'Phone number or name of the person you are looking for is required',
          status: 400,
        },
      };
    }

    return {
      ok: true,
      data: {
        action: 'request',
        incident_id,
        sought_phone: typeof sought_phone === 'string' ? sought_phone : undefined,
        sought_name: safeTrimmedString(sought_name, 200),
        requester_phone: typeof body.requester_phone === 'string' ? body.requester_phone : undefined,
        requester_name: safeTrimmedString(body.requester_name, 500),
        relationship: safeString(body.relationship, 500),
      },
    };
  }

  return { ok: false, error: { error: 'Invalid action. Use "lookup" or "request".', status: 400 } };
}

// ── Check-in Update (PATCH) ──

export interface CheckinUpdateInput {
  checkin_token: string;
  priority?: string | null;
  needs_categories?: string[];
  status?: string;
  notes?: string | null;
}

export function validateCheckinUpdateBody(
  body: Record<string, unknown>,
): ValidationResult<CheckinUpdateInput> {
  const token = body.checkin_token;
  if (!token || typeof token !== 'string' || token.trim().length < 1) {
    return { ok: false, error: { error: 'checkin_token is required', status: 400 } };
  }

  const result: CheckinUpdateInput = {
    checkin_token: token.trim().slice(0, 36),
  };

  // Priority (optional)
  if (body.priority !== undefined) {
    if (body.priority === null) {
      result.priority = null;
    } else if (typeof body.priority === 'string' && VALID_PRIORITIES.includes(body.priority as typeof VALID_PRIORITIES[number])) {
      result.priority = body.priority;
    } else {
      return { ok: false, error: { error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}`, status: 400 } };
    }
  }

  // Needs categories (optional)
  if (body.needs_categories !== undefined) {
    if (!Array.isArray(body.needs_categories)) {
      return { ok: false, error: { error: 'needs_categories must be an array', status: 400 } };
    }
    result.needs_categories = (body.needs_categories as unknown[])
      .filter((c): c is string => typeof c === 'string' && VALID_NEED_CATEGORY_CODES.has(c))
      .slice(0, 10);
  }

  // Status (optional)
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
      return { ok: false, error: { error: `status must be one of: ${VALID_STATUSES.join(', ')}`, status: 400 } };
    }
    result.status = body.status;
  }

  // Notes (optional)
  if (body.notes !== undefined) {
    result.notes = safeString(body.notes, 1000);
  }

  return { ok: true, data: result };
}

// ── FCC Validators ──

const VALID_CODE_STATUSES = ['full_code', 'dnr', 'dnr_polst', 'comfort_care'] as const;
const VALID_ACCESS_METHODS = ['resident_code', 'incident_number', 'pcr_number'] as const;
const STATE_REGEX = /^[A-Z]{2}$/;
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface FccHouseholdInput {
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  access_code?: string;
  best_door: string | null;
  gate_code: string | null;
  animals: string | null;
  stair_info: string | null;
  hazards: string | null;
  aed_onsite: boolean;
  backup_power: string | null;
}

export function validateFccHouseholdBody(
  body: Record<string, unknown>,
  options: { isUpdate?: boolean } = {},
): ValidationResult<FccHouseholdInput> {
  const name = safeTrimmedString(body.name, 200);
  if (!name) {
    return { ok: false, error: { error: 'Household name is required', status: 400 } };
  }

  const address_line1 = safeTrimmedString(body.address_line1, 300);
  if (!address_line1) {
    return { ok: false, error: { error: 'Address is required', status: 400 } };
  }

  const city = safeTrimmedString(body.city, 100);
  if (!city) {
    return { ok: false, error: { error: 'City is required', status: 400 } };
  }

  const state = safeTrimmedString(body.state, 2);
  if (!state || !STATE_REGEX.test(state)) {
    return { ok: false, error: { error: 'State must be a 2-letter code (e.g. AZ)', status: 400 } };
  }

  const zip = safeTrimmedString(body.zip, 10);
  if (!zip || !ZIP_REGEX.test(zip)) {
    return { ok: false, error: { error: 'Valid ZIP code required (e.g. 85001 or 85001-1234)', status: 400 } };
  }

  const access_code = safeTrimmedString(body.access_code, 20);
  if (!options.isUpdate && (!access_code || access_code.length < 4)) {
    return { ok: false, error: { error: 'Access code must be 4-20 characters', status: 400 } };
  }

  return {
    ok: true,
    data: {
      name,
      address_line1,
      address_line2: safeTrimmedString(body.address_line2, 300),
      city,
      state,
      zip,
      ...(access_code ? { access_code } : {}),
      best_door: safeString(body.best_door, 500),
      gate_code: safeString(body.gate_code, 500),
      animals: safeString(body.animals, 500),
      stair_info: safeString(body.stair_info, 500),
      hazards: safeString(body.hazards, 500),
      aed_onsite: body.aed_onsite === true,
      backup_power: safeString(body.backup_power, 200),
    },
  };
}

export interface FccMemberInput {
  full_name: string;
  date_of_birth: string;
  code_status: string;
  primary_language: string;
  baseline_mental: string | null;
  directive_location: string | null;
  sort_order: number;
}

export function validateFccMemberBody(body: Record<string, unknown>): ValidationResult<FccMemberInput> {
  const full_name = safeTrimmedString(body.full_name, 200);
  if (!full_name) {
    return { ok: false, error: { error: 'Full name is required', status: 400 } };
  }

  const date_of_birth = safeTrimmedString(body.date_of_birth, 10);
  if (!date_of_birth || !DOB_REGEX.test(date_of_birth)) {
    return { ok: false, error: { error: 'Date of birth must be YYYY-MM-DD format', status: 400 } };
  }

  const dobDate = new Date(date_of_birth + 'T00:00:00');
  if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
    return { ok: false, error: { error: 'Date of birth must be a valid past date', status: 400 } };
  }

  const rawCode = safeTrimmedString(body.code_status, 50);
  const code_status = rawCode && VALID_CODE_STATUSES.includes(rawCode as typeof VALID_CODE_STATUSES[number])
    ? rawCode
    : 'full_code';

  return {
    ok: true,
    data: {
      full_name,
      date_of_birth,
      code_status,
      primary_language: safeTrimmedString(body.primary_language, 100, 'English') as string,
      baseline_mental: safeString(body.baseline_mental, 500),
      directive_location: safeString(body.directive_location, 500),
      sort_order: clampInt(body.sort_order, 0, 20, 0),
    },
  };
}

export interface FccContactInput {
  name: string;
  relation: string;
  phone: string;
  sort_order: number;
}

export function validateFccContactBody(body: Record<string, unknown>): ValidationResult<FccContactInput> {
  const name = safeTrimmedString(body.name, 200);
  if (!name) {
    return { ok: false, error: { error: 'Contact name is required', status: 400 } };
  }

  const relation = safeTrimmedString(body.relation, 100);
  if (!relation) {
    return { ok: false, error: { error: 'Relation is required', status: 400 } };
  }

  if (!isValidPhone(body.phone)) {
    return { ok: false, error: { error: 'Valid phone number required (10+ digits)', status: 400 } };
  }

  return {
    ok: true,
    data: {
      name,
      relation,
      phone: body.phone as string,
      sort_order: clampInt(body.sort_order, 0, 20, 0),
    },
  };
}

export interface FccUnlockInput {
  access_method: string;
  access_value: string;
  agency_code: string | null;
}

export function validateFccUnlockBody(body: Record<string, unknown>): ValidationResult<FccUnlockInput> {
  const access_method = safeTrimmedString(body.access_method, 50);
  if (!access_method || !VALID_ACCESS_METHODS.includes(access_method as typeof VALID_ACCESS_METHODS[number])) {
    return { ok: false, error: { error: 'Invalid access_method. Use resident_code, incident_number, or pcr_number', status: 400 } };
  }

  const access_value = safeTrimmedString(body.access_value, 100);
  if (!access_value) {
    return { ok: false, error: { error: 'Missing access_method or access_value', status: 400 } };
  }

  if (access_method === 'resident_code' && access_value.length < 4) {
    return { ok: false, error: { error: 'Access code must be at least 4 characters', status: 400 } };
  }

  if (access_method !== 'resident_code' && access_value.length < 4) {
    return { ok: false, error: { error: 'Invalid access value', status: 400 } };
  }

  return {
    ok: true,
    data: {
      access_method,
      access_value,
      agency_code: safeString(body.agency_code, 100),
    },
  };
}

export interface FccClinicalInput {
  critical_flags?: unknown[];
  medications?: unknown[];
  history?: string[];
  mobility_status?: string | null;
  lift_method?: string | null;
  precautions?: string | null;
  pain_notes?: string | null;
  stair_chair_needed?: boolean;
  equipment?: unknown[];
  life_needs?: unknown[];
}

export function validateFccClinicalBody(body: Record<string, unknown>): ValidationResult<FccClinicalInput> {
  const result: FccClinicalInput = {};

  if (body.critical_flags !== undefined) {
    if (!Array.isArray(body.critical_flags)) {
      return { ok: false, error: { error: 'critical_flags must be an array', status: 400 } };
    }
    result.critical_flags = (body.critical_flags as unknown[]).slice(0, 50);
  }

  if (body.medications !== undefined) {
    if (!Array.isArray(body.medications)) {
      return { ok: false, error: { error: 'medications must be an array', status: 400 } };
    }
    result.medications = (body.medications as unknown[]).slice(0, 50);
  }

  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      return { ok: false, error: { error: 'history must be an array', status: 400 } };
    }
    result.history = (body.history as unknown[])
      .filter((h): h is string => typeof h === 'string')
      .slice(0, 100);
  }

  if (body.equipment !== undefined) {
    if (!Array.isArray(body.equipment)) {
      return { ok: false, error: { error: 'equipment must be an array', status: 400 } };
    }
    result.equipment = (body.equipment as unknown[]).slice(0, 50);
  }

  if (body.life_needs !== undefined) {
    if (!Array.isArray(body.life_needs)) {
      return { ok: false, error: { error: 'life_needs must be an array', status: 400 } };
    }
    result.life_needs = (body.life_needs as unknown[]).slice(0, 50);
  }

  if (body.mobility_status !== undefined) result.mobility_status = safeString(body.mobility_status, 500);
  if (body.lift_method !== undefined) result.lift_method = safeString(body.lift_method, 500);
  if (body.precautions !== undefined) result.precautions = safeString(body.precautions, 500);
  if (body.pain_notes !== undefined) result.pain_notes = safeString(body.pain_notes, 500);
  if (body.stair_chair_needed !== undefined) result.stair_chair_needed = body.stair_chair_needed === true;

  return { ok: true, data: result };
}
