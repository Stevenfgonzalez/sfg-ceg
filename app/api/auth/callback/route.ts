import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';

/**
 * GET /api/auth/callback
 *
 * Handles the redirect from Supabase email confirmation.
 * Exchanges the auth code for a session and redirects to care-cards.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/fcc';

  if (code) {
    const response = NextResponse.redirect(new URL(redirect, request.url));
    const supabase = createAuthMiddlewareClient(request, response);
    await supabase.auth.exchangeCodeForSession(code);
    return response;
  }

  // No code — redirect to login
  return NextResponse.redirect(new URL('/login', request.url));
}
