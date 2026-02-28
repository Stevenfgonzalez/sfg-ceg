-- Migration 004: Phone hash versioning
-- Supports dual-version hashing for HMAC-SHA256 migration
-- v1 = legacy unsalted SHA-256, v2 = HMAC-SHA256 with server-side secret
--
-- SAFE FOR SHARED SUPABASE: Additive only, no drops, no renames
-- BRASS and MCI continue to work — new column has DEFAULT value

-- Add hash version to checkins (default 1 = legacy)
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS phone_hash_v integer NOT NULL DEFAULT 1;

-- Add hash version to help_requests
ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS phone_hash_v integer NOT NULL DEFAULT 1;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('checkins', 'help_requests')
  AND column_name = 'phone_hash_v';
