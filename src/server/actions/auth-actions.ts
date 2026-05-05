'use server';

import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { handleGoogleLogin, handleLogin, handleRegister, handleRefresh, serializeUser, handleLoginWithOtp } from '@/server/users';
import { readStoreAsync, withStoreAsync } from '@/server/store';
import { getServerUser } from '@/lib/auth-server';
import type { User } from '@/types';

/**
 * Server-Action auth surface — the mutation path for every auth flow.
 *
 * Each action calls the shared domain handler in `@/server/users`, parses the
 * JSON response, mirrors the access + refresh tokens into HttpOnly cookies,
 * and returns just the user payload. The client never sees the raw tokens —
 * cookies are the session contract.
 */

const COOKIE_OPTS_ACCESS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60,
};

const COOKIE_OPTS_REFRESH = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

const COOKIE_OPTS_CSRF = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60,
};

type InternalAuthSuccess = { ok: true; user: User; access: string; refresh: string };
type AuthSuccess = { ok: true; user: User };
type AuthFailure = { ok: false; status: number; message: string };
type AuthResult = AuthSuccess | AuthFailure;
type InternalAuthResult = InternalAuthSuccess | AuthFailure;

function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

function toPublicAuthResult(result: InternalAuthResult): AuthResult {
  if (!result.ok) return result;
  return { ok: true, user: result.user };
}

async function parseAuthResponse(response: Response): Promise<InternalAuthResult> {
  let body: Record<string, unknown> = {};
  try {
    body = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    // fall through
  }

  if (!response.ok) {
    const message =
      typeof body.detail === 'string'
        ? body.detail
        : typeof body.message === 'string'
          ? body.message
          : 'Authentication failed.';
    return { ok: false, status: response.status, message };
  }

  const access = typeof body.access === 'string' ? body.access : '';
  const refresh = typeof body.refresh === 'string' ? body.refresh : '';
  const user = body.user as User | undefined;
  if (!access || !user) {
    return { ok: false, status: 500, message: 'Malformed auth response.' };
  }

  return { ok: true, user, access, refresh };
}

async function setSessionCookies(access: string, refresh: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('origin_access_token', access, COOKIE_OPTS_ACCESS);
  if (refresh) {
    cookieStore.set('origin_refresh_token', refresh, COOKIE_OPTS_REFRESH);
  }
  cookieStore.set('origin_csrf', createCsrfToken(), COOKIE_OPTS_CSRF);
}

export async function loginAction(input: {
  email: string;
  password: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  const response = await handleLogin({
    email: input.email,
    password: input.password,
    role: input.role ?? undefined,
  });
  const parsed = await parseAuthResponse(response);
  if (parsed.ok) {
    await setSessionCookies(parsed.access, parsed.refresh);
    revalidatePath('/', 'layout');
  }
  return toPublicAuthResult(parsed);
}

export async function loginWithOtpAction(input: {
  email: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  const response = await handleLoginWithOtp({
    email: input.email,
    role: input.role ?? undefined,
  });
  const parsed = await parseAuthResponse(response);
  if (parsed.ok) {
    await setSessionCookies(parsed.access, parsed.refresh);
    revalidatePath('/', 'layout');
  }
  return toPublicAuthResult(parsed);
}

export async function registerAction(input: {
  name?: string;
  email: string;
  password: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  // Check if email was verified via OTP
  const store = await readStoreAsync();
  const isVerified = store.otps.some(o => o.email.toLowerCase() === input.email.toLowerCase() && o.verified === true);
  
  if (!isVerified) {
    return { ok: false, status: 400, message: 'Email verification required. Please verify your email first.' };
  }

  const response = await handleRegister({
    name: input.name,
    email: input.email,
    password: input.password,
    role: input.role ?? undefined,
  });
  const parsed = await parseAuthResponse(response);
  if (parsed.ok) {
    await withStoreAsync(async (cleanupStore) => {
      cleanupStore.otps = cleanupStore.otps.filter(o => o.email.toLowerCase() !== input.email.toLowerCase());
    });

    await setSessionCookies(parsed.access, parsed.refresh);
    revalidatePath('/', 'layout');
  }
  return toPublicAuthResult(parsed);
}

export async function googleLoginAction(input: { credential: string }): Promise<AuthResult> {
  const response = await handleGoogleLogin({ credential: input.credential });
  const parsed = await parseAuthResponse(response);
  if (parsed.ok) {
    await setSessionCookies(parsed.access, parsed.refresh);
    revalidatePath('/', 'layout');
  }
  return toPublicAuthResult(parsed);
}

/**
 * Refreshes the access token using the HttpOnly refresh cookie. Returns the
 * new short-lived access cookie value; callers don't need the value itself —
 * the cookie is already rotated on return. Used by client-side fetch paths
 * after a 401 without shipping the refresh token to JS.
 */
export async function refreshTokenAction(): Promise<{ ok: boolean }> {
  const cookieStore = await cookies();
  const refresh = cookieStore.get('origin_refresh_token')?.value;
  if (!refresh) return { ok: false };

  const response = await handleRefresh(null, { refresh });
  if (!response.ok) return { ok: false };

  let body: Record<string, unknown> = {};
  try {
    body = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    return { ok: false };
  }

  const access = typeof body.access === 'string' ? body.access : '';
  const newRefresh = typeof body.refresh === 'string' ? body.refresh : '';
  if (!access) return { ok: false };

  await setSessionCookies(access, newRefresh || refresh);
  return { ok: true };
}

/**
 * Returns the current user (or null) resolved from the access-token cookie.
 * Replaces the client-side `apiCall('/users/me/')` hop in `AuthContext.refreshUser`.
 */
export async function refreshUserAction(): Promise<User | null> {
  const stored = await getServerUser();
  if (!stored) return null;
  const store = await readStoreAsync();
  const payload = serializeUser(store, stored.id);
  return (payload as unknown as User) ?? null;
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('origin_access_token', '', { ...COOKIE_OPTS_ACCESS, maxAge: 0 });
  cookieStore.set('origin_refresh_token', '', { ...COOKIE_OPTS_REFRESH, maxAge: 0 });
  cookieStore.set('origin_csrf', '', { ...COOKIE_OPTS_CSRF, maxAge: 0 });
  revalidatePath('/', 'layout');
}
