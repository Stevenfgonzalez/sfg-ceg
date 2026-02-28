-- Migration 007: Restricted view for incidents table
-- The anon SELECT on incidents is intentional (needed for RLS INSERT subquery)
-- This view documents that and exposes only id + status to anon
-- SAFE FOR SHARED SUPABASE: Additive only

CREATE OR REPLACE VIEW public.v_active_incidents AS
SELECT id, status FROM public.incidents WHERE status = 'active';

GRANT SELECT ON public.v_active_incidents TO anon;

COMMENT ON VIEW public.v_active_incidents IS
  'Restricted view for anon access. Exposes only id and status of active incidents. '
  'The full incidents table anon SELECT is needed for RLS INSERT policy subqueries.';
