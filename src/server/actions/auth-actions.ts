'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { emailSendLimiter, otpVerifyLimiter, refreshLimiter, isWithinLimit } from '@/lib/rate-limit';

import { handleGoogleLogin, handleLogin, handleRegister, handleRefresh, serializeUser, handleLoginWithOtp } from '@/server/users';
import { readStoreAsync, withStoreAsync } from '@/server/store';
import { getServerUser } from '@/lib/auth-server';
import { withEntitledSubjects } from '@/server/entitlements';
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  COOKIE_OPTS_ACCESS,
  COOKIE_OPTS_ACCESS_FINGERPRINT,
  COOKIE_OPTS_CSRF,
  COOKIE_OPTS_REFRESH,
  CSRF_COOKIE_NAME,
  createCsrfToken,
  REFRESH_COOKIE_NAME,
} from '@/server/auth-jwt';
import { isRefreshTokenValid, revokeRefreshSession } from '@/server/auth';
import { dbGetSessionByRefreshToken } from '@/server/db-users';
import { isUserPostgresConfigured } from '@/server/user-postgres';
import { revokeDeviceTokensForUser } from '@/server/push/device-tokens';
import {
  requestPasswordReset,
  verifyAndResetPassword,
  type PasswordResetRole,
} from '@/server/password-reset';
import { getLaunchSettings } from '@/server/launch-settings';
import type { User } from '@/types';

/**
 * Server-Action auth surface — the mutation path for every auth flow.
 *
 * Each action calls the shared domain handler in `@/server/users`, parses the
 * JSON response, mirrors the access + refresh tokens into HttpOnly cookies,
 * and returns just the user payload. The client never sees the raw tokens —
 * cookies are the session contract.
 */

type InternalAuthSuccess = { ok: true; user: User; access: string; refresh: string; accessFingerprint: string };
type AuthSuccess = { ok: true; user: User };
type AuthFailure = { ok: false; status: number; message: string };
type AuthResult = AuthSuccess | AuthFailure;
type InternalAuthResult = InternalAuthSuccess | AuthFailure;

function authActionFailure(operation: string, error: unknown): AuthFailure {
  console.error(`[auth-actions] ${operation} failed:`, error instanceof Error ? error.message : error);
  return {
    ok: false,
    status: 503,
    message: 'Authentication is temporarily unavailable. Please try again in a moment.',
  };
}

function toPublicAuthResult(result: InternalAuthResult): AuthResult {
  if (!result.ok) return result;
  return { ok: true, user: result.user };
}

/**
 * Admin-controlled login/signup gates. These apply to student accounts only —
 * admins and teachers must always be able to log in (the admin who flips the
 * "Allow Login" toggle off would otherwise lock themselves out and lose the
 * ability to turn it back on). Server Actions bypass middleware, so the gate is
 * enforced here at the action boundary.
 */
async function loginBlockedForRole(role: 'student' | 'teacher' | 'admin' | null | undefined): Promise<boolean> {
  if (role === 'admin' || role === 'teacher') return false;
  try {
    const settings = await getLaunchSettings();
    return !settings.allowLogin;
  } catch {
    // Fail open — never lock everyone out on a settings-store hiccup.
    return false;
  }
}

async function signupBlockedForRole(role: 'student' | 'teacher' | 'admin' | null | undefined): Promise<boolean> {
  if (role === 'admin' || role === 'teacher') return false;
  try {
    const settings = await getLaunchSettings();
    return !settings.allowSignup;
  } catch {
    return false;
  }
}

const LOGIN_DISABLED_MESSAGE = 'Login is currently disabled. Please check back soon.';
const SIGNUP_DISABLED_MESSAGE = 'New sign-ups are currently disabled. Please check back soon.';

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
  const accessFingerprint = typeof body.accessFingerprint === 'string' ? body.accessFingerprint : '';
  const user = body.user as User | undefined;
  if (!access || !accessFingerprint || !user) {
    return { ok: false, status: 500, message: 'Malformed auth response.' };
  }

  return { ok: true, user, access, refresh, accessFingerprint };
}

/** Vercel-resolved client IP (it overwrites x-forwarded-for; not spoofable). */
async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'anonymous';
}

async function setSessionCookies(access: string, refresh: string, accessFingerprint: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, access, COOKIE_OPTS_ACCESS);
  cookieStore.set(ACCESS_FINGERPRINT_COOKIE_NAME, accessFingerprint, COOKIE_OPTS_ACCESS_FINGERPRINT);
  if (refresh) {
    cookieStore.set(REFRESH_COOKIE_NAME, refresh, COOKIE_OPTS_REFRESH);
  }
  cookieStore.set(CSRF_COOKIE_NAME, createCsrfToken(), COOKIE_OPTS_CSRF);
}

export async function loginAction(input: {
  email: string;
  password: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  try {
    if (await loginBlockedForRole(input.role)) {
      return { ok: false, status: 403, message: LOGIN_DISABLED_MESSAGE };
    }
    const response = await handleLogin({
      email: input.email,
      password: input.password,
      role: input.role ?? undefined,
    });
    const parsed = await parseAuthResponse(response);
    if (parsed.ok) {
      await setSessionCookies(parsed.access, parsed.refresh, parsed.accessFingerprint);
      revalidatePath('/', 'layout');
    }
    return toPublicAuthResult(parsed);
  } catch (error) {
    return authActionFailure('loginAction', error);
  }
}

export async function loginWithOtpAction(input: {
  email: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  try {
    // Server Actions bypass middleware, so guard the role here too: CBT
    // teachers use the dedicated /cbt OTP flow and must never authenticate
    // through the main-Origin OTP path. (Cast: cbt_teacher is intentionally
    // outside this action's declared role union.)
    if ((input.role as string | null | undefined) === 'cbt_teacher') {
      return { ok: false, status: 400, message: 'Unsupported account type for this login.' };
    }
    if (await loginBlockedForRole(input.role)) {
      return { ok: false, status: 403, message: LOGIN_DISABLED_MESSAGE };
    }
    const response = await handleLoginWithOtp({
      email: input.email,
      role: input.role ?? undefined,
    });
    const parsed = await parseAuthResponse(response);
    if (parsed.ok) {
      await setSessionCookies(parsed.access, parsed.refresh, parsed.accessFingerprint);
      revalidatePath('/', 'layout');
    }
    return toPublicAuthResult(parsed);
  } catch (error) {
    return authActionFailure('loginWithOtpAction', error);
  }
}

export async function registerAction(input: {
  name?: string;
  email: string;
  password: string;
  mobile?: string;
  state?: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  try {
    if (await signupBlockedForRole(input.role)) {
      return { ok: false, status: 403, message: SIGNUP_DISABLED_MESSAGE };
    }
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
      mobile: input.mobile,
      location: input.state,
      role: input.role ?? undefined,
    });
    const parsed = await parseAuthResponse(response);
    if (parsed.ok) {
      try {
        await withStoreAsync(async (cleanupStore) => {
          cleanupStore.otps = cleanupStore.otps.filter(o => o.email.toLowerCase() !== input.email.toLowerCase());
        });
      } catch (cleanupError) {
        console.error(
          '[auth-actions] OTP cleanup failed after successful registration:',
          cleanupError instanceof Error ? cleanupError.message : cleanupError,
        );
      }

      await setSessionCookies(parsed.access, parsed.refresh, parsed.accessFingerprint);
      revalidatePath('/', 'layout');
    }
    return toPublicAuthResult(parsed);
  } catch (error) {
    return authActionFailure('registerAction', error);
  }
}

export async function googleLoginAction(input: { credential: string; role?: 'student' | 'teacher' | 'admin' | null }): Promise<AuthResult> {
  try {
    // Google auth is login-only for existing accounts. The login gate still
    // applies; new-account creation is refused inside handleGoogleLogin (users
    // must sign up via the form, which requires mobile + state), so the signup
    // gate no longer needs to be threaded through here.
    if (await loginBlockedForRole(input.role)) {
      return { ok: false, status: 403, message: LOGIN_DISABLED_MESSAGE };
    }
    const response = await handleGoogleLogin({ credential: input.credential, role: input.role ?? null });
    const parsed = await parseAuthResponse(response);
    if (parsed.ok) {
      await setSessionCookies(parsed.access, parsed.refresh, parsed.accessFingerprint);
      revalidatePath('/', 'layout');
    }
    return toPublicAuthResult(parsed);
  } catch (error) {
    return authActionFailure('googleLoginAction', error);
  }
}

/**
 * Refreshes the access token using the HttpOnly refresh cookie. Returns the
 * new short-lived access cookie value; callers don't need the value itself —
 * the cookie is already rotated on return. Used by client-side fetch paths
 * after a 401 without shipping the refresh token to JS.
 */
export async function refreshTokenAction(): Promise<{ ok: boolean; status: number }> {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  if (!refresh) return { ok: false, status: 400 };

  // Generous per-IP flood cap (120/min) — refresh does a session DB lookup and
  // is public + CSRF-exempt. High enough that multi-tab / CGNAT users never
  // trip it; low enough to blunt a single-IP flood. Fail-open on limiter error.
  if (!(await isWithinLimit(refreshLimiter, `ip:${await clientIp()}`))) {
    return { ok: false, status: 429 };
  }

  const response = await handleRefresh(null, { refresh });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 502 };
  }

  const access = typeof body.access === 'string' ? body.access : '';
  const newRefresh = typeof body.refresh === 'string' ? body.refresh : '';
  const accessFingerprint = typeof body.accessFingerprint === 'string' ? body.accessFingerprint : '';
  if (!access || !accessFingerprint) return { ok: false, status: 502 };

  await setSessionCookies(access, newRefresh, accessFingerprint);
  return { ok: true, status: response.status };
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
  if (!payload) return null;
  const enriched = await withEntitledSubjects(payload, stored.id);
  return (enriched as unknown as User) ?? null;
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  // Android app: unbind this user's FCM device tokens so a signed-out (or
  // next-user, shared-device) phone never receives their notifications
  // (ANDROID_HYBRID_APP_PLAN.md ledger #54). Resolve the user BEFORE the
  // session is revoked; strictly best-effort — logout must never fail on it.
  if (refresh) {
    try {
      const session = isUserPostgresConfigured()
        ? await dbGetSessionByRefreshToken(refresh)
        : await (async () => {
            const store = await readStoreAsync();
            return isRefreshTokenValid(store, refresh);
          })();
      if (session?.userId) {
        await revokeDeviceTokensForUser(session.userId);
      }
    } catch (error) {
      console.error('[auth-actions] push-token unbind on logout failed:', error instanceof Error ? error.message : error);
    }
  }
  await revokeRefreshSession(refresh);
  cookieStore.set(ACCESS_COOKIE_NAME, '', { ...COOKIE_OPTS_ACCESS, maxAge: 0 });
  cookieStore.set(ACCESS_FINGERPRINT_COOKIE_NAME, '', { ...COOKIE_OPTS_ACCESS_FINGERPRINT, maxAge: 0 });
  cookieStore.set(REFRESH_COOKIE_NAME, '', { ...COOKIE_OPTS_REFRESH, maxAge: 0 });
  cookieStore.set(CSRF_COOKIE_NAME, '', { ...COOKIE_OPTS_CSRF, maxAge: 0 });
  revalidatePath('/', 'layout');
}

// ── Forgot password (email OTP → set new password) ──────────────────────────

function normalizeResetRole(role: unknown): PasswordResetRole {
  return role === 'teacher' ? 'teacher' : 'student';
}

/**
 * Request a password-reset code. Always returns { ok: true } regardless of
 * whether the account exists — never reveals account existence (enumeration
 * safe). `devCode` is only populated in dev when no mail channel is configured.
 */
export async function requestPasswordResetAction(input: {
  email: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<{ ok: true; devCode?: string }> {
  const email = String(input.email ?? '').trim();
  if (!email || !email.includes('@')) return { ok: true };
  // Server Actions bypass middleware — cap reset-mail volume per IP AND per
  // email so this can't be turned into an outbound-email bomb (domain
  // reputation). Stay enumeration-safe: always return { ok: true }.
  const ip = await clientIp();
  const [ipOk, emailOk] = await Promise.all([
    isWithinLimit(emailSendLimiter, `reset-ip:${ip}`),
    isWithinLimit(emailSendLimiter, `reset-email:${email.toLowerCase()}`),
  ]);
  if (!ipOk || !emailOk) return { ok: true };
  try {
    const { devCode } = await requestPasswordReset(email, normalizeResetRole(input.role));
    return { ok: true, devCode };
  } catch (error) {
    console.error('[requestPasswordResetAction]', error);
    return { ok: true };
  }
}

/** Verify the reset code and set a new password. */
export async function resetPasswordAction(input: {
  email: string;
  role?: 'student' | 'teacher' | 'admin' | null;
  code: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = String(input.email ?? '').trim();
  const code = String(input.code ?? '').trim();
  const newPassword = String(input.newPassword ?? '');
  if (!email || !/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit code sent to your email.' };
  if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  // Defence-in-depth over the per-(email,role) 5-attempt DB lock: cap verify
  // volume per IP so the endpoint can't be flooded (each attempt takes a row
  // lock in the USER pool).
  const ip = await clientIp();
  if (!(await isWithinLimit(otpVerifyLimiter, `reset-verify-ip:${ip}`))) {
    return { ok: false, error: 'Too many attempts. Please try again in a few minutes.' };
  }
  try {
    const result = await verifyAndResetPassword(email, normalizeResetRole(input.role), code, newPassword);
    switch (result) {
      case 'ok':
        return { ok: true };
      case 'invalid':
        return { ok: false, error: 'Incorrect code. Please try again.' };
      case 'expired':
        return { ok: false, error: 'This code has expired. Request a new one.' };
      case 'locked':
        return { ok: false, error: 'Too many attempts. Request a new code.' };
      case 'not_found':
        return { ok: false, error: 'No reset in progress. Request a new code.' };
    }
  } catch (error) {
    console.error('[resetPasswordAction]', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
