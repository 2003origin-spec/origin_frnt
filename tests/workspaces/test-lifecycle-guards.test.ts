/**
 * Teacher test lifecycle guards (src/server/workspaces/test-lifecycle-guards.ts).
 * "Live" is derived — nothing ever sets status `live` — so these rules are what
 * actually protect a test that students have sat or are sitting.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  TestLifecycleError,
  archiveRefusal,
  deleteRefusal,
  editRefusal,
  enforce,
  gradingPatchChanged,
  isTeacherTestLive,
  questionReplacementRefusal,
  questionSetChanged,
  scheduleRefusal,
  windowRefusal,
  windowReplacementRefusal,
  type TeacherTestActivity,
} from "@/server/workspaces/test-lifecycle-guards";

const idle = (over: Partial<TeacherTestActivity> = {}): TeacherTestActivity => ({
  status: "published",
  attemptCount: 0,
  inProgressAttemptCount: 0,
  hasOpenWindow: false,
  ...over,
});

test("live = published AND (attempted OR window open); a literal `live` status still counts", () => {
  assert.equal(isTeacherTestLive(idle()), false);
  assert.equal(isTeacherTestLive(idle({ attemptCount: 1 })), true);
  assert.equal(isTeacherTestLive(idle({ hasOpenWindow: true })), true);
  assert.equal(isTeacherTestLive(idle({ status: "draft", hasOpenWindow: true })), false);
  assert.equal(isTeacherTestLive(idle({ status: "closed", attemptCount: 3 })), false);
  assert.equal(isTeacherTestLive(idle({ status: "live" })), true);
});

test("delete: refused with attempts (any status) → archive; refused while the window is open", () => {
  const attempted = deleteRefusal(idle({ attemptCount: 2 }));
  assert.equal(attempted?.status, 409);
  assert.equal(attempted?.code, "test_has_attempts");
  assert.match(attempted?.message ?? "", /2 student attempts.*archive/i);
  assert.equal(deleteRefusal(idle({ status: "closed", attemptCount: 1 }))?.code, "test_has_attempts");
  assert.equal(deleteRefusal(idle({ status: "draft", attemptCount: 1 }))?.code, "test_has_attempts");

  assert.equal(deleteRefusal(idle({ hasOpenWindow: true }))?.code, "test_live");
  assert.equal(deleteRefusal(idle()), null, "published, never attempted, window shut → deletable");
  assert.equal(deleteRefusal(idle({ status: "draft" })), null);
  assert.equal(deleteRefusal(idle({ status: "closed" })), null);
});

test("edit: closed/archived frozen; empty question set refused; live refuses grading changes only", () => {
  const replace = (n: number) => ({ replacingQuestions: true, questionCount: n, changesGrading: true });
  const meta = { replacingQuestions: false, questionCount: 0, changesGrading: false };
  const duration = { replacingQuestions: false, questionCount: 0, changesGrading: true };

  assert.equal(editRefusal(idle({ status: "closed" }), meta)?.code, "test_not_editable");
  assert.equal(editRefusal(idle({ status: "archived" }), meta)?.code, "test_not_editable");
  assert.equal(editRefusal(idle({ status: "draft" }), replace(0))?.code, "test_no_questions");
  assert.equal(editRefusal(idle(), replace(0))?.code, "test_no_questions");

  const live = editRefusal(idle({ attemptCount: 4 }), replace(10));
  assert.equal(live?.status, 409);
  assert.equal(live?.code, "test_live");
  assert.equal(editRefusal(idle({ hasOpenWindow: true }), duration)?.code, "test_live");
  assert.match(editRefusal(idle({ hasOpenWindow: true }), duration)?.message ?? "", /title, description and instructions/);

  // Title / description / instructions stay editable on a live test, whether it
  // is live through attempts or through an open-ended window.
  assert.equal(editRefusal(idle({ attemptCount: 4 }), meta), null);
  assert.equal(editRefusal(idle({ hasOpenWindow: true }), meta), null);
  // The editor resends an unchanged list: not a grading change, so it passes.
  assert.equal(editRefusal(idle({ attemptCount: 4 }), { ...replace(10), changesGrading: false }), null);

  assert.equal(editRefusal(idle(), replace(10)), null, "published but idle → editable");
  assert.equal(editRefusal(idle({ status: "draft", hasOpenWindow: true }), replace(5)), null);
});

test("question replacement: refused while anyone is mid-attempt (checked under the row lock)", () => {
  assert.equal(questionReplacementRefusal(0), null);
  const one = questionReplacementRefusal(1);
  assert.equal(one?.status, 409);
  assert.equal(one?.code, "test_in_progress");
  assert.match(one?.message ?? "", /^1 student is taking/);
  assert.match(questionReplacementRefusal(3)?.message ?? "", /^3 students are taking/);
});

test("schedule: zero questions refused; the window must end after it starts", () => {
  const start = "2026-10-25T04:30:00.000Z";
  const end = "2026-10-25T07:30:00.000Z";
  assert.equal(scheduleRefusal({ questionCount: 0, scheduledStartAt: start, scheduledEndAt: end })?.code, "test_no_questions");
  assert.equal(scheduleRefusal({ questionCount: 5, scheduledStartAt: end, scheduledEndAt: start })?.code, "test_invalid_window");
  assert.equal(scheduleRefusal({ questionCount: 5, scheduledStartAt: start, scheduledEndAt: start })?.code, "test_invalid_window");
  assert.equal(scheduleRefusal({ questionCount: 5, scheduledStartAt: start, scheduledEndAt: end }), null);
  assert.equal(windowRefusal(null, end), null, "an open-ended bound is allowed");
  assert.equal(windowRefusal(start, undefined), null);
});

test("archive: allowed with finished attempts, refused while someone is mid-attempt", () => {
  assert.equal(archiveRefusal(idle({ attemptCount: 9 })), null);
  assert.equal(archiveRefusal(idle({ attemptCount: 9, inProgressAttemptCount: 1 }))?.code, "test_in_progress");
});

test("enforce throws a TestLifecycleError carrying status + code", () => {
  assert.doesNotThrow(() => enforce(null));
  assert.throws(
    () => enforce(deleteRefusal(idle({ attemptCount: 1 }))),
    (error: unknown) =>
      error instanceof TestLifecycleError && error.status === 409 && error.code === "test_has_attempts",
  );
});

test("questionSetChanged: only differences grading depends on count", () => {
  const stored = [
    { position: 2, sourceBank: "workspace_bag" as const, ogcodeQuestionId: null, contentQuestionId: "cq_1", marks: 4, negativeMarks: -1, metadata: {} },
    { position: 1, sourceBank: "ogcode" as const, ogcodeQuestionId: "og_1", contentQuestionId: null, marks: 4, negativeMarks: -1, metadata: { sectionId: "phy" } },
  ];
  const resent = [
    // Editor shape: positive negative marks, missing optional ids, any order.
    { position: 1, sourceBank: "ogcode", ogcodeQuestionId: "og_1", marks: 4, negativeMarks: 1, metadata: { sectionId: "phy" } },
    { position: 2, sourceBank: "workspace_bag", contentQuestionId: "cq_1", marks: 4, negativeMarks: 1 },
  ];
  assert.equal(questionSetChanged(stored, resent), false, "same paper resent → unchanged");
  assert.equal(questionSetChanged(stored, resent.slice(0, 1)), true, "a question removed");
  assert.equal(questionSetChanged(stored, [resent[0], { ...resent[1], marks: 3 }]), true, "marks changed");
  assert.equal(questionSetChanged(stored, [resent[0], { ...resent[1], negativeMarks: 0 }]), true, "negative marking removed");
  assert.equal(questionSetChanged(stored, [{ ...resent[0], ogcodeQuestionId: "og_2" }, resent[1]]), true, "question swapped");
  assert.equal(
    questionSetChanged(stored, [{ ...resent[0], position: 2 }, { ...resent[1], position: 1 }]),
    true,
    "questions reordered",
  );
});

test("gradingPatchChanged: duration and selection policy only — never the unread scoringPolicy", () => {
  const existing = { durationMinutes: 60, scoringPolicy: { positive: 4, negative: -1 }, selectionPolicy: {} };
  assert.equal(gradingPatchChanged(existing, {}), false);
  assert.equal(gradingPatchChanged(existing, { durationMinutes: 60, scoringPolicy: { negative: -1, positive: 4 } }), false);
  assert.equal(gradingPatchChanged(existing, { durationMinutes: 90 }), true);
  assert.equal(gradingPatchChanged(existing, { selectionPolicy: { kind: "full_length_mock" } }), true);
  // R4-2: per-question marks grade the paper; the test-level policy is not read.
  assert.equal(gradingPatchChanged(existing, { scoringPolicy: { positive: 3, negative: -1 } }), false);
  // A CreateTestDialog test stores `{}`; a full-length mock an exam blueprint.
  // The wizard's save sends `{positive, negative}` either way.
  const wizardSave = { durationMinutes: 60, scoringPolicy: { positive: 4, negative: 1 } };
  const dialogTest = { durationMinutes: 60, scoringPolicy: {}, selectionPolicy: {} };
  const fullLengthMock = {
    durationMinutes: 60,
    scoringPolicy: { kind: "exam_blueprint", preset: "jee_main", sections: [] },
    selectionPolicy: {},
  };
  assert.equal(gradingPatchChanged(dialogTest, wizardSave), false);
  assert.equal(gradingPatchChanged(fullLengthMock, wizardSave), false);
});

test("windowReplacementRefusal: while students sit, the window may only grow", () => {
  const before = { scheduledStartAt: "2026-10-22T10:00:00.000Z", scheduledEndAt: "2026-10-22T11:00:00.000Z" };
  const at = (start: string | null, end: string | null) => ({ scheduledStartAt: start, scheduledEndAt: end });
  // Nobody sitting: any replacement passes (postpone, shorten).
  assert.equal(
    windowReplacementRefusal({ inProgressAttemptCount: 0, before, after: at("2026-10-29T10:00:00.000Z", "2026-10-29T11:00:00.000Z") }),
    null,
  );
  // Sitting: extending the end, starting earlier, or opening a bound pass.
  for (const after of [
    at(before.scheduledStartAt, "2026-10-22T12:00:00.000Z"),
    at("2026-10-22T09:00:00.000Z", before.scheduledEndAt),
    at(null, null),
    at(before.scheduledStartAt, before.scheduledEndAt),
  ]) {
    assert.equal(windowReplacementRefusal({ inProgressAttemptCount: 2, before, after }), null);
  }
  // Sitting: pulling the end in, pushing the start out, postponing, or closing
  // an unbounded end are refused with 409 test_in_progress.
  for (const after of [
    at(before.scheduledStartAt, "2026-10-22T10:30:00.000Z"),
    at("2026-10-22T10:15:00.000Z", before.scheduledEndAt),
    at("2026-10-29T10:00:00.000Z", "2026-10-29T11:00:00.000Z"),
  ]) {
    const refusal = windowReplacementRefusal({ inProgressAttemptCount: 1, before, after });
    assert.equal(refusal?.status, 409);
    assert.equal(refusal?.code, "test_in_progress");
    assert.match(refusal!.message, /^1 student is taking this test/);
  }
  assert.equal(
    windowReplacementRefusal({
      inProgressAttemptCount: 3,
      before: at(before.scheduledStartAt, null),
      after: at(before.scheduledStartAt, "2026-10-22T11:00:00.000Z"),
    })?.code,
    "test_in_progress",
  );
});
