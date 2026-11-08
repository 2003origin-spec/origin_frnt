'use server';

import { revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { requireFeatureEnabled } from '@/lib/feature-flags';
import { isExamPresetId, type ExamPresetId } from '@/lib/exam-blueprints';
import { isTestWindowError, type TestWindowErrorCode } from '@/lib/assessments/test-window';
import { readStoreAsync, withStoreAsyncScoped, TEST_SUBMIT_PERSIST_COLLECTIONS } from '@/server/store';
import { getStudentScope } from '@/server/study-scope';
import {
  beginTeacherTestSitting,
  createCustomTest,
  createFullLengthTest,
  getTestDetail,
  startAssessmentAttempt,
  submitTest,
  type CustomTestPayload,
  type TeacherTestSitting,
  type TestSubmissionPayload,
} from '@/server/assessments';

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

export async function createCustomTestAction(payload: CustomTestPayload) {
  const user = await requireUser();
  // createCustomTest persists its durable record via persistGeneratedCustomTest
  // and mutates no store collection, so no wholesale store write is needed.
  const test = await withStoreAsyncScoped(async (store) => {
    return createCustomTest(store, user, payload);
  }, null);
  revalidateTag('tests', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  return test;
}

/**
 * Generates a full-length exam mock (JEE Main / JEE Advanced / NEET) for the
 * signed-in student and returns it in the same shape as any other test, so the
 * caller can start it immediately.
 *
 * The entitlement decision is made HERE from the server-resolved scope — the
 * preset cards' locked state is presentation only and is never trusted (D2).
 * See V1/FULL_LENGTH_MOCK_TESTS_PLAN.md.
 */
export async function createFullLengthTestAction(preset: ExamPresetId) {
  requireFeatureEnabled('fullLengthMocks');
  const user = await requireUser();
  if (!isExamPresetId(preset)) {
    throw new Error('Unknown exam preset.');
  }

  const scope = await getStudentScope(user.id, user.role);
  const { testId } = await createFullLengthTest({ userId: user.id, preset, scope });

  // Re-read through the ordinary persisted-test path so the payload is exactly
  // what /tests/[id] would serve — no second serializer to keep in step.
  const test = await withStoreAsyncScoped(async (store) => {
    return getTestDetail(store, user, testId);
  }, null);

  revalidateTag('tests', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  return test;
}

/**
 * The student pressed Start on a teacher-assigned test: the server starts the
 * sitting's clock now (not at page load) and returns the authoritative end the
 * timer caps at. Null for any other test. Never throws — the client treats this
 * as best-effort (the submit gate does not depend on it), so a window refusal or
 * a DB hiccup just returns null and the timer keeps its window-end cap.
 */
export async function beginTestSittingAction(testId: string): Promise<TeacherTestSitting | null> {
  const user = await requireUser();
  try {
    return await beginTeacherTestSitting(user.id, testId);
  } catch (error) {
    if (!isTestWindowError(error)) {
      console.warn('[test-actions] could not begin teacher-test sitting', {
        testId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

/**
 * Returned (not thrown) when a teacher-assigned test's window refuses the submit:
 * a thrown server-action error reaches the browser with its message redacted in
 * production, and the student needs to know the window closed rather than retry.
 */
export type SubmitTestWindowRefusal = {
  testWindowError: { code: TestWindowErrorCode; detail: string; endsAt: string | null };
};

/**
 * Records the server-side start of a self-test attempt (G7). submitTest times
 * the attempt from this row instead of trusting the client's timeTaken.
 */
export async function startTestAttemptAction(testId: string) {
  const user = await requireUser();
  const store = await readStoreAsync();
  return startAssessmentAttempt(store, user, 'test', testId);
}

export async function submitTestAction(testId: string, payload: TestSubmissionPayload) {
  const user = await requireUser();
  let result;
  try {
    result = await withStoreAsyncScoped(
      async (store) => {
        return submitTest(store, user, testId, payload);
      },
      { userId: user.id, collections: TEST_SUBMIT_PERSIST_COLLECTIONS, persistUser: true },
    );
  } catch (error) {
    if (isTestWindowError(error)) {
      const refusal: SubmitTestWindowRefusal = {
        testWindowError: { code: error.code, detail: error.message, endsAt: error.endsAt },
      };
      return refusal;
    }
    throw error;
  }

  revalidateTag('tests', 'max');
  revalidateTag(`test:${testId}`, 'max');
  revalidateTag('milestones', 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${user.id}`, 'max');
  revalidateTag('leaderboard', 'max');
  // Submitting a test can change the user's ranking/stats surfaces and
  // dashboard challenge/recommendation cards.
  revalidateTag('ogcode-catalog', 'max');
  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${user.id}`, 'max');
  return result;
}
