/**
 * FCC authorization helper.
 * Resolves user role (owner/editor/viewer) for a given household.
 * Used by all FCC API routes to support caregiver sharing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type FccRole = 'owner' | 'editor' | 'viewer';

export interface FccAuthResult {
  user_id: string;
  household_id: string;
  role: FccRole;
}

/**
 * Check if a user has access to an FCC household and return their role.
 *
 * @param supabase - Supabase client (auth or service)
 * @param userId - The authenticated user's ID
 * @param requiredRoles - If provided, only return a result if the user's role is in this list
 * @returns FccAuthResult or null if no access / insufficient role
 */
export async function getFccAuth(
  supabase: SupabaseClient,
  userId: string,
  requiredRoles?: FccRole[],
): Promise<FccAuthResult | null> {
  // Check owner first (limit 1 to handle duplicates gracefully)
  const { data: ownedHouseholds } = await supabase
    .from('fcc_households')
    .select('id')
    .eq('owner_id', userId)
    .limit(1);

  const ownedHousehold = ownedHouseholds?.[0] ?? null;

  if (ownedHousehold) {
    const result: FccAuthResult = {
      user_id: userId,
      household_id: ownedHousehold.id,
      role: 'owner',
    };
    if (requiredRoles && !requiredRoles.includes('owner')) return null;
    return result;
  }

  // Check caregiver
  const { data: caregiver } = await supabase
    .from('fcc_caregivers')
    .select('household_id, role')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .single();

  if (caregiver) {
    const role = caregiver.role as FccRole;
    const result: FccAuthResult = {
      user_id: userId,
      household_id: caregiver.household_id,
      role,
    };
    if (requiredRoles && !requiredRoles.includes(role)) return null;
    return result;
  }

  return null;
}
