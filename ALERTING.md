# CEG Alerting Configuration

## Vercel Log Drain Setup

CEG uses structured JSON logging (`lib/logger.ts`) to stdout. Vercel captures these
and they can be forwarded via Log Drain to any aggregation service.

### Log Format
```json
{
  "level": "info|warn|error",
  "event": "checkin_created|ems_created|help_created|reunify_lookup|...",
  "route": "/api/public/checkin",
  "incident_id": "uuid",
  "duration_ms": 42,
  "error": "message (only on error)",
  "timestamp": "2026-02-28T12:00:00.000Z"
}
```

## Alert Rules

### Error Spike
- **Trigger:** `event: *_failed OR event: *_error` count > 5 in 5 minutes
- **Action:** Investigate Supabase connectivity or RLS policy issues
- **Severity:** HIGH

### Rate Limit Abuse
- **Trigger:** HTTP 429 responses > 50 in 5 minutes
- **Action:** Check for automated scraping or DDoS
- **Severity:** MEDIUM

### Stalking Pattern Detection
- **Trigger:** Reunification lookups from same IP > 10 in 10 minutes
- **Action:** Flag IP for LE review in BRASS dashboard
- **Severity:** HIGH

### Offline Queue Depth
- **Trigger:** Queue flush failures > 10 in 30 minutes (from client telemetry)
- **Action:** Check API availability
- **Severity:** MEDIUM

## Setup Instructions

1. In Vercel Dashboard → Project → Settings → Log Drain
2. Add drain endpoint (Datadog, Grafana Cloud, or custom webhook)
3. Configure alert rules in your monitoring platform using the log format above
