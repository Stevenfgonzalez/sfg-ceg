-- Migration 016: FCC Caregiver Sharing
-- Allows household owners to invite caregivers (viewer/editor) to manage FCC profiles

CREATE TABLE fcc_caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES fcc_households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  user_id UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique invite per email per household
CREATE UNIQUE INDEX idx_fcc_caregivers_household_email ON fcc_caregivers (household_id, lower(email));

-- RLS on fcc_caregivers
ALTER TABLE fcc_caregivers ENABLE ROW LEVEL SECURITY;

-- Owner can see and manage caregivers for their household
CREATE POLICY "fcc_caregivers_owner_select" ON fcc_caregivers
  FOR SELECT TO authenticated
  USING (household_id IN (SELECT id FROM fcc_households WHERE owner_id = auth.uid()));

CREATE POLICY "fcc_caregivers_owner_insert" ON fcc_caregivers
  FOR INSERT TO authenticated
  WITH CHECK (household_id IN (SELECT id FROM fcc_households WHERE owner_id = auth.uid()));

CREATE POLICY "fcc_caregivers_owner_update" ON fcc_caregivers
  FOR UPDATE TO authenticated
  USING (household_id IN (SELECT id FROM fcc_households WHERE owner_id = auth.uid()));

CREATE POLICY "fcc_caregivers_owner_delete" ON fcc_caregivers
  FOR DELETE TO authenticated
  USING (household_id IN (SELECT id FROM fcc_households WHERE owner_id = auth.uid()));

-- Invitee can see their own pending invite (by email match or user_id match)
CREATE POLICY "fcc_caregivers_invitee_select" ON fcc_caregivers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Invitee can accept (update user_id and accepted_at)
CREATE POLICY "fcc_caregivers_invitee_accept" ON fcc_caregivers
  FOR UPDATE TO authenticated
  USING (
    lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND accepted_at IS NULL
  );

-- Caregiver RLS on existing tables (additive policies)

-- fcc_households: caregiver select
CREATE POLICY "fcc_households_caregiver_select" ON fcc_households
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT household_id FROM fcc_caregivers
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  ));

-- fcc_members: caregiver select (viewer+editor)
CREATE POLICY "fcc_members_caregiver_select" ON fcc_members
  FOR SELECT TO authenticated
  USING (household_id IN (
    SELECT household_id FROM fcc_caregivers
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  ));

-- fcc_members: caregiver write (editor only)
CREATE POLICY "fcc_members_caregiver_write" ON fcc_members
  FOR ALL TO authenticated
  USING (household_id IN (
    SELECT household_id FROM fcc_caregivers
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL AND role = 'editor'
  ));

-- fcc_member_clinical: caregiver select
CREATE POLICY "fcc_clinical_caregiver_select" ON fcc_member_clinical
  FOR SELECT TO authenticated
  USING (member_id IN (
    SELECT id FROM fcc_members WHERE household_id IN (
      SELECT household_id FROM fcc_caregivers
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  ));

-- fcc_member_clinical: caregiver write (editor only)
CREATE POLICY "fcc_clinical_caregiver_write" ON fcc_member_clinical
  FOR ALL TO authenticated
  USING (member_id IN (
    SELECT id FROM fcc_members WHERE household_id IN (
      SELECT household_id FROM fcc_caregivers
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL AND role = 'editor'
    )
  ));

-- fcc_emergency_contacts: caregiver select
CREATE POLICY "fcc_contacts_caregiver_select" ON fcc_emergency_contacts
  FOR SELECT TO authenticated
  USING (household_id IN (
    SELECT household_id FROM fcc_caregivers
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  ));

-- fcc_emergency_contacts: caregiver write (editor only)
CREATE POLICY "fcc_contacts_caregiver_write" ON fcc_emergency_contacts
  FOR ALL TO authenticated
  USING (household_id IN (
    SELECT household_id FROM fcc_caregivers
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL AND role = 'editor'
  ));

-- fcc_access_logs: caregiver select (viewer+editor)
CREATE POLICY "fcc_access_logs_caregiver_select" ON fcc_access_logs
  FOR SELECT TO authenticated
  USING (household_id IN (
    SELECT household_id FROM fcc_caregivers
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  ));
