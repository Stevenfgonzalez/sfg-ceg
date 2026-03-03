import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAuthMiddlewareClient } from '@/lib/supabase-auth-server';

// Routes that require CEG account authentication
const PROTECTED_ROUTES = ['/care-cards'];

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
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/signup
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/care-cards', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/care-cards/:path*', '/login', '/signup'],
};
