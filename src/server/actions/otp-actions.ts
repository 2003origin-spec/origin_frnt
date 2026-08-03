'use server';

import { randomInt } from 'node:crypto';

import { headers } from 'next/headers';

import { readStoreAsync } from '@/server/store';
import { getActiveOtp, putOtp, verifyOtp } from '@/server/otp-store';
import { sendEmail } from '@/server/email';
import {
  emailSendLimiter,
  emailSendIpLimiter,
  otpVerifyEmailLimiter,
  otpVerifyLimiter,
  isWithinLimit,
} from '@/lib/rate-limit';

/**
 * Generates a 6-digit random OTP using a CSPRNG (never Math.random — the code
 * gates account creation for the target email).
 */
function generateOTP(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Vercel-resolved client IP (it overwrites x-forwarded-for; not spoofable). */
async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'anonymous';
}

/**
 * Action to send an OTP to a specific email.
 */
export async function sendOtpAction(
  email: string,
  role?: 'student' | 'teacher' | 'admin' | null,
) {
  if (!email) {
    return { ok: false, message: 'Email is required' };
  }

  // Server Actions bypass middleware. CBT teachers use the dedicated /cbt OTP
  // flow (cbt-auth-actions); this main-Origin OTP path must never issue codes
  // for a cbt_teacher role. (Cast: cbt_teacher is outside the declared union.)
  if ((role as string | null | undefined) === 'cbt_teacher') {
    return { ok: false, message: 'Unsupported account type.' };
  }

  const normalizedEmail = normalizeEmail(email);

  // Server Actions bypass the middleware rate limiter, so guard outbound-mail
  // abuse here: cap sends per IP AND per email BEFORE any DB/store work or the
  // exists-check, so the response is identical for real and unknown emails
  // (no enumeration oracle) and one IP can't blast codes at many addresses.
  const ip = await clientIp();
  const [ipOk, emailOk] = await Promise.all([
    // Per-IP budget is generous so a shared school/coaching-centre network isn't
    // blocked; the per-email budget is the real spam guard for one address.
    isWithinLimit(emailSendIpLimiter, `ip:${ip}`),
    isWithinLimit(emailSendLimiter, `email:${normalizedEmail}`),
  ]);
  if (!ipOk || !emailOk) {
    return { ok: false, message: 'Too many requests. Please try again in a few minutes.' };
  }

  let otp = generateOTP();
  let expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now

  try {
    // Read-only: the user lookup needs the store, but the OTP itself is written
    // through otp-store's row-scoped SQL. Using withStoreAsync here would
    // persist (and therefore DELETE + rewrite) every collection just to save one
    // code — the very thing that was destroying freshly-issued OTPs.
    const preflight = await (async () => {
      const store = await readStoreAsync();
      // "Already exists" check must be role-scoped: the same email can legally
      // be both a student and a teacher row (UNIQUE constraint is on
      // (email, role)). Without this scoping the preflight silently blocks
      // OTP delivery for a teacher signup whenever a student row with the
      // same email happens to be cached in the in-memory store.
      const userExists = store.users.find((u) => {
        if (u.email.toLowerCase() !== normalizedEmail) return false;
        if (u.role === 'admin') return false; // admins always allowed to re-OTP
        return role ? u.role === role : true;
      });
      if (userExists) {
        return { ok: false as const, message: 'An account with this email already exists. Please login instead.' };
      }

      // Resend safety: if a still-valid, unverified code already exists for this
      // email, REUSE it instead of minting a new one. Email delivery can lag, so
      // a "Resend" otherwise mints a new code that silently invalidates the
      // (slower) first email — the user types the first code and gets "invalid".
      // Reusing keeps every delivered email's code valid until it expires.
      const existing = await getActiveOtp(normalizedEmail);
      if (existing) {
        otp = existing.otp;
        expiresAt = existing.expiresAt;
      } else {
        // Keyed by the lower-cased email, so a previous send to "Foo@Bar.com"
        // and a new one to "foo@bar.com" can't leave two rows.
        await putOtp({ email: normalizedEmail, otp, expiresAt });
      }
      return { ok: true as const };
    })();

    if (!preflight.ok) {
      return preflight;
    }

    // Send email
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your ORIGIN account',
      text: `Your verification code is: ${otp}. This code will expire in 5 minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #1d4ed8;">Welcome to ORIGIN</h2>
          <p>Please use the following code to verify your account registration:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This code will expire in 5 minutes. If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return { ok: false, message: 'Failed to send verification email.' };
    }

    return { ok: true, message: 'Verification code sent to your email.' };
  } catch (error) {
    console.error('sendOtpAction error:', error);
    return { ok: false, message: 'An error occurred while sending OTP.' };
  }
}

/**
 * Action to verify the OTP for an email.
 */
export async function verifyOtpAction(email: string, otp: string) {
  if (!email || !otp) {
    return { ok: false, message: 'Email and verification code are required.' };
  }

  const normalizedEmail = normalizeEmail(email);

  // Brute-force guard is per-EMAIL (10 tries / 10 min on the specific code, which
  // also expires in 5 min) so many students on one shared IP don't collide. A
  // loose per-IP cap remains as a backstop against a single IP iterating codes
  // across many addresses.
  const ip = await clientIp();
  const [emailOk, ipOk] = await Promise.all([
    isWithinLimit(otpVerifyEmailLimiter, `email:${normalizedEmail}`),
    isWithinLimit(otpVerifyLimiter, `ip:${ip}`),
  ]);
  if (!emailOk || !ipOk) {
    return { ok: false, message: 'Too many attempts. Please try again in a few minutes.' };
  }

  try {
    // One guarded UPDATE against the single row — no full-store read/modify/
    // write, so a concurrent request on another instance can no longer delete
    // the code between issuing it and checking it.
    const outcome = await verifyOtp(normalizedEmail, otp);
    if (outcome === 'ok') {
      return { ok: true, message: 'Email verified successfully.' };
    }
    if (outcome === 'expired') {
      return { ok: false, message: 'Verification code has expired. Please request a new one.' };
    }
    return { ok: false, message: 'Invalid verification code.' };
  } catch (error) {
    console.error('verifyOtpAction error:', error);
    return { ok: false, message: 'An error occurred while verifying code.' };
  }
}
