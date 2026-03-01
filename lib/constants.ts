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
  // Lifecycle statuses
  'LEFT',
  'MOVED',
  // Backward compat with Phase 1 codes
  'SIP',
  'NEED_EMS',
] as const;

export type StatusKey = typeof VALID_STATUSES[number];

export const VALID_TRIAGE_TIERS = [1, 2, 3] as const;

// ── Needs assessment categories (Safe Zone check-in) ──────────────
// Each category has a needs_ems flag for auto-routing to help queue.

export const NEED_CATEGORIES = [
  { code: 'MEDICAL_EMS',   label: 'Medical / EMS evaluation',       needs_ems: true  },
  { code: 'MOBILITY',      label: 'Mobility / lift assist',          needs_ems: false },
  { code: 'OXYGEN',        label: 'Oxygen / medical device support', needs_ems: true  },
  { code: 'MEDICATION',    label: 'Medication access',               needs_ems: false },
  { code: 'MENTAL_HEALTH', label: 'Mental health / panic',           needs_ems: false },
  { code: 'WATER_FOOD',    label: 'Water / food',                    needs_ems: false },
  { code: 'SHELTER',       label: 'Shelter / blankets',              needs_ems: false },
  { code: 'INFO',          label: 'Info / directions',               needs_ems: false },
  { code: 'REUNIFICATION', label: 'Reunification help',              needs_ems: false },
  { code: 'SAFETY',        label: 'Safety concern / threat',         needs_ems: true  },
] as const;

export type NeedCategoryCode = typeof NEED_CATEGORIES[number]['code'];

export const VALID_NEED_CATEGORY_CODES: Set<string> = new Set(
  NEED_CATEGORIES.map(c => c.code)
);

// Priority queue semantics (not clinical triage)
export const VALID_PRIORITIES = ['IMMEDIATE', 'CAN_WAIT'] as const;
export type Priority = typeof VALID_PRIORITIES[number];

// UUID validation regex
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Default incident ID — used when no incident-scoped QR is available
export const DEFAULT_INCIDENT_ID = '00000000-0000-0000-0000-000000000000';
