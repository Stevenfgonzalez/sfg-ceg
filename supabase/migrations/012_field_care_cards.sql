-- ============================================
-- SFG Field Care Card (FCC) Schema
-- v1: Household profiles for EMS access
-- ============================================

-- =====================
-- HOUSEHOLDS
-- =====================
create table public.fcc_households (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references auth.users(id) on delete cascade,
  name            text        not null,                               -- "Delgado Household"
  address_line1   text        not null,
  address_line2   text,
  city            text        not null,
  state           text        not null,
  zip             text        not null,
  access_code     text        not null,                               -- 4-digit resident code, hashed
  best_door       text,                                               -- "Front door — faces PCH, blue awning"
  gate_code       text,
  animals         text,
  stair_info      text,
  hazards         text,                                               -- "Oxygen in use — no open flame"
  aed_onsite      boolean     not null default false,
  backup_power    text,
  member_count    integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =====================
-- MEMBERS
-- =====================
create table public.fcc_members (
  id                  uuid        primary key default gen_random_uuid(),
  household_id        uuid        not null references public.fcc_households(id) on delete cascade,
  full_name           text        not null,
  date_of_birth       date        not null,
  photo_url           text,
  baseline_mental     text,                                           -- "A&O x4, mild hearing loss R ear"
  primary_language    text        not null default 'English',
  code_status         text        not null check (code_status in ('full_code', 'dnr', 'dnr_polst')),
  directive_location  text,                                           -- "Filed with Dr. Patel, copy in kitchen drawer"
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- =====================
-- MEMBER CLINICAL (EMS Snapshot)
-- =====================
create table public.fcc_member_clinical (
  member_id           uuid        primary key references public.fcc_members(id) on delete cascade,

  -- Critical Flags (Red Banner) — JSONB array
  -- Each: { "flag": "Sulfa allergy — anaphylaxis", "type": "allergy" }
  -- Types: allergy, med, equipment, safety
  critical_flags      jsonb       not null default '[]'::jsonb,

  -- Medications — JSONB array
  -- Each: { "name": "Eliquis", "dose": "5mg", "freq": "BID", "last_dose": "2200 last night" }
  medications         jsonb       not null default '[]'::jsonb,

  -- History — JSONB array of strings
  -- Each: "CHF", "COPD", "T2DM"
  history             jsonb       not null default '[]'::jsonb,

  -- Mobility
  mobility_status     text,                                           -- "Ambulatory w/ rolling walker"
  lift_method         text,                                           -- "1-person standby assist, can bear weight"
  precautions         text,                                           -- "L hip — no internal rotation past 90°"
  pain_notes          text,
  stair_chair_needed  boolean     not null default false,

  -- Equipment — JSONB array
  -- Each: { "item": "O2 concentrator", "location": "Bedroom, beside bed" }
  equipment           jsonb       not null default '[]'::jsonb,

  -- Life Needs — JSONB array of strings
  -- Each: "Hard of hearing R side — speak to L"
  life_needs          jsonb       not null default '[]'::jsonb,

  updated_at          timestamptz not null default now()
);

-- =====================
-- EMERGENCY CONTACTS
-- =====================
create table public.fcc_emergency_contacts (
  id              uuid        primary key default gen_random_uuid(),
  household_id    uuid        not null references public.fcc_households(id) on delete cascade,
  name            text        not null,
  relation        text        not null,
  phone           text        not null,
  sort_order      integer     not null default 0
);

-- =====================
-- ACCESS LOGS
-- =====================
create table public.fcc_access_logs (
  id              uuid        primary key default gen_random_uuid(),
  household_id    uuid        not null references public.fcc_households(id) on delete cascade,
  access_method   text        not null check (access_method in ('resident_code', 'incident_number', 'pcr_number')),
  access_value    text        not null,                               -- incident/PCR number (resident code NOT logged)
  agency_code     text,                                               -- pilot agency identifier
  session_token   text        not null,
  accessed_at     timestamptz not null default now(),
  expires_at      timestamptz not null,
  ip_address      inet,
  user_agent      text,
  members_viewed  jsonb       not null default '[]'::jsonb            -- array of member IDs viewed
);

-- =====================
-- INDEXES
-- =====================
create index idx_fcc_households_owner on public.fcc_households(owner_id);
create index idx_fcc_members_household on public.fcc_members(household_id);
create index idx_fcc_contacts_household on public.fcc_emergency_contacts(household_id);
create index idx_fcc_access_logs_household on public.fcc_access_logs(household_id);
create index idx_fcc_access_logs_accessed_at on public.fcc_access_logs(accessed_at desc);

-- =====================
-- AUTO-UPDATE updated_at
-- =====================
create or replace function public.fcc_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_fcc_households_updated
  before update on public.fcc_households
  for each row execute function public.fcc_set_updated_at();

create trigger trg_fcc_members_updated
  before update on public.fcc_members
  for each row execute function public.fcc_set_updated_at();

create trigger trg_fcc_member_clinical_updated
  before update on public.fcc_member_clinical
  for each row execute function public.fcc_set_updated_at();

-- =====================
-- ROW LEVEL SECURITY
-- =====================

-- Households: owner full CRUD, public can read limited fields via API
alter table public.fcc_households enable row level security;

create policy "fcc_households_owner_all"
  on public.fcc_households for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "fcc_households_public_select"
  on public.fcc_households for select
  using (true);

-- Members: owner only (EMS access via service role + session token)
alter table public.fcc_members enable row level security;

create policy "fcc_members_owner_all"
  on public.fcc_members for all
  using (household_id in (select id from public.fcc_households where owner_id = auth.uid()))
  with check (household_id in (select id from public.fcc_households where owner_id = auth.uid()));

-- Member clinical: owner only
alter table public.fcc_member_clinical enable row level security;

create policy "fcc_member_clinical_owner_all"
  on public.fcc_member_clinical for all
  using (member_id in (
    select m.id from public.fcc_members m
    join public.fcc_households h on m.household_id = h.id
    where h.owner_id = auth.uid()
  ))
  with check (member_id in (
    select m.id from public.fcc_members m
    join public.fcc_households h on m.household_id = h.id
    where h.owner_id = auth.uid()
  ));

-- Emergency contacts: owner only
alter table public.fcc_emergency_contacts enable row level security;

create policy "fcc_contacts_owner_all"
  on public.fcc_emergency_contacts for all
  using (household_id in (select id from public.fcc_households where owner_id = auth.uid()))
  with check (household_id in (select id from public.fcc_households where owner_id = auth.uid()));

-- Access logs: owner can read, service role inserts (via API)
alter table public.fcc_access_logs enable row level security;

create policy "fcc_access_logs_owner_select"
  on public.fcc_access_logs for select
  using (household_id in (select id from public.fcc_households where owner_id = auth.uid()));

create policy "fcc_access_logs_service_insert"
  on public.fcc_access_logs for insert
  with check (true);

-- =====================
-- MEMBER COUNT TRIGGER
-- =====================
create or replace function public.fcc_update_member_count()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    update public.fcc_households
    set member_count = (select count(*) from public.fcc_members where household_id = old.household_id)
    where id = old.household_id;
    return old;
  else
    update public.fcc_households
    set member_count = (select count(*) from public.fcc_members where household_id = new.household_id)
    where id = new.household_id;
    return new;
  end if;
end;
$$ language plpgsql security definer;

create trigger trg_fcc_member_count
  after insert or delete on public.fcc_members
  for each row execute function public.fcc_update_member_count();
