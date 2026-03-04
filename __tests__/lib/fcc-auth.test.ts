import { describe, it, expect, vi } from 'vitest';
import { getFccAuth } from '@/lib/fcc-auth';

function mockSupabase(ownerResult: unknown, caregiverResult: unknown) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'fcc_households') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: ownerResult, error: ownerResult ? null : { code: 'PGRST116' } }),
        };
      }
      if (table === 'fcc_caregivers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: caregiverResult, error: caregiverResult ? null : { code: 'PGRST116' } }),
        };
      }
      return {};
    }),
  } as never;
}

describe('getFccAuth', () => {
  it('returns owner role when user owns a household', async () => {
    const supabase = mockSupabase({ id: 'h-1' }, null);
    const result = await getFccAuth(supabase, 'user-1');
    expect(result).toEqual({ user_id: 'user-1', household_id: 'h-1', role: 'owner' });
  });

  it('returns caregiver role when user is an accepted caregiver', async () => {
    const supabase = mockSupabase(null, { household_id: 'h-2', role: 'editor' });
    const result = await getFccAuth(supabase, 'user-2');
    expect(result).toEqual({ user_id: 'user-2', household_id: 'h-2', role: 'editor' });
  });

  it('returns null when user has no access', async () => {
    const supabase = mockSupabase(null, null);
    const result = await getFccAuth(supabase, 'user-3');
    expect(result).toBeNull();
  });

  it('returns null when role is insufficient', async () => {
    const supabase = mockSupabase(null, { household_id: 'h-2', role: 'viewer' });
    const result = await getFccAuth(supabase, 'user-2', ['owner', 'editor']);
    expect(result).toBeNull();
  });

  it('owner passes role check for owner-required routes', async () => {
    const supabase = mockSupabase({ id: 'h-1' }, null);
    const result = await getFccAuth(supabase, 'user-1', ['owner']);
    expect(result?.role).toBe('owner');
  });
});
