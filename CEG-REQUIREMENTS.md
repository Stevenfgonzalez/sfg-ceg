# CEG — Community Emergency Guide

## What CEG Is

A mobile-first, public-facing emergency dashboard for the Topanga/Malibu/Calabasas region. Zero login required. Three decisions, no cognitive overload. Connects to BRASS for IC zone leaders and enables LE reunification safely.

**URL:** `ceg.sfg.ac`
**Stack:** Next.js 14, Tailwind CSS, Supabase (PostgreSQL + RLS)

---

## Architecture: Two-App System

```
┌──────────────────────────────────────────────────────────────────┐
│                      PUBLIC (ceg.sfg.ac)                         │
│                                                                  │
│  Citizens scan QR / open URL → Check in, find zones, get help   │
│  Zero auth. Supabase ANON key. RLS = INSERT-only.               │
└─────────────────────────┬────────────────────────────────────────┘
                          │ writes to shared Supabase
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                   BRASS (brass-system server)                    │
│                                                                  │
│  IC zone leaders, LE reunification, dispatch, dashboards         │
│  JWT auth. Service role key. Full read access via RBAC.          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Screens & Features

### STATUS: What We Have Now (v0.1) ✅

| Feature | Status | Route |
|---------|--------|-------|
| Home screen (3 action buttons + resource links) | ✅ Done | `/` |
| Find Safe Zone (22 zones, GPS nearest, filters, directions) | ✅ Done | `/` (screen) |
| I Need Help (EMS→911, Stuck, Shelter) | ✅ Done | `/` (screen) |
| Check In Safe (QR-based, 3 statuses) | ✅ Done | `/checkin` |
| Public Check-In API | ✅ Done | `/api/public/checkin` |
| Reunification Lookup API | ✅ Done | `/api/public/reunification` |
| 22 Safe Zones with data | ✅ Done | `app/data/safe-zones.ts` |
| Dark theme, mobile-first | ✅ Done | |

---

### PHASE 2: Full Check-In System

**Expand `/checkin` with richer data capture:**

| Feature | Description |
|---------|-------------|
| **7 Check-In Statuses** | SAFE, EVACUATING, AT_MUSTER, SHELTERING_HERE, NEED_HELP, NEED_MEDICAL, LOOKING_FOR_SOMEONE |
| **Party Composition** | Adults, children, elderly, special needs counts |
| **Pet/Animal Tracking** | Dog, cat, horse, bird, other — with counts |
| **Dependent Details** | Name, age, medical notes per dependent |
| **Transport Needs** | Vehicle, no vehicle, mobility limitation |
| **Location Capture** | Auto-GPS with manual address fallback |
| **Offline Queue** | IndexedDB outbox → auto-flush every 15s |
| **QR Token Validation** | Incident-specific QR codes with expiry |

**Database (already migrated):**
- `households` — family unit with member/animal counts
- `household_dependents` — individual members with age/medical
- `household_animals` — pet tracking
- `checkins` — check-in events with 7 statuses
- `incident_qr_tokens` — QR code auth tokens

---

### PHASE 3: EMS Complaint Triage

**Route:** `/ems` (new page)
**Philosophy:** "The system triages. The patient just describes."

**Two-step flow:**
1. **Your Info** — Name, phone (for medic callback), party size, GPS location
2. **What's Wrong?** — Pick from 13 complaint types (user never sees tier labels)

**13 Complaint Categories:**

| Complaint | Icon | Tier | Auto-Action |
|-----------|------|------|-------------|
| Chest Pain / Pressure | 💔 | 1-CRITICAL | Auto-dial 911 |
| Difficulty Breathing | 😮‍💨 | 1-CRITICAL | Auto-dial 911 |
| Someone Is Unresponsive | 🚨 | 1-CRITICAL | Auto-dial 911 |
| Heavy Bleeding / Won't Stop | 🩸 | 1-CRITICAL | Auto-dial 911 |
| Severe Allergic Reaction | ⚠️ | 1-CRITICAL | Auto-dial 911 |
| Diabetic Emergency | 🍬 | 1-CRITICAL | Auto-dial 911 |
| Burns | 🔥 | 1-CRITICAL | Auto-dial 911 |
| Asthma — Have Inhaler | 🌬️ | 2-MINOR | Dispatch callback queue |
| Twisted Ankle / Can't Walk | 🦶 | 2-MINOR | Dispatch callback queue |
| Need Medication Refill | 💊 | 2-MINOR | Dispatch callback queue |
| Anxiety / Panic | 😰 | 2-MINOR | Dispatch callback queue |
| Cut or Scrape | 🩹 | 2-MINOR | Dispatch callback queue |
| Something Else | 📋 | 2-MINOR | Free text + callback |

**Confirmation screens:**
- **Tier 1:** Pulsing phone animation → "CALLING 911 NOW" → CERT card for offline handoff
- **Tier 2:** "YOU'RE CHECKED IN" → "A medic or dispatcher may call you"

---

### PHASE 4: Shelter-in-Place Pin

**Route:** `/shelter` (new page)

| Feature | Description |
|---------|-------------|
| GPS pin | Auto-capture current location |
| Manual address | Fallback if GPS unavailable |
| Party size | 1, 2, 3, 4+ buttons |
| Mobility indicator | "Can move" or "Limited mobility" |
| Notes field | Optional message to responders |
| Status | Sends `SHELTERING_HERE` to check-in API |

---

### PHASE 5: Reunification Portal

**Route:** `/reunification` (expand existing API into full page)

**Three-Layer Privacy Model:**

| Layer | Who | What They See |
|-------|-----|---------------|
| **Public** | Anyone | FOUND_SAFE / FOUND_HELP / NOT_FOUND (zero PII) |
| **IC/Zone Leader** | Authenticated IC | Zone totals, help queues, household flags, search patterns |
| **LE Reunification** | Law enforcement | Full PII for active cases, missing person cross-ref |

**Public flow:**
1. Enter phone number of person you're looking for
2. Phone is hashed client-side before submission
3. Returns one of 3 fixed messages (never raw data)
4. Rate limited: 5 lookups/minute per IP
5. All lookups audited for pattern detection

**IC/LE Dashboard (served from BRASS, not CEG):**
- `ic_reunification_data()` RPC — 100 most recent lookups, repeat-search patterns, NOT_FOUND cross-reference
- Identifies anxious family (repeat searches) and potential missing persons (NOT_FOUND patterns)

---

### PHASE 6: Household Pre-Planning

**Route:** `/household` (new page)

| Feature | Description |
|---------|-------------|
| **Member Registration** | Adults, children, elderly, special needs |
| **AFN Flags** | Additional Functional Needs (medical, mobility, sensory) |
| **Pet Inventory** | Dogs, cats, horses, birds, other with counts |
| **Go-Bag Checklist** | Auto-generated based on household composition |
| **Emergency Vault** | Document storage (insurance, medical records, photos) |
| **Grab Locations** | Where important items are stored in the house |

**Smart checklist generation:**
- Medical needs → medication list, equipment
- Children → age-appropriate supplies
- Pets → carriers, food, vaccination records
- Mobility equipment → wheelchair, walker, oxygen
- Priority tiers: essentials → important → nice-to-have

---

### PHASE 7: Stuck/Evacuation Assistance

**Expand "Stuck / Can't Evacuate" into detailed form:**

| Field | Options |
|-------|---------|
| Reason | Traffic 🚗, Road blocked 🚧, No vehicle 🚫, Mobility limitation ♿, Other 📍 |
| Location | GPS + manual address |
| Vehicle description | Make, color, license plate (optional) |
| People count | How many people with you |
| Notes | Additional details for responders |
| Status | Sends `NEED_HELP` or `EVAC_ASSISTANCE_NEEDED` |

---

## BRASS Integration: Operator Roles (RBAC)

Three tiers of access to CEG data from the BRASS side:

### zone_lead (Operational Counts)
- Scoped to assigned zones only
- `GET /api/brass/zones/my-summary` — Zone counts (no PII)
- `GET /api/brass/zones/feed` — Check-in feed without names/phones
- Sees: occupancy, help count, medical count, capacity %

### ic_ops (Incident Commander — All Zones)
- Full zone access, household-level flags
- `GET /api/brass/ops/all-zones` — All zone summaries
- `GET /api/brass/ops/household-flags` — Household codes + expected vs accounted + AFN flags
- `GET /api/brass/ops/household/:code` — Names + roles (no contact info)

### le_reunification (Law Enforcement — Full PII)
- Full PII access for active reunification
- `GET /api/brass/reunification/lookup?phoneHash=` — Full records with contact
- `GET /api/brass/reunification/household/:code` — Full household PII
- `GET /api/brass/reunification/missing-crossref` — NOT_FOUND → missing person leads
- Audit-logged, time-scoped to active incidents only

---

## Security & Privacy

| Layer | Enforcement |
|-------|------------|
| Phone hashing | Raw phone numbers never stored — SHA-256 hash only |
| RLS (Row Level Security) | Database enforces role-based access at query level |
| Public = INSERT-only | Anon key cannot SELECT, UPDATE, or DELETE |
| Rate limiting | 5 lookups/min per IP on reunification |
| Audit trail | All reunification lookups logged with IP + timestamp |
| JWT auth | BRASS operators use 8-hour HS256 tokens |
| PII isolation | Only `le_reunification` role can access contact info |

---

## Event Model

All submissions create immutable events:

```typescript
{
  eventId: string;        // UUID
  incidentId: string;     // "DEFAULT" or specific incident
  timestamp: number;      // ms epoch
  method: "QR_WEB" | "LORA_PASS" | "MANUAL";
  confidence: "VERIFIED" | "LIKELY" | "MEDIUM" | "UNKNOWN";
  subject: {
    subjectType: "PHONE_SUBMISSION" | "DEVICE";
    submissionId: string;
  };
}
```

**Event types:**
- `EVAC_CHECKIN` — Status check-in (7 statuses)
- `EMS_REQUEST` — Medical complaint (13 types, auto-tiered)
- `EVAC_ASSISTANCE_NEEDED` — Stuck/can't evacuate
- `SHELTER_IN_PLACE` — Location pin with party info

---

## External Resource Links

| Resource | URL | Purpose |
|----------|-----|---------|
| Watch Duty | watchduty.org | Live fire map |
| Alert LA | alert.la | County emergency alerts |
| Genasys | genasys.com/zonehaven | Evacuation zone lookup |
| QuickMap | quickmap.dot.ca.gov | Road closures |
| Red Cross | redcross.org/find-open-shelter | Open shelters |
| LA County | lacounty.gov/emergency | Emergency info |

---

## Implementation Priority

```
Phase 1 ✅  Landing page + basic check-in + safe zones
Phase 2     Full check-in (7 statuses, party, pets, offline queue)
Phase 3     EMS complaint triage (13 types, auto-911)
Phase 4     Shelter-in-place pin page
Phase 5     Reunification portal page
Phase 6     Household pre-planning + go-bag
Phase 7     Stuck/evacuation assistance form
```

---

## Database Migrations (Already Exist in Supabase)

| Migration | What |
|-----------|------|
| 001_initial_schema | Core tables: jurisdictions, incidents, zones, schools, profiles, households, dependents, animals, checkins, QR tokens |
| 005_reunification | Public lookup function, rate limiting, audit table |
| 008_ic_reunification_rpc | IC/LE reunification data access functions |
| 010_go_bag_vault | Go-bag checklists, emergency vault items |
| 011_self_checkin | Self-service check-in without QR |
| 012_brass_users | BRASS operator auth, RBAC roles |
| 013_help_requests | Help request tracking and dispatch |

---

## Source Files (BRASS Reference Implementation)

| File | Lines | What to Port |
|------|-------|-------------|
| `brass-system/client/src/pages/ceg.tsx` | 1,796 | Main home + all sub-flows |
| `brass-system/client/src/pages/ceg-map.tsx` | 543 | Map view (skip — use external links) |
| `brass-system/client/src/pages/ceg-checkin.tsx` | 859 | Full QR check-in form |
| `brass-system/client/src/pages/ceg-ems.tsx` | 511 | EMS complaint form |
| `brass-system/client/src/pages/ceg-shelter.tsx` | 434 | Shelter-in-place form |
| `brass-system/shared/muster-safe-zones.ts` | 577 | Zone data (already ported) |
| `brass-system/server/evac-routes.ts` | 1,001 | API endpoints |
| `sfg-ceg/supabase/migrations/*` | ~150KB | Database schema (already migrated) |
