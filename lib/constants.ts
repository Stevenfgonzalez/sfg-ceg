// Canonical complaint codes — validated server-side on all triage endpoints.
// If a code is not in this set, the API rejects it.

// EMS complaint codes (from ems/page.tsx)
export const EMS_COMPLAINT_CODES = [
  'CHEST_PAIN', 'BLEEDING_MINOR', 'SOB', 'ANKLE_INJURY', 'BURNS',
  'MEDICATION', 'UNRESPONSIVE', 'ANXIETY', 'BLEEDING_SEVERE', 'ASTHMA',
  'ALLERGIC', 'DIZZY', 'DIABETIC', 'OTHER',
] as const;

// Help/triage complaint codes (from help/page.tsx)
export const HELP_COMPLAINT_CODES = [
  'CHEST_PAIN', 'NOT_BREATHING', 'UNCONSCIOUS', 'SEVERE_BLEEDING',
  'CHOKING', 'BURNS', 'BROKEN_BONE', 'BREATHING_HARD', 'CUT_WOUND',
  'DIZZY_FAINT', 'ALLERGIC', 'HEAT_COLD', 'OTHER',
] as const;

// Union of all valid complaint codes across both endpoints
export const VALID_COMPLAINT_CODES: Set<string> = new Set([
  ...EMS_COMPLAINT_CODES,
  ...HELP_COMPLAINT_CODES,
]);

// Valid check-in statuses
export const VALID_STATUSES = [
  'SAFE',
  'EVACUATING',
  'AT_MUSTER',
  'SHELTERING_HERE',
  'NEED_HELP',
  'NEED_MEDICAL',
  'LOOKING_FOR_SOMEONE',
  // Backward compat with Phase 1 codes
  'SIP',
  'NEED_EMS',
] as const;

export const VALID_TRIAGE_TIERS = [1, 2, 3] as const;

// UUID validation regex
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Default incident ID — used when no incident-scoped QR is available
export const DEFAULT_INCIDENT_ID = '00000000-0000-0000-0000-000000000000';
