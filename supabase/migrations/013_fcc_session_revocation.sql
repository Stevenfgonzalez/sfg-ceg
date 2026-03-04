-- FCC session revocation: allow household owners to revoke active EMS sessions
ALTER TABLE fcc_access_logs ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE fcc_access_logs ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Index for finding active (non-revoked) sessions per household
CREATE INDEX IF NOT EXISTS idx_fcc_access_logs_active
  ON fcc_access_logs(household_id, expires_at DESC) WHERE revoked_at IS NULL;
