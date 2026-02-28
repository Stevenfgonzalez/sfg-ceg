// Shared validation logic for API routes.
// Extracted so it can be unit-tested without mocking NextRequest / Supabase.

import {
  VALID_STATUSES,
  VALID_COMPLAINT_CODES,
  VALID_TRIAGE_TIERS,
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

  return {
    ok: true,
    data: {
      incident_id: incident_id as string,
      full_name: (full_name as string).trim().slice(0, 200),
      status: status as string,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      assembly_point: safeString(body.assembly_point, 200),
      zone: safeString(body.zone, 200),
      party_size: clampInt(body.party_size, 1, 50, 1),
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
