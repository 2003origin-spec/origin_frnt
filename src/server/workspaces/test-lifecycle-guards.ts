/**
 * Lifecycle guards for teacher tests (delete / edit / schedule / archive).
 *
 * Nothing in the codebase ever sets a test's status to `live` (publish →
 * `published`, schedule → `scheduled`, close → `closed`), so guards written as
 * `status === "live"` never fired: a published test that students had already
 * sat could be deleted (cascading away their attempts) or have its questions
 * swapped mid-attempt. "Live" is therefore DERIVED here from what is actually
 * true about the test right now:
 *
 *   live = published AND (it has student attempts OR an assignment window is open)
 *
 * "Live" blocks only the edits that would corrupt attempts — the question set,
 * marks (per question or the scoring/selection policy) and the duration. Title,
 * description, instructions and display settings stay editable.
 *
 * A `live` status is still honoured should anything ever set it. Pure: callers
 * load {@link TeacherTestActivity} (tests-store `getTeacherTestActivity`) and
 * throw the refusal these functions return.
 */

import { canonicalNegativeMarks } from "@/lib/assessments/source-stack";

import type { AssessmentTest, TestQuestion, TestStatus } from "./types";

export type TeacherTestActivity = {
  status: TestStatus;
  /**
   * Attempts that hold student work: submitted, or with at least one saved
   * answer (the larger of that and the persisted results). A student who only
   * OPENED the paper does not count, or one look would freeze the test forever.
   */
  attemptCount: number;
  /** Attempts in progress right now (status in_progress, deadline not passed). */
  inProgressAttemptCount: number;
  /** An active assignment whose window contains NOW() (null bounds are unbounded). */
  hasOpenWindow: boolean;
};

export type TestLifecycleRefusalCode =
  | "test_has_attempts"
  | "test_live"
  | "test_in_progress"
  | "test_not_editable"
  | "test_no_questions"
  | "test_invalid_window";

export type TestLifecycleRefusal = {
  status: 400 | 409;
  code: TestLifecycleRefusalCode;
  message: string;
};

/** A guard refusal; `handleTeacherError` maps it to `{ detail, code }` with its status. */
export class TestLifecycleError extends Error {
  readonly status: 400 | 409;
  readonly code: TestLifecycleRefusalCode;

  constructor(refusal: TestLifecycleRefusal) {
    super(refusal.message);
    this.name = "TestLifecycleError";
    this.status = refusal.status;
    this.code = refusal.code;
  }
}

/** Throws the refusal, if any. */
export function enforce(refusal: TestLifecycleRefusal | null): void {
  if (refusal) throw new TestLifecycleError(refusal);
}

export function isTeacherTestLive(activity: TeacherTestActivity): boolean {
  if (activity.status === "live") return true;
  return activity.status === "published" && (activity.attemptCount > 0 || activity.hasOpenWindow);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Delete cascades to assignments, attempts and answers, so it is refused for any
 * test that students have attempted (whatever its status): archive keeps the
 * results. A live test with no attempts yet (window open) must be closed first.
 */
export function deleteRefusal(activity: TeacherTestActivity): TestLifecycleRefusal | null {
  if (activity.attemptCount > 0) {
    return {
      status: 409,
      code: "test_has_attempts",
      message: `This test has ${plural(activity.attemptCount, "student attempt")}. Deleting it would erase their results, so archive it instead.`,
    };
  }
  if (isTeacherTestLive(activity)) {
    return {
      status: 409,
      code: "test_live",
      message: "This test is open to students right now, so it cannot be deleted. Archive it to take it down.",
    };
  }
  return null;
}

/**
 * Edits: closed/archived tests are frozen; a question set may never be emptied;
 * a live test (attempted, or its window open) refuses only changes that would
 * corrupt attempts (`changesGrading`: questions, marks, duration), since
 * students' answers and scores are keyed to them. Metadata edits pass.
 */
export function editRefusal(
  activity: TeacherTestActivity,
  change: { replacingQuestions: boolean; questionCount: number; changesGrading: boolean },
): TestLifecycleRefusal | null {
  if (activity.status === "closed" || activity.status === "archived") {
    return { status: 400, code: "test_not_editable", message: "Cannot edit a closed or archived test." };
  }
  if (change.replacingQuestions && change.questionCount === 0) {
    return { status: 400, code: "test_no_questions", message: "A test needs at least one question." };
  }
  if (change.changesGrading && isTeacherTestLive(activity)) {
    const why =
      activity.attemptCount > 0
        ? `This test has ${plural(activity.attemptCount, "student attempt")}`
        : "This test is open to students right now";
    return {
      status: 409,
      code: "test_live",
      message: `${why}, so its questions, marks and duration can no longer change. You can still edit its title, description and instructions.`,
    };
  }
  return null;
}

/** The parts of an incoming question that decide grading. */
export type GradedQuestionInput = {
  position: number;
  sourceBank: string;
  ogcodeQuestionId?: string | null;
  contentQuestionId?: string | null;
  marks?: number;
  negativeMarks?: number;
  metadata?: Record<string, unknown>;
};

function gradedKey(q: {
  position: number;
  sourceBank: string;
  ogcodeQuestionId?: string | null;
  contentQuestionId?: string | null;
  marks?: number;
  negativeMarks?: number;
  metadata?: Record<string, unknown>;
}): string {
  return JSON.stringify([
    q.position,
    q.sourceBank,
    q.ogcodeQuestionId ?? null,
    q.contentQuestionId ?? null,
    Number(q.marks ?? 4),
    canonicalNegativeMarks(q.negativeMarks ?? -1),
    (q.metadata?.sectionId as string | undefined) ?? null,
  ]);
}

/**
 * Does `incoming` differ from the stored set in anything grading depends on?
 * The editor always resends the full question list, so an unchanged list must
 * read as "no change" or every metadata save of a live test would be refused.
 */
export function questionSetChanged(
  existing: readonly Pick<TestQuestion, "position" | "sourceBank" | "ogcodeQuestionId" | "contentQuestionId" | "marks" | "negativeMarks" | "metadata">[],
  incoming: readonly GradedQuestionInput[],
): boolean {
  if (existing.length !== incoming.length) return true;
  const a = [...existing].sort((x, y) => x.position - y.position).map(gradedKey);
  const b = [...incoming].sort((x, y) => x.position - y.position).map(gradedKey);
  return a.some((key, i) => key !== b[i]);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Does a metadata patch touch the duration or the selection policy?
 *
 * NOT `scoringPolicy`: `assessment.tests.scoring_policy` is never read at grade
 * time — per-question marks are the authority (see full-test-generator.ts and
 * `scoringPolicyForQuestion`), and those are compared by {@link questionSetChanged}.
 * The wizard (the only edit UI) sends `{positive, negative}` on every save, while
 * CreateTestDialog / room / source-stack tests store `{}` and full-length mocks
 * an `exam_blueprint`, so comparing it refused a title-only edit of every live
 * test not made by the wizard (R4-2) and protected nothing.
 */
export function gradingPatchChanged(
  existing: Pick<AssessmentTest, "durationMinutes" | "selectionPolicy">,
  patch: { durationMinutes?: number; scoringPolicy?: Record<string, unknown>; selectionPolicy?: Record<string, unknown> },
): boolean {
  if (patch.durationMinutes !== undefined && Number(patch.durationMinutes) !== Number(existing.durationMinutes)) {
    return true;
  }
  if (
    patch.selectionPolicy !== undefined &&
    stableJson(patch.selectionPolicy) !== stableJson(existing.selectionPolicy ?? {})
  ) {
    return true;
  }
  return false;
}

/**
 * Re-checked INSIDE the question-replacement transaction (with the test row
 * locked), so an attempt that started after the pre-check still blocks it.
 */
export function questionReplacementRefusal(inProgressAttemptCount: number): TestLifecycleRefusal | null {
  if (inProgressAttemptCount > 0) {
    const who = inProgressAttemptCount === 1 ? "1 student is" : `${inProgressAttemptCount} students are`;
    return {
      status: 409,
      code: "test_in_progress",
      message: `${who} taking this test right now. Questions cannot be replaced mid-attempt.`,
    };
  }
  return null;
}

/** Scheduling needs questions (publish already requires them) and a sane window. */
export function scheduleRefusal(input: {
  questionCount: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
}): TestLifecycleRefusal | null {
  if (input.questionCount === 0) {
    return { status: 400, code: "test_no_questions", message: "Cannot schedule a test with no questions." };
  }
  return windowRefusal(input.scheduledStartAt, input.scheduledEndAt);
}

/** An assignment window must end after it starts (either bound may be absent). */
export function windowRefusal(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): TestLifecycleRefusal | null {
  if (!startsAt || !endsAt) return null;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { status: 400, code: "test_invalid_window", message: "The test window must end after it starts." };
  }
  return null;
}

/**
 * Replacing an assignment's window while students are mid-sitting. The submit
 * gate reads the LIVE window (a sitting must have started inside it and the
 * submit must land before its end + grace), so a start moved later or an end
 * moved earlier would refuse the work of students already sitting. While
 * anyone is, the window may only grow: start no later, end no earlier (a null
 * bound is unbounded). Checked inside the replacement transaction.
 */
export function windowReplacementRefusal(input: {
  inProgressAttemptCount: number;
  before: { scheduledStartAt: string | null; scheduledEndAt: string | null };
  after: { scheduledStartAt: string | null; scheduledEndAt: string | null };
}): TestLifecycleRefusal | null {
  if (input.inProgressAttemptCount <= 0) return null;
  const ms = (iso: string | null, unbounded: number) => (iso ? new Date(iso).getTime() : unbounded);
  const startsLater =
    ms(input.after.scheduledStartAt, -Infinity) > ms(input.before.scheduledStartAt, -Infinity);
  const endsEarlier = ms(input.after.scheduledEndAt, Infinity) < ms(input.before.scheduledEndAt, Infinity);
  if (!startsLater && !endsEarlier) return null;
  const who =
    input.inProgressAttemptCount === 1 ? "1 student is" : `${input.inProgressAttemptCount} students are`;
  return {
    status: 409,
    code: "test_in_progress",
    message: `${who} taking this test right now, so its window can only be extended (start no later, end no earlier) until they finish.`,
  };
}

/** Archiving hides the test from students, so not while someone is mid-attempt. */
export function archiveRefusal(activity: TeacherTestActivity): TestLifecycleRefusal | null {
  if (activity.inProgressAttemptCount > 0) {
    return {
      status: 409,
      code: "test_in_progress",
      message: "Students are taking this test right now. Archive it after their attempts end.",
    };
  }
  return null;
}
