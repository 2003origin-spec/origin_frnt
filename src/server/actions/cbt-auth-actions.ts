'use server';

import { randomBytes } from 'node:crypto';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

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
import { dbCreateAuthSession, dbFindUserByEmail, dbRegisterUser } from '@/server/db-users';
import { revokeRefreshSession } from '@/server/auth';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { cbtOtpLimiter } from '@/lib/rate-limit';
import { recordAuditEvent } from '@/server/workspaces/audit';
import { issueCbtOtp, verifyCbtOtp } from '@/server/cbt/cbt-otp';
import { findActiveCbtTeacherByEmail, linkCbtTeacherUser } from '@/server/cbt/cbt-teachers-service';

/**
 * CBT teacher auth. Fully separate from the main Origin auth surface: these
 * actions take NO role parameter (so a client can never influence the minted
 * role), self-rate-limit (Server Actions bypass middleware), and both send and
 * verify re-check the cbt.teachers allowlist.
 */

type CbtActionResult = { ok: boolean; message?: string };

// Same generic copy whether or not the email is allowlisted — no oracle.
const GENERIC_SENT = 'If this email is on the CBT allowlist, a sign-in code has been sent.';

async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'anonymous';
}

async function setCbtSessionCookies(
  access: string,
  refresh: string,
  accessFingerprint: string | undefined,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, access, COOKIE_OPTS_ACCESS);
  if (accessFingerprint) {
    cookieStore.set(ACCESS_FINGERPRINT_COOKIE_NAME, accessFingerprint, COOKIE_OPTS_ACCESS_FINGERPRINT);
  }
  if (refresh) {
    cookieStore.set(REFRESH_COOKIE_NAME, refresh, COOKIE_OPTS_REFRESH);
  }
  cookieStore.set(CSRF_COOKIE_NAME, createCsrfToken(), COOKIE_OPTS_CSRF);
}

export async function sendCbtOtpAction(email: string): Promise<CbtActionResult> {
  try {
    if (!isFeatureEnabled('cbtModule')) return { ok: false, message: 'CBT is not available.' };
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized) return { ok: false, message: 'Email is required.' };

    // Rate limit per email AND per IP, BEFORE the allowlist check so the limit
    // response is identical for allowlisted and non-allowlisted emails.
    const ip = await clientIp();
    const [byEmail, byIp] = await Promise.all([
      cbtOtpLimiter.limit(`email:${normalized}`),
      cbtOtpLimiter.limit(`ip:${ip}`),
    ]);
    if (!byEmail.success || !byIp.success) {
      return { ok: false, message: 'Too many requests. Please try again in a few minutes.' };
    }

    const teacher = await findActiveCbtTeacherByEmail(normalized);
    if (teacher) {
      await issueCbtOtp(normalized);
    }
    // Generic response regardless of allowlist membership.
    return { ok: true, message: GENERIC_SENT };
  } catch (error) {
    console.error('[cbt-auth] sendCbtOtpAction failed:', error instanceof Error ? error.message : error);
    return { ok: false, message: 'Unable to send a code right now. Please try again.' };
  }
}

export async function loginWithCbtOtpAction(email: string, code: string): Promise<CbtActionResult> {
  try {
    if (!isFeatureEnabled('cbtModule')) return { ok: false, message: 'CBT is not available.' };
    const normalized = (email ?? '').trim().toLowerCase();
    const cleanCode = (code ?? '').trim();
    if (!normalized || !cleanCode) return { ok: false, message: 'Email and code are required.' };

    // Re-check the allowlist on verify (a teacher may have been removed between
    // send and verify — removal also revokes existing sessions).
    const teacher = await findActiveCbtTeacherByEmail(normalized);
    if (!teacher) return { ok: false, message: 'Invalid or expired code.' };

    const result = await verifyCbtOtp(normalized, cleanCode);
    if (result !== 'ok') {
      return {
        ok: false,
        message: result === 'locked'
          ? 'Too many attempts. Please request a new code.'
          : 'Invalid or expired code.',
      };
    }

    // Find or provision the cbt_teacher origin_users row. The password is a
    // random inert secret — CBT login is OTP-only and the legacy password/OTP
    // paths hard-reject the cbt_teacher role.
    const existing = await dbFindUserByEmail(normalized, 'cbt_teacher');
    let userId: string;
    let session: Awaited<ReturnType<typeof dbCreateAuthSession>>;
    if (existing) {
      userId = existing.id;
      session = await dbCreateAuthSession(existing.id);
    } else {
      const inertPassword = randomBytes(24).toString('base64url');
      const created = await dbRegisterUser({
        name: teacher.displayName || normalized,
        email: normalized,
        password: inertPassword,
        role: 'cbt_teacher',
      });
      userId = created.user.id;
      session = created.session;
    }

    await linkCbtTeacherUser(normalized, userId);
    await setCbtSessionCookies(session.accessToken, session.refreshToken, session.accessFingerprint);
    revalidatePath('/', 'layout');

    await recordAuditEvent({
      actorUserId: userId,
      workspaceId: null,
      entityType: 'cbt_teacher',
      entityId: teacher.id,
      action: 'cbt.teacher_login',
      requestId: null,
    });

    return { ok: true };
  } catch (error) {
    console.error('[cbt-auth] loginWithCbtOtpAction failed:', error instanceof Error ? error.message : error);
    return { ok: false, message: 'Sign-in is temporarily unavailable. Please try again.' };
  }
}

export async function cbtLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  await revokeRefreshSession(cookieStore.get(REFRESH_COOKIE_NAME)?.value);
  cookieStore.set(ACCESS_COOKIE_NAME, '', { ...COOKIE_OPTS_ACCESS, maxAge: 0 });
  cookieStore.set(ACCESS_FINGERPRINT_COOKIE_NAME, '', { ...COOKIE_OPTS_ACCESS_FINGERPRINT, maxAge: 0 });
  cookieStore.set(REFRESH_COOKIE_NAME, '', { ...COOKIE_OPTS_REFRESH, maxAge: 0 });
  cookieStore.set(CSRF_COOKIE_NAME, '', { ...COOKIE_OPTS_CSRF, maxAge: 0 });
  revalidatePath('/', 'layout');
}
