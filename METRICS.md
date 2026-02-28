# CEG Success Metrics & SLAs

## Availability
- **Target:** 99.9% uptime during active incidents
- **Platform:** Vercel Edge (global CDN) + Supabase PostgreSQL
- **Offline fallback:** All form pages functional offline via Service Worker + IndexedDB

## Performance
- **API P95 response time:** < 500ms
- **Page load (First Contentful Paint):** < 2s on 3G
- **Offline queue flush:** Within 60 seconds of connectivity return

## Capacity
- **Concurrent check-ins:** 10,000 per active incident
- **Rate limits:**
  - General API: 30 req/min/IP
  - Reunification lookup: 5 req/min/IP (anti-stalking)

## Data Retention
- Active incident data: retained during incident
- Medical notes (ems_notes): redacted at 30 days post-close
- GPS coordinates + phone hashes: nulled at 90 days post-close
- Incident metadata: permanent (historical planning)
- AAR snapshots: permanent (materialized before detail deletion)

## Key Metrics to Track
1. **Time-to-first-checkin** — Minutes from incident declaration to first check-in
2. **Accountability rate** — Checkins / expected headcount (%)
3. **Tier 1 response rate** — Critical EMS requests handled within 5 minutes
4. **Reunification lookup volume** — Lookups per incident + repeat-search patterns
5. **Offline queue depth** — Peak queued items + flush success rate
6. **Error rate** — API 5xx responses / total requests (target < 0.1%)
