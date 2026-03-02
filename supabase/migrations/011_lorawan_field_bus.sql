-- LoRaWAN Field Message Bus — CEG Cloud Tables
-- Additive-only migration for SFG-Evac-Core (shared with BRASS/MCI)
-- CEG only needs the lorawan_events table for edge-synced check-ins.
-- The core lorawan_* tables are created by BRASS migration 0005.
-- This migration is a no-op if the tables already exist (IF NOT EXISTS).

-- Ensure the lorawan_events table exists (idempotent)
CREATE TABLE IF NOT EXISTS lorawan_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT UNIQUE NOT NULL,
  event_type      TEXT NOT NULL,
  system          TEXT NOT NULL,
  fport           INTEGER,
  dev_eui         TEXT,
  zone_id         TEXT,
  payload         JSONB NOT NULL,
  source          TEXT NOT NULL DEFAULT 'lora',
  edge_node_id    TEXT,
  rssi            INTEGER,
  snr             REAL,
  gateway_id      TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
