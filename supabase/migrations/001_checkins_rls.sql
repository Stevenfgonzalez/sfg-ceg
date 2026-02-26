-- ============================================
-- RLS Policies for public.checkins
-- Run AFTER the checkins table exists
-- ============================================

-- 1. Enable RLS
alter table public.checkins enable row level security;

-- 2. Revoke default open access
revoke all on public.checkins from anon;
revoke all on public.checkins from authenticated;

-- 3. Grant insert permission to anon (required for policy to work)
grant insert on public.checkins to anon;

-- 4. Public INSERT-only policy (QR check-in, active incidents only)
create policy "Public can insert checkins"
on public.checkins
for insert
to anon
with check (
  exists (
    select 1 from public.incidents i
    where i.id = incident_id
    and i.status = 'active'
  )
);

-- 5. Explicit deny on reads for anon (defense in depth)
create policy "No public select"
on public.checkins
for select
to anon
using (false);

-- 6. Grant select to authenticated (for IC dashboard if using Supabase Auth)
grant select on public.checkins to authenticated;

create policy "IC users can read checkins"
on public.checkins
for select
to authenticated
using (true);

-- 7. Incidents table: RLS + read grant for anon (needed by insert policy subquery)
alter table public.incidents enable row level security;

revoke all on public.incidents from anon;
grant select on public.incidents to anon;

create policy "Anon can read active incidents"
on public.incidents
for select
to anon
using (status = 'active');

grant all on public.incidents to authenticated;

create policy "Authenticated full access to incidents"
on public.incidents
for all
to authenticated
using (true)
with check (true);

-- 8. Reunification audit log: RLS
alter table public.reunification_lookups enable row level security;

revoke all on public.reunification_lookups from anon;
revoke all on public.reunification_lookups from authenticated;

-- Service role inserts audit entries (via API route), not anon directly
-- Anon gets no access at all
create policy "No anon access to lookup log"
on public.reunification_lookups
for select
to anon
using (false);

-- IC can read the audit trail
grant select on public.reunification_lookups to authenticated;

create policy "IC can read lookup log"
on public.reunification_lookups
for select
to authenticated
using (true);

-- ============================================
-- VERIFY: Run after applying
-- select * from pg_policies where tablename = 'checkins';
-- select * from pg_policies where tablename = 'incidents';
-- select * from pg_policies where tablename = 'reunification_lookups';
-- ============================================
