/**
 * Indian mobile-number validation — one shared, client-safe helper so the login
 * form, profile edit, and server writers all agree.
 *
 * Beyond the basic format (10 digits, starts 6–9), this rejects obviously-fake
 * numbers that the plain `/^[6-9]\d{9}$/` regex lets through — most importantly
 * all-same-digit numbers like 6666666666 / 9999999999, which students were using
 * to get past signup. Real Indian mobile numbers are never a single repeated
 * digit.
 */

/**
 * Normalize a raw input to a valid 10-digit Indian local number, or null.
 * Strips non-digits and an optional leading `91` country code; requires the
 * result to be 10 digits starting 6–9 and NOT a single repeated digit.
 */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  // Reject all-same-digit fakes (6666666666, 9999999999, …).
  if (/^(\d)\1{9}$/.test(local)) return null;
  return local;
}

/** True when `raw` is a plausible real Indian mobile number. */
export function isValidIndianMobile(raw: string | null | undefined): boolean {
  return normalizeIndianMobile(raw) !== null;
}
