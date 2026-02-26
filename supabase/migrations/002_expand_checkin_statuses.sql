-- ============================================
-- Phase 2: Expand check-in statuses & fields
-- ============================================

-- 1. Drop the old 3-status constraint and add the full 7-status set
ALTER TABLE public.checkins
  DROP CONSTRAINT IF EXISTS checkins_status_check;

ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_status_check
  CHECK (status IN (
    'SAFE',
    'EVACUATING',
    'AT_MUSTER',
    'SHELTERING_HERE',
    'NEED_HELP',
    'NEED_MEDICAL',
    'LOOKING_FOR_SOMEONE',
    -- Keep backward compat with old codes
    'SIP',
    'NEED_EMS'
  ));

-- 2. Add pet count
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS pet_count integer NOT NULL DEFAULT 0;

-- 3. Add GPS location columns
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lon double precision;

-- 4. Add contact name (for help statuses where name is captured separately)
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS contact_name text;

-- 5. Index for help-request queries (dispatchers want these fast)
CREATE INDEX IF NOT EXISTS idx_checkins_help
  ON public.checkins (incident_id, status)
  WHERE status IN ('NEED_HELP', 'NEED_MEDICAL', 'NEED_EMS', 'LOOKING_FOR_SOMEONE');
