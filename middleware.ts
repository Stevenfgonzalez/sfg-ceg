import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';

// Routes that require CEG account authentication
// /fcc/[householdId] is PUBLIC (EMS entry) — only owner routes are protected
const PROTECTED_ROUTES = ['/fcc/edit', '/fcc/log', '/fcc/print'];
// /fcc exactly (dashboard) is also protected, handled below

export async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('x-request-id', requestId);

  // Refresh Supabase auth session (keeps cookies fresh)
  const supabase = createAuthMiddlewareClient(request, response);
  const { data: { user } } = await supabase.auth.getUser();

  // Check protected routes
  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname === '/fcc' ||
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/signup
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/fcc', request.url));
  }

  // Legacy redirects
  if (pathname === '/care-cards') {
    return NextResponse.redirect(new URL('/fcc', request.url));
  }
  if (pathname === '/fcc-ems') {
    return NextResponse.redirect(new URL(`/fcc/${encodeURIComponent('FCC-4827')}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/fcc/:path*', '/fcc', '/care-cards', '/fcc-ems', '/login', '/signup'],
};
