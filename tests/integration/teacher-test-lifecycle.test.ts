/**
 * Teacher test lifecycle guards against Postgres: delete is refused for a test
 * students have attempted (archive works instead) and while its window is open;
 * question replacement is one transaction and is refused mid-attempt; a
 * zero-question draft cannot be scheduled.
 * Runs only when USER_DATABASE_URL is configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  TestLifecycleError,
  enforce,
  questionReplacementRefusal,
} from "@/server/workspaces/test-lifecycle-guards";
import {
  addQuestionToTest,
  createAssignment,
  createTest,
  getTestById,
  listTestQuestions,
  recordTeacherTestAttemptStart,
  replaceTestQuestions,
} from "@/server/workspaces/tests-store";
import {
  archiveTeacherTest,
  assignTestToBatches,
  deleteTeacherTest,
  scheduleTeacherTest,
  updateTeacherTest,
} from "@/server/workspaces/tests-service";

import { cleanup, closePool, dbConfigured, rawPool, seedFixtures, type Fixtures } from "./_db";

const SKIP = !dbConfigured();

const refusedWith = (code: string) => (error: unknown) =>
  error instanceof TestLifecycleError && error.code === code;

async function publishedTest(fx: Fixtures, title: string) {
  const t = await createTest({
    workspaceId: fx.workspaceId,
    createdBy: fx.ownerId,
    title,
    durationMinutes: 60,
    totalQuestions: 1,
    status: "published",
  });
  await addQuestionToTest({ testId: t.id, position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_lifecycle_1" });
  return t;
}

test("delete guard: attempted → refused (archive instead); open window → refused; idle → deleted", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const actor = { actorUserId: fx.ownerId, workspaceId: fx.workspaceId };
  try {
    // 1. A test a student has sat: delete refused, nothing cascaded, archive works.
    const sat = await publishedTest(fx, "Last week's mock");
    const attempt = await recordTeacherTestAttemptStart({
      testId: sat.id,
      studentId: fx.studentId,
      assignmentId: null,
      workspaceId: fx.workspaceId,
      batchId: null,
      durationMinutes: 60,
      windowEndsAt: null,
      graceSeconds: 60,
    });
    await rawPool().query(
      `UPDATE assessment.test_attempts SET status = 'submitted', submitted_at = NOW() WHERE id = $1`,
      [attempt.id],
    );
    await assert.rejects(deleteTeacherTest({ ...actor, testId: sat.id }), refusedWith("test_has_attempts"));
    assert.ok(await getTestById(sat.id), "the test survives");
    const kept = await rawPool().query(`SELECT 1 FROM assessment.test_attempts WHERE id = $1`, [attempt.id]);
    assert.equal(kept.rowCount, 1, "the student's attempt survives");

    const archived = await archiveTeacherTest({ ...actor, testId: sat.id });
    assert.equal(archived.status, "archived");
    await assert.rejects(
      deleteTeacherTest({ ...actor, testId: sat.id }),
      refusedWith("test_has_attempts"),
      "still not deletable once archived",
    );

    // 2. Published, no attempts yet, but its window is open: close first.
    const open = await publishedTest(fx, "Open now");
    await createAssignment({
      testId: open.id,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      scheduledStartAt: new Date(Date.now() - 3_600_000).toISOString(),
      scheduledEndAt: new Date(Date.now() + 3_600_000).toISOString(),
      assignedBy: fx.ownerId,
    });
    await assert.rejects(deleteTeacherTest({ ...actor, testId: open.id }), refusedWith("test_live"));

    // 3. Published, window over, never attempted: deletable.
    const idle = await publishedTest(fx, "Nobody sat it");
    await createAssignment({
      testId: idle.id,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      scheduledStartAt: new Date(Date.now() - 7_200_000).toISOString(),
      scheduledEndAt: new Date(Date.now() - 3_600_000).toISOString(),
      assignedBy: fx.ownerId,
    });
    await deleteTeacherTest({ ...actor, testId: idle.id });
    assert.equal(await getTestById(idle.id), null);
  } finally {
    await cleanup(fx);
  }
});

test("archive guard: refused while a student is mid-attempt", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const t = await publishedTest(fx, "Being written");
    await recordTeacherTestAttemptStart({
      testId: t.id,
      studentId: fx.studentId,
      assignmentId: null,
      workspaceId: fx.workspaceId,
      batchId: null,
      durationMinutes: 60,
      windowEndsAt: null,
      graceSeconds: 60,
    });
    await assert.rejects(
      archiveTeacherTest({ actorUserId: fx.ownerId, workspaceId: fx.workspaceId, testId: t.id }),
      refusedWith("test_in_progress"),
    );
  } finally {
    await cleanup(fx);
  }
});

test("question replacement is transactional and refused mid-attempt", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const t = await publishedTest(fx, "Typo fix");
    const guard = ({ inProgressAttemptCount }: { inProgressAttemptCount: number }) =>
      enforce(questionReplacementRefusal(inProgressAttemptCount));

    // No one mid-attempt: replaced atomically, total_questions mirrored.
    await replaceTestQuestions(
      t.id,
      [
        { position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_lifecycle_a" },
        { position: 2, sourceBank: "ogcode", ogcodeQuestionId: "ogq_lifecycle_b" },
      ],
      guard,
    );
    assert.deepEqual((await listTestQuestions(t.id)).map((q) => q.ogcodeQuestionId), ["ogq_lifecycle_a", "ogq_lifecycle_b"]);
    assert.equal((await getTestById(t.id))?.totalQuestions, 2);

    // A failing insert rolls back the clear: the paper is never left empty.
    await assert.rejects(
      replaceTestQuestions(t.id, [
        // Invalid enum value → the INSERT fails after the DELETE ran.
        { position: 1, sourceBank: "not_a_bank" as never, ogcodeQuestionId: "ogq_lifecycle_x" },
      ]),
    );
    assert.equal((await listTestQuestions(t.id)).length, 2, "the clear was rolled back");

    // A student starts: replacement refused under the lock, questions intact.
    await recordTeacherTestAttemptStart({
      testId: t.id,
      studentId: fx.studentId,
      assignmentId: null,
      workspaceId: fx.workspaceId,
      batchId: null,
      durationMinutes: 60,
      windowEndsAt: null,
      graceSeconds: 60,
    });
    await assert.rejects(
      replaceTestQuestions(t.id, [{ position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_lifecycle_c" }], guard),
      refusedWith("test_in_progress"),
    );
    assert.equal((await listTestQuestions(t.id)).length, 2);
  } finally {
    await cleanup(fx);
  }
});

test("edit guard: an opened-only paper never freezes it; a live test still takes metadata edits", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const actor = { actorUserId: fx.ownerId, workspaceId: fx.workspaceId };
  try {
    const t = await publishedTest(fx, "Opened, not answered");
    // A student opens the paper (attempt row, no answers) and walks away.
    const opened = await recordTeacherTestAttemptStart({
      testId: t.id,
      studentId: fx.studentId,
      assignmentId: null,
      workspaceId: fx.workspaceId,
      batchId: null,
      durationMinutes: 60,
      windowEndsAt: null,
      graceSeconds: 60,
    });
    await rawPool().query(`UPDATE assessment.test_attempts SET status = 'timed_out' WHERE id = $1`, [opened.id]);
    // Not live: even the duration may change, and the test is deletable later.
    await updateTeacherTest({ ...actor, testId: t.id, patch: { durationMinutes: 45 } });
    assert.equal((await getTestById(t.id))?.durationMinutes, 45);

    // Open-ended assignment → live: duration refused, title allowed.
    await createAssignment({ testId: t.id, workspaceId: fx.workspaceId, batchId: fx.batchId, assignedBy: fx.ownerId });
    await assert.rejects(
      updateTeacherTest({ ...actor, testId: t.id, patch: { durationMinutes: 30 } }),
      refusedWith("test_live"),
    );
    await updateTeacherTest({
      ...actor,
      testId: t.id,
      patch: { title: "Opened, not answered (fixed typo)", durationMinutes: 45 },
      // The editor resends the unchanged paper.
      questions: [{ position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_lifecycle_1", marks: 4, negativeMarks: 1 }],
    });
    assert.equal((await getTestById(t.id))?.title, "Opened, not answered (fixed typo)");
  } finally {
    await cleanup(fx);
  }
});

test("edit guard (R4-2): a wizard title-only save of a live CreateTestDialog test passes", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const actor = { actorUserId: fx.ownerId, workspaceId: fx.workspaceId };
  try {
    // CreateTestDialog shape: no scoringPolicy sent, so `{}` is stored.
    const t = await publishedTest(fx, "Unit test 3");
    assert.deepEqual((await getTestById(t.id))?.scoringPolicy, {});
    // Live: an open-ended assignment.
    await createAssignment({ testId: t.id, workspaceId: fx.workspaceId, batchId: fx.batchId, assignedBy: fx.ownerId });

    // Exactly what TestCreatorWizard PATCHes on a title fix: every field, the
    // default {positive, negative} policy, and the unchanged paper.
    await updateTeacherTest({
      ...actor,
      testId: t.id,
      patch: {
        title: "Unit Test 3",
        description: null,
        subject: "physics",
        difficulty: "medium",
        durationMinutes: 60,
        scoringPolicy: { positive: 4, negative: 1 },
        settings: { shuffle: false, autoSubmit: true, hideLeaderboard: false },
      },
      questions: [{ position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_lifecycle_1", marks: 4, negativeMarks: 1 }],
    });
    assert.equal((await getTestById(t.id))?.title, "Unit Test 3");

    // A real grading change is still refused.
    await assert.rejects(
      updateTeacherTest({
        ...actor,
        testId: t.id,
        patch: { title: "Unit Test 3", durationMinutes: 60 },
        questions: [{ position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_lifecycle_1", marks: 3, negativeMarks: 1 }],
      }),
      refusedWith("test_live"),
    );
  } finally {
    await cleanup(fx);
  }
});

test("deliver (R4-3): re-assigning a batch never duplicates; the window changes only on purpose", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const actor = { actorUserId: fx.ownerId, workspaceId: fx.workspaceId };
  const iso = (offsetMinutes: number) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();
  const rows = async (testId: string) =>
    (
      await rawPool().query(
        `SELECT id, scheduled_start_at, scheduled_end_at FROM assessment.test_assignments
          WHERE test_id = $1 ORDER BY assigned_at`,
        [testId],
      )
    ).rows;
  try {
    const t = await publishedTest(fx, "Live mock");
    // Original window 10:00–11:00 (around now: the test is live).
    const original = { scheduledStartAt: iso(-30), scheduledEndAt: iso(30) };
    const [first] = await assignTestToBatches({ ...actor, testId: t.id, batchIds: [fx.batchId], ...original });
    assert.equal((await rows(t.id)).length, 1);

    // A metadata save re-runs Deliver with the pre-filled window: nothing new.
    const [again] = await assignTestToBatches({ ...actor, testId: t.id, batchIds: [fx.batchId], ...original });
    assert.equal(again.id, first.id);
    assert.equal((await rows(t.id)).length, 1, "no duplicate assignment");

    // The reviewer's case: the teacher re-typed 10:00–12:00 without meaning to
    // reschedule. No duplicate, and the window is NOT silently extended.
    const retyped = { scheduledStartAt: original.scheduledStartAt, scheduledEndAt: iso(90) };
    await assignTestToBatches({ ...actor, testId: t.id, batchIds: [fx.batchId], ...retyped });
    let current = await rows(t.id);
    assert.equal(current.length, 1);
    assert.equal(new Date(current[0].scheduled_end_at).toISOString(), original.scheduledEndAt, "window unchanged");

    // An explicit window edit replaces the existing window — still one row.
    await assignTestToBatches({ ...actor, testId: t.id, batchIds: [fx.batchId], ...retyped, replaceWindow: true });
    current = await rows(t.id);
    assert.equal(current.length, 1);
    assert.equal(current[0].id, first.id);
    assert.equal(new Date(current[0].scheduled_end_at).toISOString(), retyped.scheduledEndAt, "window replaced");

    // A non-overlapping window (a re-run tomorrow) is a new assignment.
    await assignTestToBatches({
      ...actor,
      testId: t.id,
      batchIds: [fx.batchId],
      scheduledStartAt: iso(24 * 60),
      scheduledEndAt: iso(25 * 60),
    });
    assert.equal((await rows(t.id)).length, 2, "a later re-run is its own assignment");
  } finally {
    await cleanup(fx);
  }
});

test("deliver (R5-M1/M2): an explicit window edit replaces the assignment, never mid-sitting", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const actor = { actorUserId: fx.ownerId, workspaceId: fx.workspaceId };
  const iso = (offsetMinutes: number) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();
  const active = async (testId: string) =>
    (
      await rawPool().query(
        `SELECT id, scheduled_start_at, scheduled_end_at FROM assessment.test_assignments
          WHERE test_id = $1 AND status IN ('assigned', 'open') ORDER BY assigned_at`,
        [testId],
      )
    ).rows;
  try {
    // M1: an upcoming test postponed by a week (non-overlapping dates) moves the
    // one assignment — the old window does not stay open beside the new one.
    const upcoming = await publishedTest(fx, "Upcoming mock");
    const [first] = await assignTestToBatches({
      ...actor,
      testId: upcoming.id,
      batchIds: [fx.batchId],
      scheduledStartAt: iso(60),
      scheduledEndAt: iso(120),
    });
    const postponed = { scheduledStartAt: iso(7 * 24 * 60 + 60), scheduledEndAt: iso(7 * 24 * 60 + 120) };
    const [moved] = await assignTestToBatches({
      ...actor,
      testId: upcoming.id,
      batchIds: [fx.batchId],
      ...postponed,
      replaceWindow: true,
      assignmentId: first.id,
    });
    let current = await active(upcoming.id);
    assert.equal(current.length, 1, "no second window");
    assert.equal(moved.id, first.id);
    assert.equal(new Date(current[0].scheduled_start_at).toISOString(), postponed.scheduledStartAt, "postponed");
    // Re-running Deliver with the (new) unchanged window stays a no-op.
    await assignTestToBatches({ ...actor, testId: upcoming.id, batchIds: [fx.batchId], ...postponed });
    assert.equal((await active(upcoming.id)).length, 1);

    // M2: a live window with a student mid-sitting may only grow.
    const live = await publishedTest(fx, "Live mock, student sitting");
    const original = { scheduledStartAt: iso(-30), scheduledEndAt: iso(30) };
    const [liveAssignment] = await assignTestToBatches({
      ...actor,
      testId: live.id,
      batchIds: [fx.batchId],
      ...original,
    });
    await recordTeacherTestAttemptStart({
      testId: live.id,
      studentId: fx.studentId,
      assignmentId: liveAssignment.id,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      durationMinutes: 60,
      windowEndsAt: original.scheduledEndAt,
      graceSeconds: 60,
    });
    const replace = (scheduledStartAt: string, scheduledEndAt: string) =>
      assignTestToBatches({
        ...actor,
        testId: live.id,
        batchIds: [fx.batchId],
        scheduledStartAt,
        scheduledEndAt,
        replaceWindow: true,
        assignmentId: liveAssignment.id,
      });
    await assert.rejects(replace(original.scheduledStartAt, iso(-1)), refusedWith("test_in_progress"), "end pulled before now");
    await assert.rejects(replace(iso(5), iso(60)), refusedWith("test_in_progress"), "start pushed into the future");
    await assert.rejects(replace(iso(24 * 60), iso(25 * 60)), refusedWith("test_in_progress"), "postponed mid-sitting");
    current = await active(live.id);
    assert.equal(current.length, 1);
    assert.equal(new Date(current[0].scheduled_end_at).toISOString(), original.scheduledEndAt, "window untouched");
    // Extending the end is fine.
    const extendedEnd = iso(45);
    await replace(original.scheduledStartAt, extendedEnd);
    current = await active(live.id);
    assert.equal(current.length, 1);
    assert.equal(new Date(current[0].scheduled_end_at).toISOString(), extendedEnd, "extended");
  } finally {
    await cleanup(fx);
  }
});

test("schedule guard: a zero-question draft cannot be scheduled", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const empty = await createTest({
      workspaceId: fx.workspaceId,
      createdBy: fx.ownerId,
      title: "Empty draft",
      durationMinutes: 30,
      totalQuestions: 0,
    });
    await assert.rejects(
      scheduleTeacherTest({
        actorUserId: fx.ownerId,
        workspaceId: fx.workspaceId,
        testId: empty.id,
        scheduledStartAt: new Date(Date.now() + 86_400_000).toISOString(),
        scheduledEndAt: new Date(Date.now() + 90_000_000).toISOString(),
      }),
      refusedWith("test_no_questions"),
    );
    assert.equal((await getTestById(empty.id))?.status, "draft");
  } finally {
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
