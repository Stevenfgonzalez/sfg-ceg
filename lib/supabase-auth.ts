/**
 * Supabase Auth utilities for CEG
 *
 * Uses @supabase/ssr for cookie-based session management in Next.js.
 * Separate from lib/supabase.ts which handles RLS/service clients.
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client with auth session (for 'use client' components).
 * Automatically reads/writes auth cookies.
 */
export function createAuthBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
