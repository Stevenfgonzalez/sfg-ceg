-- Migration 005: Composite and partial indexes for performance
-- SAFE FOR SHARED SUPABASE: All IF NOT EXISTS, additive only

-- Partial index on active incidents — speeds up RLS subquery on every INSERT
CREATE INDEX IF NOT EXISTS idx_incidents_active_id
  ON public.incidents (id) WHERE status = 'active';

-- Help request dispatch queue — Tier 1 (critical) items first
CREATE INDEX IF NOT EXISTS idx_help_requests_open_tier1
  ON public.help_requests (incident_id, created_at)
  WHERE triage_tier = 1 AND status = 'NEW';

-- Help request dispatch by tier + status for dispatcher dashboard
CREATE INDEX IF NOT EXISTS idx_help_requests_dispatch
  ON public.help_requests (triage_tier, status, created_at);

-- Phone hash lookup for reunification (covers both v1 and v2 hashes)
CREATE INDEX IF NOT EXISTS idx_checkins_phone_hash_v2
  ON public.checkins (phone_hash) WHERE phone_hash IS NOT NULL;

-- Composite for incident + status queries (AAR breakdown)
CREATE INDEX IF NOT EXISTS idx_checkins_incident_status
  ON public.checkins (incident_id, status);

-- Verify
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
