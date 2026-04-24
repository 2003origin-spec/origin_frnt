import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Routes that require a valid session cookie.
 * Prefix-matched: `/tests` also covers `/tests/[id]` etc.
 */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/tests',
  '/ogcode',
  '/leaderboard',
  '/milestones',
  '/profile',
  '/study-corner',
  '/tasks',
  '/pomodoro',
  '/dpp',
  '/doubt-solver',
  '/onboarding',
  '/admin',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('origin_access_token')?.value;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/auth' && token) {
    const next = request.nextUrl.searchParams.get('next');
    const url = request.nextUrl.clone();
    url.pathname = next && next.startsWith('/') ? next : '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)',
  ],
};
