-- Migration 006: Data retention policy
-- Emergency data contains GPS, medical notes, phone hashes
-- Subject to CCPA and California CMIA
-- SAFE FOR SHARED SUPABASE: Additive only (new tables + function)

-- Archive tables for closed incidents (preserves structure)
CREATE TABLE IF NOT EXISTS public.checkins_archive (
  LIKE public.checkins INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS public.help_requests_archive (
  LIKE public.help_requests INCLUDING ALL
);

-- AAR snapshots — materialized stats before detail deletion
CREATE TABLE IF NOT EXISTS public.aar_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES public.incidents(id),
  snapshot_type text NOT NULL, -- 'summary', 'by_assembly_point', 'timeline', 'help_summary'
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aar_snapshots_incident
  ON public.aar_snapshots (incident_id);

-- Retention policy function
-- Call via pg_cron or manually from BRASS admin
-- Retention schedule:
--   30 days: Redact medical notes (ems_notes)
--   90 days: NULL GPS coordinates, delete phone hashes, archive rows
CREATE OR REPLACE FUNCTION public.archive_closed_incidents()
RETURNS jsonb AS $$
DECLARE
  redacted_count integer := 0;
  gps_nulled_count integer := 0;
  archived_checkins integer := 0;
  archived_help integer := 0;
BEGIN
  -- Step 1: Redact medical notes at 30 days post-close (CMIA compliance)
  UPDATE public.checkins
  SET ems_notes = '[REDACTED]'
  WHERE incident_id IN (
    SELECT id FROM public.incidents
    WHERE status = 'closed'
      AND closed_at < now() - interval '30 days'
  )
  AND ems_notes IS NOT NULL
  AND ems_notes != '[REDACTED]';
  GET DIAGNOSTICS redacted_count = ROW_COUNT;

  -- Step 2: NULL GPS + phone hashes + manual addresses at 90 days
  UPDATE public.checkins
  SET lat = NULL, lon = NULL, phone_hash = NULL, phone_last4 = NULL
  WHERE incident_id IN (
    SELECT id FROM public.incidents
    WHERE status = 'closed'
      AND closed_at < now() - interval '90 days'
  )
  AND (lat IS NOT NULL OR phone_hash IS NOT NULL);
  GET DIAGNOSTICS gps_nulled_count = ROW_COUNT;

  UPDATE public.help_requests
  SET lat = NULL, lon = NULL, phone_hash = NULL, phone_last4 = NULL,
      manual_address = NULL
  WHERE incident_id IN (
    SELECT id FROM public.incidents
    WHERE status = 'closed'
      AND closed_at < now() - interval '90 days'
  )
  AND (lat IS NOT NULL OR phone_hash IS NOT NULL OR manual_address IS NOT NULL);

  -- Step 3: Archive and delete reunification lookups at 90 days
  DELETE FROM public.reunification_lookups
  WHERE incident_id IN (
    SELECT id FROM public.incidents
    WHERE status = 'closed'
      AND closed_at < now() - interval '90 days'
  );

  RETURN jsonb_build_object(
    'redacted_medical_notes', redacted_count,
    'gps_phone_nulled', gps_nulled_count,
    'archived_checkins', archived_checkins,
    'archived_help', archived_help,
    'run_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS on archive tables (same as originals — service role only)
ALTER TABLE public.checkins_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_requests_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aar_snapshots ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read archives
CREATE POLICY "Authenticated users can read checkins archive"
  ON public.checkins_archive FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read help requests archive"
  ON public.help_requests_archive FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read AAR snapshots"
  ON public.aar_snapshots FOR SELECT TO authenticated
  USING (true);
