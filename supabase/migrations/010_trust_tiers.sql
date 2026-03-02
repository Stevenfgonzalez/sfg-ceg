-- Migration 010: Trust tiers for PASS-linked check-ins
-- SAFE FOR SHARED SUPABASE: Additive only (new columns + indexes)
--
-- Trust tiers:
--   0 = unverified (anonymous QR check-in, default)
--   1 = device-verified (GPS/confidence from BRASS)
--   2 = PASS-linked (email verified via PASS account)
--   3 = wearable-linked (NFC/UHF G-Band scan)

-- ── checkins table ──────────────────────────────────────────────────

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS trust_tier SMALLINT NOT NULL DEFAULT 0
    CHECK (trust_tier >= 0 AND trust_tier <= 3);

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS pass_account_id UUID;

-- AAR analytics: breakdown by trust tier per incident
CREATE INDEX IF NOT EXISTS idx_checkins_trust_tier
  ON public.checkins (incident_id, trust_tier);

-- Household lookup: find all check-ins linked to a PASS account
CREATE INDEX IF NOT EXISTS idx_checkins_pass_account
  ON public.checkins (pass_account_id)
  WHERE pass_account_id IS NOT NULL;

-- ── checkins_archive table (must match checkins structure) ──────────

ALTER TABLE public.checkins_archive
  ADD COLUMN IF NOT EXISTS trust_tier SMALLINT NOT NULL DEFAULT 0
    CHECK (trust_tier >= 0 AND trust_tier <= 3);

ALTER TABLE public.checkins_archive
  ADD COLUMN IF NOT EXISTS pass_account_id UUID;
