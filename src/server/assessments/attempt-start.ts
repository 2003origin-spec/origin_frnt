/**
 * `POST /api/assessments/{tests|dpps}/:id/start` — record when the student
 * opened a self test / DPP, so submit can compute the time taken server-side
 * instead of trusting the client's `timeTaken`. See `src/server/attempt-starts.ts`.
 *
 * The student must be able to take the assessment (same lookups submit uses),
 * so the table cannot be filled with rows for arbitrary ids.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getDppPlanDetail, getPersistedCustomTest } from "@/server/analytics-store";
import { recordAttemptStart, type AttemptKind } from "@/server/attempt-starts";
import { minutesToSeconds } from "@/server/attempt-timing";
import type { AppStore, StoredUser } from "@/server/store";
import { getAssignedTestForStudent } from "@/server/workspaces/tests-store";

async function testDurationSeconds(store: AppStore, user: StoredUser, testId: string): Promise<number | null | undefined> {
  const seeded = store.tests.find((entry) => entry.id === testId);
  if (seeded) return minutesToSeconds(seeded.duration);
  const persisted = await getPersistedCustomTest(testId, user.id);
  if (persisted) return minutesToSeconds(persisted.durationMinutes);
  if (isFeatureEnabled("teacherConnect")) {
    const assigned = await getAssignedTestForStudent(user.id, testId);
    if (assigned) return minutesToSeconds(assigned.test.durationMinutes);
  }
  return undefined; // not takeable by this student
}

export async function startAssessmentAttempt(
  store: AppStore,
  user: StoredUser,
  kind: AttemptKind,
  assessmentId: string,
): Promise<{ startedAt: string; started_at: string }> {
  let durationSeconds: number | null | undefined;
  if (kind === "test") {
    durationSeconds = await testDurationSeconds(store, user, assessmentId);
  } else {
    const plan = await getDppPlanDetail(user.id, assessmentId);
    durationSeconds = plan ? minutesToSeconds(plan.durationMinutes) : undefined;
  }
  if (durationSeconds === undefined) {
    throw new Error(`${kind === "test" ? "Test" : "DPP"} ${assessmentId} was not found.`);
  }
  const start = await recordAttemptStart(user.id, kind, assessmentId, durationSeconds);
  return { startedAt: start.startedAt, started_at: start.startedAt };
}
