/**
 * Who may use Origin NOW, and how (plan doc: pilot cohort, minors, guardian
 * consent). Every handler calls `getNowAccess` before doing anything else.
 *
 * Age rule: with no date of birth on the account, the student is treated as a
 * minor (plan doc, "Until they ship, every student account is treated as a
 * minor"), so a missing DOB can never unlock anything.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureNowSchema } from "./now-schema";

export type NowAccess = {
  enabled: boolean;
  inCohort: boolean;
  isMinor: boolean;
  hasStudentConsent: boolean;
  /** Can raise a Need Human Help request. */
  canRequest: boolean;
  /** Why canRequest is false, for the UI. */
  blockedReason: "flag_off" | "not_invited" | "needs_guardian_consent" | null;
  helper: { id: string; verificationStatus: string; isMinor: boolean } | null;
};

/** Whole years between DOB and now, using calendar dates (IST-agnostic enough for an age gate). */
export function ageInYears(dateOfBirth: Date, now: Date): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function isMinorOn(dateOfBirth: Date | null, now: Date): boolean {
  if (!dateOfBirth) return true;
  return ageInYears(dateOfBirth, now) < 18;
}

/** Pure decision, unit-tested; `getNowAccess` feeds it from the database. */
export function decideAccess(input: {
  enabled: boolean;
  inCohort: boolean;
  isMinor: boolean;
  hasStudentConsent: boolean;
}): Pick<NowAccess, "canRequest" | "blockedReason"> {
  if (!input.enabled) return { canRequest: false, blockedReason: "flag_off" };
  if (!input.inCohort) return { canRequest: false, blockedReason: "not_invited" };
  if (input.isMinor && !input.hasStudentConsent) return { canRequest: false, blockedReason: "needs_guardian_consent" };
  return { canRequest: true, blockedReason: null };
}

export async function getNowAccess(userId: string, now: Date = new Date()): Promise<NowAccess> {
  const enabled = isFeatureEnabled("originNow");
  const pool = getUserPostgresPool();
  if (!enabled || !pool) {
    return {
      enabled,
      inCohort: false,
      isMinor: true,
      hasStudentConsent: false,
      canRequest: false,
      blockedReason: "flag_off",
      helper: null,
    };
  }
  await ensureNowSchema();
  const res = await pool.query<{
    date_of_birth: Date | null;
    in_cohort: boolean;
    has_consent: boolean;
    helper_id: string | null;
    verification_status: string | null;
    helper_minor: boolean | null;
  }>(
    `SELECT u.date_of_birth,
            EXISTS (SELECT 1 FROM now.pilot_cohort c WHERE c.user_id = u.id AND c.removed_at IS NULL) AS in_cohort,
            EXISTS (SELECT 1 FROM app.guardian_consents g
                     WHERE g.user_id = u.id AND g.purpose = 'student' AND g.withdrawn_at IS NULL) AS has_consent,
            h.id AS helper_id, h.verification_status, h.is_minor AS helper_minor
       FROM origin_users u
       LEFT JOIN now.helpers h ON h.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  const row = res.rows[0];
  const inCohort = Boolean(row?.in_cohort);
  const isMinor = isMinorOn(row?.date_of_birth ?? null, now);
  const hasStudentConsent = Boolean(row?.has_consent);
  return {
    enabled,
    inCohort,
    isMinor,
    hasStudentConsent,
    ...decideAccess({ enabled, inCohort, isMinor, hasStudentConsent }),
    helper: row?.helper_id
      ? { id: row.helper_id, verificationStatus: row.verification_status ?? "verified", isMinor: Boolean(row.helper_minor) }
      : null,
  };
}
