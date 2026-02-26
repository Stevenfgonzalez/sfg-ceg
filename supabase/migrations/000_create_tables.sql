-- ============================================
-- SFG Incident Check-In Schema
-- Optimized for AAR metrics extraction
-- ============================================

-- =====================
-- INCIDENTS
-- =====================
create table public.incidents (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,                                       -- "Spring Drill 2026", "Bldg-A Fire Alarm"
  type          text        not null check (type in ('drill', 'real')),
  status        text        not null default 'active'
                            check (status in ('active', 'closed')),
  declared_at   timestamptz not null default now(),                         -- AAR: t=0 for all timing metrics
  closed_at     timestamptz,                                               -- AAR: total incident duration
  expected_headcount  integer,                                              -- AAR: denominator for % accountability
  location      text,                                                       -- site / building / campus
  notes         text,
  created_at    timestamptz not null default now()
);

-- =====================
-- CHECKINS
-- =====================
create table public.checkins (
  id              uuid        primary key default gen_random_uuid(),
  incident_id     uuid        not null references public.incidents(id),

  -- Identity (no account required for QR check-in)
  full_name       text        not null,
  phone_hash      text,                                                     -- SHA-256 of normalized phone (reunification lookup)
  phone_last4     text,                                                     -- last 4 digits for IC human verification

  -- Triage status
  status          text        not null
                              check (status in ('SAFE', 'SIP', 'NEED_EMS')),

  -- Location
  assembly_point  text,                                                     -- which muster point
  zone            text,                                                     -- building wing / floor / sector

  -- AAR timing (this is the critical field)
  checked_in_at   timestamptz not null default now(),

  -- Group / family reunification
  party_size      integer     not null default 1,                           -- headcount including self
  has_dependents  boolean     not null default false,
  dependent_names text[],                                                   -- reunification roster

  -- EMS detail
  needs_transport boolean     not null default false,
  ems_notes       text,                                                     -- injury type, mobility, meds

  -- Context
  department      text,                                                     -- HR, Ops, Maintenance, Visitor
  role            text        check (role in ('staff', 'visitor',
                              'contractor', 'student', 'resident')),

  notes           text,
  created_at      timestamptz not null default now()
);

-- =====================
-- INDEXES (AAR query performance)
-- =====================

-- Per-incident lookups (every AAR query filters on this)
create index idx_checkins_incident    on public.checkins (incident_id);

-- Time-series: "check-ins over time" chart
create index idx_checkins_time        on public.checkins (incident_id, checked_in_at);

-- EMS triage filter: "show me all NEED_EMS rows"
create index idx_checkins_status      on public.checkins (incident_id, status);

-- Assembly point breakdown
create index idx_checkins_assembly    on public.checkins (incident_id, assembly_point);

-- Reunification lookup (phone hash + incident)
create index idx_checkins_reunification on public.checkins (incident_id, phone_hash);

-- Active incident lookup (for RLS hardening policy)
create index idx_incidents_status     on public.incidents (status);

-- =====================
-- REUNIFICATION AUDIT LOG
-- =====================
create table public.reunification_lookups (
  id            uuid        primary key default gen_random_uuid(),
  incident_id   uuid        not null references public.incidents(id),
  phone_hash    text        not null,
  found         boolean     not null,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index idx_lookups_rate_limit   on public.reunification_lookups (ip_address, created_at);
create index idx_lookups_incident     on public.reunification_lookups (incident_id, created_at);

-- =====================
-- AAR VIEWS
-- =====================

-- Per-incident summary: one row per incident with key AAR numbers
create view public.v_aar_summary as
select
  i.id                                          as incident_id,
  i.name                                        as incident_name,
  i.type,
  i.declared_at,
  i.closed_at,
  i.expected_headcount,

  -- Accountability
  count(c.id)                                   as total_checkins,
  sum(c.party_size)                             as total_headcount,

  -- Status breakdown
  count(*) filter (where c.status = 'SAFE')     as safe_count,
  count(*) filter (where c.status = 'SIP')      as sip_count,
  count(*) filter (where c.status = 'NEED_EMS') as ems_count,

  -- EMS
  count(*) filter (where c.needs_transport)     as transport_needed,
  sum(c.party_size) filter (where c.has_dependents) as dependents_headcount,

  -- Timing
  min(c.checked_in_at) - i.declared_at          as time_to_first_checkin,
  max(c.checked_in_at) - i.declared_at          as time_to_last_checkin,
  avg(c.checked_in_at - i.declared_at)          as avg_response_time,

  -- Duration
  i.closed_at - i.declared_at                   as total_duration

from public.incidents i
left join public.checkins c on c.incident_id = i.id
group by i.id;

-- Per-assembly-point breakdown: where did people go?
create view public.v_aar_by_assembly_point as
select
  c.incident_id,
  c.assembly_point,
  count(*)                                      as checkin_count,
  sum(c.party_size)                             as headcount,
  count(*) filter (where c.status = 'NEED_EMS') as ems_count,
  min(c.checked_in_at)                          as first_arrival,
  max(c.checked_in_at)                          as last_arrival
from public.checkins c
group by c.incident_id, c.assembly_point;

-- Timeline: check-ins bucketed in 1-minute intervals for response curve
create view public.v_aar_timeline as
select
  c.incident_id,
  date_trunc('minute', c.checked_in_at)         as minute_bucket,
  count(*)                                      as checkins_this_minute,
  sum(count(*)) over (
    partition by c.incident_id
    order by date_trunc('minute', c.checked_in_at)
  )                                             as cumulative_checkins
from public.checkins c
group by c.incident_id, date_trunc('minute', c.checked_in_at);
