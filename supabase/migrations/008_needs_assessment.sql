-- 008_needs_assessment.sql
-- Safe Zone check-in: structured needs categories, priority queue,
-- adult/child split, status lifecycle, and update token.
-- Additive-only — shared DB with BRASS/MCI.
--
-- NOTE: status column uses a Postgres enum (checkin_status), not a CHECK constraint.
-- The ALTER TYPE statements must be committed before the index that references
-- the new values, so this migration must be applied in two passes:
--   Pass 1: ALTER TYPE lines only
--   Pass 2: Everything else

-- ════════════════════════════════════════════════════════════════════
-- 1. Status enum: add LEFT + MOVED lifecycle statuses
--    (Run this separately — new enum values must be committed first)
-- ════════════════════════════════════════════════════════════════════

ALTER TYPE checkin_status ADD VALUE IF NOT EXISTS 'LEFT';
ALTER TYPE checkin_status ADD VALUE IF NOT EXISTS 'MOVED';

-- ════════════════════════════════════════════════════════════════════
-- 2. Adult/child split (party_size stays for backward compat)
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS adult_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS child_count INTEGER NOT NULL DEFAULT 0;

-- ════════════════════════════════════════════════════════════════════
-- 3. Priority queue semantics
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS priority TEXT
    CHECK (priority IN ('IMMEDIATE', 'CAN_WAIT'));

-- ════════════════════════════════════════════════════════════════════
-- 4. Structured needs categories (replaces free-text ems_notes)
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS needs_categories TEXT[] DEFAULT '{}';

-- ════════════════════════════════════════════════════════════════════
-- 5. Update loop support
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Token for client-side update without auth (12 hex chars)
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS checkin_token TEXT;

-- ════════════════════════════════════════════════════════════════════
-- 6. Link help_requests back to checkins
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS checkin_id UUID REFERENCES public.checkins(id);

-- ════════════════════════════════════════════════════════════════════
-- 7. Indexes
-- ════════════════════════════════════════════════════════════════════

-- Token lookups for the update endpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_token
  ON public.checkins (checkin_token)
  WHERE checkin_token IS NOT NULL;

-- Dispatcher priority queue (BRASS reads this)
CREATE INDEX IF NOT EXISTS idx_checkins_priority
  ON public.checkins (incident_id, priority)
  WHERE priority IS NOT NULL;

-- Needs-category queries for AAR ("how many needed MOBILITY?")
CREATE INDEX IF NOT EXISTS idx_checkins_needs
  ON public.checkins USING GIN (needs_categories);

-- Lifecycle status lookups (requires enum values committed in pass 1)
CREATE INDEX IF NOT EXISTS idx_checkins_left_moved
  ON public.checkins (incident_id, status)
  WHERE status IN ('LEFT', 'MOVED');

-- Help requests linked to checkins
CREATE INDEX IF NOT EXISTS idx_help_requests_checkin_id
  ON public.help_requests (checkin_id)
  WHERE checkin_id IS NOT NULL;
