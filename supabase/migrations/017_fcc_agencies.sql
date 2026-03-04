-- Migration 017: FCC Agencies
-- Agencies table for fire departments / EMS organizations to view their access history

CREATE TABLE fcc_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on agency_code in access logs for dashboard queries
CREATE INDEX idx_fcc_access_logs_agency_code ON fcc_access_logs (agency_code) WHERE agency_code IS NOT NULL;

-- RLS: public read, service role write
ALTER TABLE fcc_agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcc_agencies_public_read" ON fcc_agencies
  FOR SELECT TO public
  USING (true);
