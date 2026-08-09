/**
 * Materializes teacher-shared DPPs into the student's own DPP list.
 * Plan: V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md (Phase 4)
 *
 * A teacher's share is stored ONCE, batch-scoped, in the USER database
 * (assessment.teacher_dpp_shares). The student's personal plan row lives in
 * analytics.dpp_plans behind the OGCODE pool. This module is the only place the
 * two meet — and it meets them in application code, never in a SQL join, because
 * the two schemas are separate logical databases (see the plan §2.1 and the
 * header of src/server/dpp-question-bank.ts).
 *
 * Running on read rather than fanning out at share time is what makes roster
 * changes free: a student added to the batch tomorrow gets the DPP on their next
 * visit, and a revoke stays a one-row write instead of an N-row delete.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  deleteIneligibleTeacherDppPlans,
  materializeTeacherDppPlans,
  type TeacherDppMaterialization,
} from "@/legacy/analytics-store";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { listActiveTeacherDppSharesFor } from "@/server/workspaces/teacher-dpp-service";
import { isStudentEligibleForTeacherDppShare } from "@/server/workspaces/teacher-dpp-store";
import type { TeacherDppShareForStudent } from "@/server/workspaces/types";

/**
 * Pure share → plan projection, so the mapping is unit-testable without either
 * database. A share with no questions left (every source question deleted from
 * the Question Bag) is dropped rather than materialized as an empty DPP.
 */
export function toMaterializations(
  shares: TeacherDppShareForStudent[],
): TeacherDppMaterialization[] {
  return shares
    .filter((share) => share.questionIds.length > 0)
    .map((share) => ({
      shareId: share.shareId,
      workspaceId: share.workspaceId,
      batchId: share.batchId,
      title: share.title,
      subject: share.subject,
      summary:
        share.summary?.trim() ||
        `Practice set shared with your batch by ${share.teacherDisplayName}.`,
      durationMinutes: share.durationMinutes,
      questionIds: share.questionIds,
      teacherDisplayName: share.teacherDisplayName,
      teacherLogoUrl: share.teacherLogoUrl,
      expiresAt: share.expiresAt,
      showAllQuestions: share.showAllQuestions,
    }));
}

/**
 * Brings the student's materialized teacher DPPs in line with what they are
 * eligible for right now: create the missing ones, drop the ones they have lost
 * access to.
 *
 * Never throws. A USER-pool failure returns early WITHOUT running the delete —
 * treating "I could not read the shares" as "you are eligible for nothing"
 * would delete live DPPs. Already-materialized plans keep rendering, and the
 * next healthy request reconciles.
 */
export async function syncTeacherDppsForStudent(userId: string): Promise<void> {
  if (!userId) return;
  if (!isFeatureEnabled("teacherDppShare")) return;
  if (!isUserPostgresConfigured()) return;

  let shares: TeacherDppShareForStudent[];
  try {
    shares = await listActiveTeacherDppSharesFor(userId);
  } catch (error) {
    console.error("[teacher-dpp] share lookup failed; leaving materialized DPPs as-is", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  try {
    const materializations = toMaterializations(shares);
    await materializeTeacherDppPlans(userId, materializations);
    await deleteIneligibleTeacherDppPlans(
      userId,
      materializations.map((entry) => entry.shareId),
    );
  } catch (error) {
    // The student's own DPPs must still render if this half fails.
    console.error("[teacher-dpp] materialization failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Re-checks a single teacher DPP on the take/grade/submit paths. Returns false
 * when the feature is off, the share is gone/revoked/expired, or the student has
 * since left the batch or the institute — so a stale plan id cannot be replayed.
 */
export async function canStudentUseTeacherDpp(
  shareId: string | null,
  userId: string,
): Promise<boolean> {
  if (!isFeatureEnabled("teacherDppShare")) return false;
  if (!shareId) return false;
  if (!isUserPostgresConfigured()) return false;
  try {
    return await isStudentEligibleForTeacherDppShare(shareId, userId);
  } catch (error) {
    console.error("[teacher-dpp] eligibility check failed", {
      shareId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
