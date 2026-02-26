-- ============================================
-- Phase 4-5: Help Requests + Reunification Requests
-- ============================================

-- =====================
-- HELP REQUESTS (Triage System)
-- =====================
-- Separate from checkins: triage events with complaint codes and tier classification.
-- Tier 1: life-threat (caller dials 911, row gives IC a count)
-- Tier 2: callback queue (dispatcher assigns and resolves)
-- Tier 3: info-only (guidance, self-serve, optional logging)

CREATE TABLE public.help_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     uuid        NOT NULL REFERENCES public.incidents(id),

  -- Complaint classification
  complaint_code  text        NOT NULL,
  complaint_label text,
  triage_tier     integer     NOT NULL CHECK (triage_tier IN (1, 2, 3)),

  -- Dispatch
  dispatch_note   text,
  status          text        NOT NULL DEFAULT 'NEW'
                              CHECK (status IN ('NEW', 'ASSIGNED', 'RESOLVED', 'INFO_ONLY')),

  -- Caller info
  caller_name     text,
  phone_hash      text,
  phone_last4     text,
  party_size      integer     NOT NULL DEFAULT 1,

  -- Location
  assembly_point  text,
  lat             double precision,
  lon             double precision,
  manual_address  text,

  -- Free-text (capped at 200 chars in UI)
  other_text      text,

  -- Dispatcher fields (updated by BRASS-side)
  assigned_to     text,
  assigned_at     timestamptz,
  resolved_at     timestamptz,
  resolution_note text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Dispatcher queue: Tier 2 callbacks needing attention
CREATE INDEX idx_help_requests_queue
  ON public.help_requests (incident_id, triage_tier, status)
  WHERE status IN ('NEW', 'ASSIGNED');

-- IC dashboard: tier counts per incident
CREATE INDEX idx_help_requests_incident
  ON public.help_requests (incident_id, created_at);

-- Assembly point drill-down
CREATE INDEX idx_help_requests_assembly
  ON public.help_requests (incident_id, assembly_point);

-- =====================
-- HELP REQUESTS RLS
-- =====================
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

-- Public can INSERT help requests (anon key)
CREATE POLICY help_requests_insert_public
  ON public.help_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incidents
      WHERE id = incident_id AND status = 'active'
    )
  );

-- Service role can read/update (BRASS dispatchers)
-- No explicit policy needed — service role bypasses RLS

-- =====================
-- REUNIFICATION REQUESTS
-- =====================
-- "I'm looking for someone" submissions from public.
-- BRASS LE reunification view reads these.

CREATE TABLE public.reunification_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     uuid        NOT NULL REFERENCES public.incidents(id),

  -- Who they're looking for
  sought_phone_hash text,
  sought_name       text,

  -- Requester contact info
  requester_phone_hash text,
  requester_phone_last4 text,
  requester_name    text,
  relationship      text,

  -- Status (managed by BRASS LE view)
  status          text        NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING', 'MATCHED', 'CONTACTED', 'RESOLVED')),

  -- Audit
  ip_address      text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reunification_requests_incident
  ON public.reunification_requests (incident_id, status);

CREATE INDEX idx_reunification_requests_sought
  ON public.reunification_requests (incident_id, sought_phone_hash);

-- =====================
-- REUNIFICATION REQUESTS RLS
-- =====================
ALTER TABLE public.reunification_requests ENABLE ROW LEVEL SECURITY;

-- Public can INSERT reunification requests (anon key)
CREATE POLICY reunification_requests_insert_public
  ON public.reunification_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incidents
      WHERE id = incident_id AND status = 'active'
    )
  );

-- =====================
-- AAR VIEW: Help request summary
-- =====================
CREATE VIEW public.v_aar_help_summary AS
SELECT
  h.incident_id,
  h.triage_tier,
  h.complaint_code,
  COUNT(*)                                           AS request_count,
  COUNT(*) FILTER (WHERE h.status = 'RESOLVED')     AS resolved_count,
  AVG(h.resolved_at - h.created_at)
    FILTER (WHERE h.resolved_at IS NOT NULL)         AS avg_resolution_time
FROM public.help_requests h
GROUP BY h.incident_id, h.triage_tier, h.complaint_code;
