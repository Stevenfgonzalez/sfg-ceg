-- Temporary access codes for FCC — requested by household owner, sent via SMS
CREATE TABLE IF NOT EXISTS fcc_temp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES fcc_households(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  requested_by UUID REFERENCES auth.users(id),
  requested_phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL
);

-- Fast lookup for valid (unused, unexpired) codes
CREATE INDEX IF NOT EXISTS idx_fcc_temp_codes_lookup
  ON fcc_temp_codes(household_id, code) WHERE used_at IS NULL;

ALTER TABLE fcc_temp_codes ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (API routes use service client for public EMS access)
CREATE POLICY "service_role_all" ON fcc_temp_codes FOR ALL USING (true);
