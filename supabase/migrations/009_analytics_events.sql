-- Analytics events for CEG page views and interactions
-- Logged from client via /api/analytics, stored in Supabase (free tier)

CREATE TABLE IF NOT EXISTS analytics_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event       text NOT NULL,
  props       jsonb DEFAULT '{}',
  page        text,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for dashboard queries (event type + time range)
CREATE INDEX idx_analytics_event_time ON analytics_events (event, created_at DESC);

-- RLS: anon can INSERT only, no SELECT
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_analytics"
  ON analytics_events FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated_read_analytics"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (true);

-- Retention: auto-delete events older than 90 days (run via pg_cron or manual)
-- SELECT delete_old_analytics();
CREATE OR REPLACE FUNCTION delete_old_analytics()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM analytics_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
