/**
 * 30-day expiry sweep for teacher-shared DPPs.
 * Plan: V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md (Phase 6)
 *
 * The student-visible half of expiry does NOT depend on this running: both the
 * share eligibility query (USER pool) and the DPP list read (OGCODE pool) filter
 * on `expires_at > NOW()`, so a shared DPP stops being reachable on time even if
 * the cron is late or never fires. This job only reclaims the storage.
 */

import { sweepTeacherDppPlansForShares } from "@/legacy/analytics-store";
import { isOgcodePostgresConfigured } from "@/server/postgres";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { deleteSweptTeacherDppShares } from "@/server/workspaces/teacher-dpp-service";

export type TeacherDppSweepResult = {
  /** Shares hard-deleted from the USER database (expired or revoked). */
  sharesDeleted: number;
  /** Materialized student plans hard-deleted (nobody had attempted them). */
  plansDeleted: number;
  /** Attempted plans detached instead of deleted — see decision D4. */
  plansDetached: number;
};

export async function sweepExpiredTeacherDpps(limit = 200): Promise<TeacherDppSweepResult> {
  const empty: TeacherDppSweepResult = { sharesDeleted: 0, plansDeleted: 0, plansDetached: 0 };
  if (!isUserPostgresConfigured()) return empty;

  // Step 1 (USER pool): drop the shares themselves. Batch links cascade.
  const shareIds = await deleteSweptTeacherDppShares(limit);
  if (shareIds.length === 0) return empty;

  // Step 2 (OGCODE pool): clean up the materialized student plans. Unattempted
  // ones are deleted outright; attempted ones are detached and hidden, because
  // analytics.dpp_attempts cascades from analytics.dpp_plans and those attempt
  // rows are the student's own solved-question and mastery history. Deleting
  // them would silently roll back work the student actually did.
  if (!isOgcodePostgresConfigured()) {
    return { sharesDeleted: shareIds.length, plansDeleted: 0, plansDetached: 0 };
  }
  const { deleted, detached } = await sweepTeacherDppPlansForShares(shareIds);

  return {
    sharesDeleted: shareIds.length,
    plansDeleted: deleted,
    plansDetached: detached,
  };
}
