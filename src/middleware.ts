import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const REQUEST_ID_HEADER = 'X-Request-Id';

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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_API_PATHS = new Set([
  '/api/users/login',
  '/api/users/register',
  '/api/users/google-login',
  '/api/users/token/refresh',
]);

function normalizePathname(pathname: string): string {
  return pathname === '/' ? pathname : pathname.replace(/\/+$/, '');
}

function requestIdFor(request: NextRequest): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

function nextWithRequestId(request: NextRequest, requestId: string): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  const response = NextResponse.next({ request: { headers } });
  return withRequestId(response, requestId);
}

export function middleware(request: NextRequest) {
  const requestId = requestIdFor(request);
  const pathname = normalizePathname(request.nextUrl.pathname);
  const token = request.cookies.get('origin_access_token')?.value;

  if (
    pathname.startsWith('/api/') &&
    !SAFE_METHODS.has(request.method.toUpperCase()) &&
    !CSRF_EXEMPT_API_PATHS.has(pathname)
  ) {
    const csrfCookie = request.cookies.get('origin_csrf')?.value;
    const csrfHeader = request.headers.get('x-csrf-token');
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return withRequestId(NextResponse.json({ detail: 'Invalid CSRF token.', requestId }, { status: 403 }), requestId);
    }
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('next', pathname);
    return withRequestId(NextResponse.redirect(url), requestId);
  }

  if (pathname === '/auth' && token) {
    const next = request.nextUrl.searchParams.get('next');
    const url = request.nextUrl.clone();
    url.pathname = next && next.startsWith('/') ? next : '/dashboard';
    url.search = '';
    return withRequestId(NextResponse.redirect(url), requestId);
  }

  return nextWithRequestId(request, requestId);
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)',
  ],
};
