/**
 * Teacher Tests service layer.
 * Encodes business rules for test creation, assignment, and lifecycle.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import { listBatches } from "./batches";
import { assertBatchesBelongToWorkspace } from "./tenant-scoping";
import {
  addQuestionsToTest,
  createTest,
  assignTestToBatchOnce,
  getTestById,
  getTestWithQuestions,
  listTests,
  updateTest,
  deleteTest,
  getTestAssessmentActivity,
  listTestQuestions,
  replaceTestQuestions,
  listAttemptResults,
  type CreateTestInput,
} from "./tests-store";
import { getQuestionWithVersion } from "./questions";
import { filterExistingOgcodeQuestionIds } from "@/server/ogcode-catalog";
import {
  archiveRefusal,
  deleteRefusal,
  editRefusal,
  enforce,
  gradingPatchChanged,
  questionReplacementRefusal,
  questionSetChanged,
  scheduleRefusal,
  windowRefusal,
  windowReplacementRefusal,
  type TeacherTestActivity,
} from "./test-lifecycle-guards";
import {
  countTestResults,
  getTestAttemptCohort,
  getTestLeaderboardFromResults,
  getTestTopicWeakness,
  getCohortResultOwner,
  type TestCohortAttempt,
  type TestLeaderboardEntry,
  type TestTopicWeakness,
} from "./test-cohort-store";
import { getSingleResultForRender } from "@/server/render-loaders";
import type {
  AssessmentTest,
  QuestionSourceBank,
  TestAssignment,
  TestAttempt,
  TestWithQuestions,
} from "./types";

export type TestQuestionInput = {
  position: number;
  sourceBank: QuestionSourceBank;
  ogcodeQuestionId?: string | null;
  contentQuestionId?: string | null;
  contentQuestionVersionId?: string | null;
  marks?: number;
  negativeMarks?: number;
  /**
   * Free-form per-question context. Full-length generated papers put their
   * blueprint `sectionId` here so a taken paper can be re-sectioned.
   */
  metadata?: Record<string, unknown>;
};

export type CreateTeacherTestInput = Omit<CreateTestInput, "totalQuestions"> & {
  actorUserId: string;
  questions: TestQuestionInput[];
  requestId?: string | null;
};

/**
 * Validates a question set (ogcode ids exist; workspace_bag rows are ready and
 * carry a version id) and writes it onto a test. All validation runs BEFORE any
 * write, so `replace` can clear the existing rows without risking partial loss on
 * a validation failure. Shared by create + edit so both behave identically.
 */
async function applyTestQuestions(
  testId: string,
  workspaceId: string,
  questions: TestQuestionInput[],
  opts?: { replace?: boolean },
): Promise<void> {
  // Batch-validate ogcode ids exist (one query — the bank has thousands of rows).
  // An EXISTENCE check, not a hydration: a generated full-length paper validates
  // up to 180 ids, and pulling every column of every row to answer "does this
  // exist" moves megabytes for nothing.
  const ogcodeIds = questions
    .filter((q) => q.sourceBank === "ogcode")
    .map((q) => q.ogcodeQuestionId)
    .filter((id): id is string => Boolean(id));
  const existingOgcodeIds = ogcodeIds.length
    ? await filterExistingOgcodeQuestionIds(ogcodeIds)
    : new Set<string>();
  for (const id of ogcodeIds) {
    if (!existingOgcodeIds.has(id)) throw new AuthzError(400, `OG Code question ${id} not found.`);
  }

  // Resolve/validate every row (no writes yet).
  const resolved: Array<TestQuestionInput & { contentQuestionVersionId: string | null }> = [];
  for (const q of questions) {
    if (q.sourceBank === "ogcode" && !q.ogcodeQuestionId) {
      throw new AuthzError(400, "An OG Code question is missing its question id.");
    }
    let contentQuestionVersionId = q.contentQuestionVersionId ?? null;
    if (q.sourceBank === "workspace_bag") {
      if (!q.contentQuestionId) {
        throw new AuthzError(400, "A Question-Bag question is missing its question id.");
      }
      const question = await getQuestionWithVersion(q.contentQuestionId);
      if (!question) {
        throw new AuthzError(400, `Question ${q.contentQuestionId} not found.`);
      }
      if (question.workspaceId !== workspaceId) {
        throw new AuthzError(403, `Question ${q.contentQuestionId} does not belong to this workspace.`);
      }
      if (question.status !== "ready" && question.status !== "published_private") {
        throw new AuthzError(400, `Question ${q.contentQuestionId} is not ready for use in tests.`);
      }
      contentQuestionVersionId = contentQuestionVersionId ?? question.currentVersionId;
      if (!contentQuestionVersionId) {
        throw new AuthzError(400, `Question ${q.contentQuestionId} has no published version.`);
      }
    }
    resolved.push({ ...q, contentQuestionVersionId });
  }

  // Commit only after validation succeeds. Written in one statement — a
  // generated full-length paper is up to 180 questions, and a round trip per row
  // is the whole creation budget spent on latency.
  const rows = resolved.map((q) => ({
    position: q.position,
    sourceBank: q.sourceBank,
    ogcodeQuestionId: q.ogcodeQuestionId ?? null,
    contentQuestionId: q.contentQuestionId ?? null,
    contentQuestionVersionId: q.contentQuestionVersionId,
    marks: q.marks ?? 4,
    negativeMarks: q.negativeMarks ?? -1,
    metadata: q.metadata,
  }));
  if (opts?.replace) {
    // Clear + insert in ONE transaction with the test row locked, refused if a
    // student is mid-attempt (re-checked under the lock, so an attempt that
    // started after the caller's pre-check still blocks it).
    await replaceTestQuestions(testId, rows, ({ inProgressAttemptCount }) =>
      enforce(questionReplacementRefusal(inProgressAttemptCount)),
    );
    return;
  }
  await addQuestionsToTest(testId, rows);
}

/**
 * Everything the lifecycle guards look at (see test-lifecycle-guards.ts).
 * Attempts = the larger of the assessment.test_attempts sittings that hold
 * student work (submitted, or with a saved answer) and the persisted results in
 * analytics.test_results (older submissions exist only there). Throws if either count cannot be read: a guard must fail closed.
 */
async function loadTestActivity(testId: string): Promise<TeacherTestActivity & { questionCount: number }> {
  const [assessment, resultCount] = await Promise.all([
    getTestAssessmentActivity(testId),
    countTestResults(testId),
  ]);
  if (!assessment) throw new AuthzError(404, "Test not found.");
  return {
    status: assessment.status,
    attemptCount: Math.max(assessment.attemptCount, resultCount),
    inProgressAttemptCount: assessment.inProgressAttemptCount,
    hasOpenWindow: assessment.hasOpenWindow,
    questionCount: assessment.questionCount,
  };
}

export async function createTeacherTest(input: CreateTeacherTestInput): Promise<TestWithQuestions> {
  if (!input.title.trim()) {
    throw new AuthzError(400, "Test title is required.");
  }
  if (input.durationMinutes <= 0) {
    throw new AuthzError(400, "Duration must be greater than 0.");
  }

  const test = await createTest({
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    title: input.title.trim(),
    description: input.description ?? null,
    subject: input.subject ?? "mixed",
    chapter: input.chapter ?? null,
    difficulty: input.difficulty ?? "medium",
    durationMinutes: input.durationMinutes,
    totalQuestions: input.questions.length,
    status: input.status ?? "draft",
    // Generated papers record HOW they were built; hand-picked ones stay manual.
    source: input.source ?? "manual",
    selectionPolicy: input.selectionPolicy ?? {},
    scoringPolicy: input.scoringPolicy ?? {},
    settings: input.settings ?? {},
  });

  await applyTestQuestions(test.id, input.workspaceId, input.questions);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: test.id,
    action: "test.created",
    after: test,
    requestId: input.requestId,
  });

  return getTestWithQuestions(test.id) as Promise<TestWithQuestions>;
}

export async function updateTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  patch: Partial<CreateTestInput>;
  /** When provided, the test's questions are fully replaced with this set. */
  questions?: TestQuestionInput[];
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const existing = await getTestById(input.testId);
  if (!existing) throw new AuthzError(404, "Test not found.");
  if (existing.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  // The editor resends the whole question list on every save; only a list that
  // actually differs is a replacement (and only that can corrupt attempts).
  const questionsChanged = input.questions
    ? questionSetChanged(await listTestQuestions(input.testId), input.questions)
    : false;
  // "Live" is derived (published AND attempted-or-window-open): nothing ever
  // sets status `live`, so the old status check never fired. A live test
  // refuses only grading changes (questions, marks, duration); metadata passes.
  enforce(
    editRefusal(await loadTestActivity(input.testId), {
      replacingQuestions: Boolean(input.questions),
      questionCount: input.questions?.length ?? 0,
      changesGrading: questionsChanged || gradingPatchChanged(existing, input.patch),
    }),
  );

  // Replace questions first (validates, then clears + inserts in one
  // transaction) so totalQuestions matches. An unchanged list is left alone.
  if (input.questions && questionsChanged) {
    await applyTestQuestions(input.testId, input.workspaceId, input.questions, { replace: true });
  }

  const patch: Partial<CreateTestInput> = {
    ...input.patch,
    ...(input.questions && questionsChanged ? { totalQuestions: input.questions.length } : {}),
  };
  const updated = await updateTest(input.testId, patch);
  if (!updated) throw new Error("Failed to update test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.updated",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export async function publishTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const test = await getTestWithQuestions(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (test.status !== "draft" && test.status !== "scheduled") {
    throw new AuthzError(400, "Only draft or scheduled tests can be published.");
  }
  if (test.questions.length === 0) {
    throw new AuthzError(400, "Cannot publish a test with no questions.");
  }

  const updated = await updateTest(input.testId, { status: "published" });
  if (!updated) throw new Error("Failed to publish test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.published",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export async function scheduleTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const existing = await getTestById(input.testId);
  if (!existing) throw new AuthzError(404, "Test not found.");
  if (existing.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (existing.status !== "draft") {
    throw new AuthzError(400, "Only draft tests can be scheduled.");
  }
  // Same rule as publish: a zero-question draft must not become assignable.
  const activity = await loadTestActivity(input.testId);
  enforce(
    scheduleRefusal({
      questionCount: activity.questionCount,
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
    }),
  );

  const updated = await updateTest(input.testId, { status: "scheduled" });
  if (!updated) throw new Error("Failed to schedule test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.scheduled",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export async function assignTestToBatches(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  batchIds: string[];
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  /** The teacher changed an existing assignment's window on purpose: replace it. */
  replaceWindow?: boolean;
  /** The assignment whose window the teacher edited (the edit page's pre-fill). */
  assignmentId?: string | null;
  requestId?: string | null;
}): Promise<TestAssignment[]> {
  const test = await getTestById(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (test.status !== "published" && test.status !== "scheduled") {
    throw new AuthzError(400, "Test must be published or scheduled before assignment.");
  }
  enforce(windowRefusal(input.scheduledStartAt, input.scheduledEndAt));

  // N9 — a batch id from another workspace must never be assignable (mirrors
  // shareTestAsDpp); otherwise another institute's students would see this test.
  const ownedBatches = await listBatches(input.workspaceId, { status: "active" });
  assertBatchesBelongToWorkspace(input.batchIds, ownedBatches.map((batch) => batch.id));

  // Idempotent per batch (R4-3): the wizard re-runs this step on every save of
  // an existing test, so a batch that already holds an overlapping assignment
  // never gets a second one, and its window changes only on an explicit
  // `replaceWindow` (the teacher edited the pre-filled window) — which updates
  // that assignment even when the new dates do not overlap the old, and is
  // refused if it would cut off students who are mid-sitting.
  const assignments: TestAssignment[] = [];
  for (const batchId of [...new Set(input.batchIds)]) {
    const { assignment, outcome, before } = await assignTestToBatchOnce({
      testId: input.testId,
      workspaceId: input.workspaceId,
      batchId,
      scheduledStartAt: input.scheduledStartAt ?? null,
      scheduledEndAt: input.scheduledEndAt ?? null,
      assignedBy: input.actorUserId,
      replaceWindow: input.replaceWindow ?? false,
      assignmentId: input.assignmentId ?? null,
      guard: ({ before, inProgressAttemptCount }) =>
        enforce(
          windowReplacementRefusal({
            inProgressAttemptCount,
            before,
            after: { scheduledStartAt: input.scheduledStartAt ?? null, scheduledEndAt: input.scheduledEndAt ?? null },
          }),
        ),
    });
    assignments.push(assignment);
    if (outcome === "unchanged") continue;
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "test_assignment",
      entityId: assignment.id,
      action: outcome === "created" ? "test.assigned" : "test.assignment_window_changed",
      before: before ?? undefined,
      after: assignment,
      requestId: input.requestId,
    });
  }

  return assignments;
}

export async function listTeacherTests(
  workspaceId: string,
  filter?: { status?: string },
): Promise<AssessmentTest[]> {
  return listTests(workspaceId, filter as { status?: "draft" | "scheduled" | "published" | "live" | "closed" | "archived" | "all" });
}

export async function getTeacherTest(
  workspaceId: string,
  testId: string,
): Promise<TestWithQuestions | null> {
  const test = await getTestById(testId);
  if (!test) return null;
  if (test.workspaceId !== workspaceId) return null;
  return getTestWithQuestions(testId);
}

export async function getTeacherTestLeaderboard(
  workspaceId: string,
  testId: string,
  limit = 20,
): Promise<TestLeaderboardEntry[]> {
  const test = await getTestById(testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== workspaceId) throw new AuthzError(403, "Access denied.");
  // Best submission per student from the persisted results (with names), not
  // the raw sittings in assessment.test_attempts.
  return getTestLeaderboardFromResults(workspaceId, testId, limit);
}

export async function getTeacherTestResults(
  workspaceId: string,
  testId: string,
): Promise<TestAttempt[]> {
  const test = await getTestById(testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== workspaceId) throw new AuthzError(403, "Access denied.");
  return listAttemptResults(testId);
}

// ─── Per-test cohort analytics (reads analytics.test_results) ──────────────────

/** Students who attempted a teacher test (live source: analytics.test_results). */
export async function getTestCohort(
  workspaceId: string,
  testId: string,
  opts?: { batchId?: string },
): Promise<TestCohortAttempt[]> {
  const test = await getTestById(testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== workspaceId) throw new AuthzError(403, "Access denied.");
  return getTestAttemptCohort(workspaceId, testId, opts);
}

/** Cumulative per-topic weakness for a teacher test (backs the per-test radar). */
export async function getTestWeakTopics(
  workspaceId: string,
  testId: string,
): Promise<TestTopicWeakness[]> {
  const test = await getTestById(testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== workspaceId) throw new AuthzError(403, "Access denied.");
  return getTestTopicWeakness(workspaceId, testId);
}

/**
 * A single student's individual test analysis for the teacher, scoped to the
 * workspace — reuses the student-side serializer so it renders in TestResultView.
 */
export async function getCohortStudentResult(workspaceId: string, resultId: string) {
  const ownerId = await getCohortResultOwner(workspaceId, resultId);
  if (!ownerId) throw new AuthzError(404, "Result not found.");
  return getSingleResultForRender(ownerId, resultId);
}

export async function deleteTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  requestId?: string | null;
}): Promise<void> {
  const test = await getTestById(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  // Delete CASCADES to assignments, attempts and answers: refused once students
  // have attempted it (archive instead), and while its window is open.
  enforce(deleteRefusal(await loadTestActivity(input.testId)));

  const deleted = await deleteTest(input.workspaceId, input.testId);
  if (!deleted) throw new Error("Failed to delete test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.deleted",
    before: test,
    requestId: input.requestId,
  });
}

export async function closeTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const test = await getTestById(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (test.status === "closed" || test.status === "archived") {
    throw new AuthzError(400, "Test is already closed or archived.");
  }

  const updated = await updateTest(input.testId, { status: "closed" });
  if (!updated) throw new Error("Failed to close test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.closed",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

/**
 * Archive: the non-destructive way to retire a test students have attempted
 * (delete is refused for those). Hidden from students' lists like a closed
 * test; every attempt and result is kept. Refused while someone is mid-attempt.
 */
export async function archiveTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const test = await getTestById(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (test.status === "archived") {
    throw new AuthzError(400, "Test is already archived.");
  }
  enforce(archiveRefusal(await loadTestActivity(input.testId)));

  const updated = await updateTest(input.testId, { status: "archived" });
  if (!updated) throw new Error("Failed to archive test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.archived",
    before: test,
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}
