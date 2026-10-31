/**
 * Teacher-assigned test window — server enforcement end to end against Postgres.
 *
 * Before `scheduled_start_at` the test is listed but its paper is not served
 * (403 `test_not_started`, no attempt recorded). Inside the window the paper is
 * served and exactly one in-progress attempt is recorded per sitting. After
 * `scheduled_end_at` the paper is refused (409 `test_ended`) unless the attempt
 * began inside the window and the request is within the 60 s grace.
 * Runs only when USER_DATABASE_URL is configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";

import { beginTeacherTestSitting, getTestDetail, submitTest } from "@/legacy/assessments";
import type { AppStore, StoredUser } from "@/legacy/store";
import { isTestWindowError } from "@/lib/assessments/test-window";
import { addStudentsToBatches } from "@/server/workspaces/batches";
import {
  addQuestionToTest,
  createAssignment,
  createTest,
  getAssignedTestForStudent,
  listAssignedTestPreviewsForStudent,
  recordTeacherTestAttemptStart,
} from "@/server/workspaces/tests-store";

import { cleanup, closePool, dbConfigured, enrollFixtureStudent, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();

async function attemptsFor(testId: string, studentId: string) {
  const res = await rawPool().query(
    `SELECT id, status, started_at FROM assessment.test_attempts WHERE test_id = $1 AND student_id = $2
      ORDER BY started_at`,
    [testId, studentId],
  );
  return res.rows;
}

async function setWindow(assignmentId: string, startSql: string, endSql: string) {
  await rawPool().query(
    `UPDATE assessment.test_assignments
        SET scheduled_start_at = ${startSql}, scheduled_end_at = ${endSql}
      WHERE id = $1`,
    [assignmentId],
  );
}

async function detailError(store: AppStore, user: StoredUser, testId: string): Promise<unknown> {
  try {
    await getTestDetail(store, user, testId, { startAttempt: true });
    return null;
  } catch (error) {
    return error;
  }
}

test("teacher test window: upcoming → not served; open → served once; ended → refused except grace", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    await enrollFixtureStudent(fx);
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: null,
    });
    const teacherTest = await createTest({
      workspaceId: fx.workspaceId,
      createdBy: fx.ownerId,
      title: "Sunday JEE Mock",
      subject: "physics",
      durationMinutes: 180,
      totalQuestions: 1,
      status: "published",
    });
    await addQuestionToTest({
      testId: teacherTest.id,
      position: 1,
      sourceBank: "ogcode",
      ogcodeQuestionId: "ogq_window_test",
    });
    const assignment = await createAssignment({
      testId: teacherTest.id,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      assignedBy: fx.ownerId,
    });

    const store = { tests: [], questions: [] } as unknown as AppStore;
    const user = { id: fx.studentId, role: "student" } as unknown as StoredUser;

    // ── Upcoming ──────────────────────────────────────────────────────────────
    await setWindow(assignment.id, "NOW() + INTERVAL '2 days'", "NOW() + INTERVAL '2 days 3 hours'");
    const previews = await listAssignedTestPreviewsForStudent(fx.studentId);
    const listed = previews.find((p) => p.id === teacherTest.id);
    assert.ok(listed, "an upcoming test is still listed");
    assert.ok(listed?.windowStartsAt && new Date(listed.windowStartsAt).getTime() > Date.now());

    const early = await detailError(store, user, teacherTest.id);
    assert.ok(isTestWindowError(early), "paper is refused before the window");
    assert.equal(early.code, "test_not_started");
    assert.equal(early.status, 403);
    assert.equal((await attemptsFor(teacherTest.id, fx.studentId)).length, 0, "no attempt before start");
    await assert.rejects(
      submitTest(store, user, teacherTest.id, { answers: [] }),
      (error: unknown) => isTestWindowError(error) && error.code === "test_not_started",
      "submit is refused before the window",
    );

    // ── Open ─────────────────────────────────────────────────────────────────
    await setWindow(assignment.id, "NOW() - INTERVAL '1 hour'", "NOW() + INTERVAL '2 hours'");
    const served = await getTestDetail(store, user, teacherTest.id, { startAttempt: true });
    assert.equal((served as { id: string }).id, teacherTest.id);
    // A reload in the same sitting reuses the attempt.
    await getTestDetail(store, user, teacherTest.id, { startAttempt: true });
    // A context read (no startAttempt) never opens one.
    await getTestDetail(store, user, teacherTest.id);
    const attempts = await attemptsFor(teacherTest.id, fx.studentId);
    assert.equal(attempts.length, 1, "exactly one attempt per sitting");
    assert.equal(attempts[0].status, "in_progress");

    // ── Ended, attempt began inside the window, within the grace ─────────────
    await rawPool().query(
      `UPDATE assessment.test_attempts SET started_at = NOW() - INTERVAL '30 minutes' WHERE id = $1`,
      [attempts[0].id],
    );
    await setWindow(assignment.id, "NOW() - INTERVAL '3 hours'", "NOW() - INTERVAL '20 seconds'");
    const inGrace = await getAssignedTestForStudent(fx.studentId, teacherTest.id);
    assert.equal(inGrace?.activeAttempt?.id, attempts[0].id);
    assert.equal(await detailError(store, user, teacherTest.id), null, "in-window attempt may finish within the grace");

    // ── Ended, past the grace ────────────────────────────────────────────────
    await setWindow(assignment.id, "NOW() - INTERVAL '3 hours'", "NOW() - INTERVAL '2 minutes'");
    const late = await detailError(store, user, teacherTest.id);
    assert.ok(isTestWindowError(late), "paper is refused after the window + grace");
    assert.equal(late.code, "test_ended");
    assert.equal(late.status, 409);
    await assert.rejects(
      submitTest(store, user, teacherTest.id, { answers: [] }),
      (error: unknown) => isTestWindowError(error) && error.code === "test_ended",
      "submit is refused after the window + grace",
    );

    // ── Ended, no attempt at all: no new attempt even a second after the bell ─
    await rawPool().query(`DELETE FROM assessment.test_attempts WHERE test_id = $1`, [teacherTest.id]);
    await setWindow(assignment.id, "NOW() - INTERVAL '3 hours'", "NOW() - INTERVAL '1 second'");
    const noAttempt = await detailError(store, user, teacherTest.id);
    assert.ok(isTestWindowError(noAttempt));
    assert.equal(noAttempt.code, "test_ended");
    assert.equal((await attemptsFor(teacherTest.id, fx.studentId)).length, 0, "no attempt opened after the end");
  } finally {
    await cleanup(fx);
  }
});

test("teacher test window: an open assignment wins over a closed one for the same student", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    await enrollFixtureStudent(fx);
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: null,
    });
    const teacherTest = await createTest({
      workspaceId: fx.workspaceId,
      createdBy: fx.ownerId,
      title: "Re-run Mock",
      durationMinutes: 60,
      totalQuestions: 1,
      status: "published",
    });
    const closed = await createAssignment({
      testId: teacherTest.id,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      assignedBy: fx.ownerId,
    });
    await setWindow(closed.id, "NOW() - INTERVAL '3 days'", "NOW() - INTERVAL '2 days'");
    const open = await createAssignment({
      testId: teacherTest.id,
      workspaceId: fx.workspaceId,
      studentId: fx.studentId,
      assignedBy: fx.ownerId,
    });
    await setWindow(open.id, "NOW() - INTERVAL '1 hour'", "NOW() + INTERVAL '1 hour'");

    const resolved = await getAssignedTestForStudent(fx.studentId, teacherTest.id);
    assert.equal(resolved?.assignmentId, open.id);
  } finally {
    await cleanup(fx);
  }
});

test("teacher test window: in the grace, the just-ended assignment beats an upcoming re-sit", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    await enrollFixtureStudent(fx);
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: null,
    });
    const teacherTest = await createTest({
      workspaceId: fx.workspaceId,
      createdBy: fx.ownerId,
      title: "Mock with a re-sit",
      durationMinutes: 60,
      totalQuestions: 1,
      status: "published",
    });
    await addQuestionToTest({ testId: teacherTest.id, position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_resit_1" });
    const main = await createAssignment({
      testId: teacherTest.id,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      assignedBy: fx.ownerId,
    });
    await setWindow(main.id, "NOW() - INTERVAL '1 hour'", "NOW() + INTERVAL '1 hour'");
    // The student starts inside the main window. (No assignment id on the row,
    // as for a sitting recorded without one: the window containing its start decides.)
    await recordTeacherTestAttemptStart({
      testId: teacherTest.id,
      studentId: fx.studentId,
      assignmentId: null,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      durationMinutes: 60,
      windowEndsAt: null,
      graceSeconds: 60,
    });
    assert.equal((await attemptsFor(teacherTest.id, fx.studentId)).length, 1);

    // The main window ended 20 s ago; a re-sit for absentees opens tomorrow.
    await setWindow(main.id, "NOW() - INTERVAL '2 hours'", "NOW() - INTERVAL '20 seconds'");
    await rawPool().query(
      `UPDATE assessment.test_attempts SET started_at = NOW() - INTERVAL '50 minutes' WHERE test_id = $1`,
      [teacherTest.id],
    );
    const resit = await createAssignment({
      testId: teacherTest.id,
      workspaceId: fx.workspaceId,
      studentId: fx.studentId,
      assignedBy: fx.ownerId,
    });
    await setWindow(resit.id, "NOW() + INTERVAL '1 day'", "NOW() + INTERVAL '1 day 2 hours'");

    const resolved = await getAssignedTestForStudent(fx.studentId, teacherTest.id);
    assert.equal(resolved?.assignmentId, main.id, "the attempt's own assignment wins in the grace");
    assert.ok(resolved?.activeAttempt, "the attempt is still in progress");
  } finally {
    await cleanup(fx);
  }
});

/**
 * R4-1, the reviewer's example: window 10:00–10:35, a 30-minute test. The
 * student loads the paper at 10:03 (the attempt row's deadline is
 * LEAST(10:33, 10:35) + 60 s = 10:34), reads the instructions and presses Start
 * at 10:07. The timer is capped at the window end, so the auto-submit lands at
 * 10:35:01 — after the row's load-time deadline. It must be accepted.
 * Simulated by shifting the rows so that NOW() is the moment in question.
 */
async function windowTest(fx: Awaited<ReturnType<typeof seedFixtures>>, title: string) {
  await enrollFixtureStudent(fx);
  await addStudentsToBatches({
    workspaceId: fx.workspaceId,
    batchIds: [fx.batchId],
    studentIds: [fx.studentId],
    assignedBy: null,
  });
  const teacherTest = await createTest({
    workspaceId: fx.workspaceId,
    createdBy: fx.ownerId,
    title,
    durationMinutes: 30,
    totalQuestions: 1,
    status: "published",
  });
  await addQuestionToTest({ testId: teacherTest.id, position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_r41_1" });
  const assignment = await createAssignment({
    testId: teacherTest.id,
    workspaceId: fx.workspaceId,
    batchId: fx.batchId,
    assignedBy: fx.ownerId,
  });
  return { teacherTest, assignment };
}

/** The window gate passed: submit either succeeded or failed for a non-window reason. */
async function submitNotRefusedByWindow(store: AppStore, user: StoredUser, testId: string) {
  const outcome = await submitTest(store, user, testId, { answers: [] }).then(
    () => null,
    (error: unknown) => error,
  );
  assert.ok(!isTestWindowError(outcome), `submit was refused by the window: ${String((outcome as Error)?.message)}`);
}

test("R4-1: load 10:03, Start never reached the server, auto-submit at 10:35:01 → accepted", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const { teacherTest, assignment } = await windowTest(fx, "Tight window, no Start record");
    const store = { tests: [], questions: [] } as unknown as AppStore;
    const user = { id: fx.studentId, role: "student" } as unknown as StoredUser;

    // 10:03 — the paper is served inside the window; the attempt row opens.
    await setWindow(assignment.id, "NOW() - INTERVAL '3 minutes'", "NOW() + INTERVAL '32 minutes'");
    await getTestDetail(store, user, teacherTest.id, { startAttempt: true });
    const [opened] = await attemptsFor(teacherTest.id, fx.studentId);
    assert.ok(opened, "the load opened an attempt");

    // Jump to 10:35:01: the window ended 1 s ago; the row (load 10:03,
    // deadline 10:34) expired 61 s ago.
    await setWindow(assignment.id, "NOW() - INTERVAL '35 minutes 1 second'", "NOW() - INTERVAL '1 second'");
    await rawPool().query(
      `UPDATE assessment.test_attempts
          SET started_at = NOW() - INTERVAL '32 minutes 1 second',
              server_deadline = NOW() - INTERVAL '61 seconds'
        WHERE id = $1`,
      [opened.id],
    );

    const judged = await getAssignedTestForStudent(fx.studentId, teacherTest.id);
    assert.equal(judged?.activeAttempt, null, "the row's own deadline has passed");
    assert.equal(judged?.windowAttempt?.id, opened.id, "but it is still the sitting the window judges");
    assert.equal(judged?.assignmentId, assignment.id);

    // A reload in the grace is served, and opens NO second attempt.
    assert.equal(await detailError(store, user, teacherTest.id), null, "reload in the grace is served");
    assert.equal((await attemptsFor(teacherTest.id, fx.studentId)).length, 1, "no new attempt in the grace");

    await submitNotRefusedByWindow(store, user, teacherTest.id);
    const [closed] = await attemptsFor(teacherTest.id, fx.studentId);
    assert.equal(closed.status, "submitted", "the submit closes the expired sitting");

    // Past the grace, the same expired sitting no longer earns anything.
    await setWindow(assignment.id, "NOW() - INTERVAL '37 minutes'", "NOW() - INTERVAL '2 minutes'");
    await assert.rejects(
      submitTest(store, user, teacherTest.id, { answers: [] }),
      (error: unknown) => isTestWindowError(error) && error.code === "test_ended",
    );
  } finally {
    await cleanup(fx);
  }
});

test("R4-1 / R5-L1: Start at 10:07 (inside the reading allowance) runs the clock from Start, capped at the window end; submit at 10:35:01 → accepted", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const { teacherTest, assignment } = await windowTest(fx, "Tight window, Start recorded");
    const store = { tests: [], questions: [] } as unknown as AppStore;
    const user = { id: fx.studentId, role: "student" } as unknown as StoredUser;

    // 10:03 — load.
    await setWindow(assignment.id, "NOW() - INTERVAL '3 minutes'", "NOW() + INTERVAL '32 minutes'");
    const served = (await getTestDetail(store, user, teacherTest.id, { startAttempt: true })) as {
      attemptEndsAt?: string | null;
    };
    assert.equal(served.attemptEndsAt ?? null, null, "no server end before Start");
    const [opened] = await attemptsFor(teacherTest.id, fx.studentId);

    // 10:07 — Start, four minutes later. Re-anchor: window 10:00–10:35 is now
    // NOW−7 min … NOW+28 min; the load (10:03) is NOW−4 min, deadline 10:34.
    await setWindow(assignment.id, "NOW() - INTERVAL '7 minutes'", "NOW() + INTERVAL '28 minutes'");
    await rawPool().query(
      `UPDATE assessment.test_attempts
          SET started_at = NOW() - INTERVAL '4 minutes', server_deadline = NOW() + INTERVAL '27 minutes'
        WHERE id = $1`,
      [opened.id],
    );
    const loaded = (
      await rawPool().query(`SELECT started_at, server_deadline FROM assessment.test_attempts WHERE id = $1`, [
        opened.id,
      ])
    ).rows[0];
    const loadDeadline = loaded.server_deadline;
    const begun = await beginTeacherTestSitting(fx.studentId, teacherTest.id);
    assert.ok(begun?.attemptEndsAt && begun.windowEndsAt);
    // Start (4 min after load) is inside the 10-min reading allowance, so the
    // clock runs from Start: Start + 30 min = 10:37, capped at the window end (10:35).
    assert.equal(new Date(begun.attemptEndsAt).getTime(), new Date(begun.windowEndsAt).getTime());
    const deadline = await rawPool().query(
      `SELECT server_deadline, (metadata ? 'begun_at') AS begun FROM assessment.test_attempts WHERE id = $1`,
      [opened.id],
    );
    assert.equal(deadline.rows[0].begun, true);
    assert.equal(
      new Date(deadline.rows[0].server_deadline).getTime(),
      new Date(begun.windowEndsAt).getTime() + 60_000,
      "deadline = window end + grace (later than the load-time deadline)",
    );
    assert.ok(new Date(deadline.rows[0].server_deadline).getTime() > new Date(loadDeadline).getTime());

    // A second Start (a reload) never buys more time.
    await rawPool().query(
      `UPDATE assessment.test_attempts SET server_deadline = server_deadline - INTERVAL '1 minute' WHERE id = $1`,
      [opened.id],
    );
    const again = await beginTeacherTestSitting(fx.studentId, teacherTest.id);
    assert.equal(
      new Date(again!.attemptEndsAt!).getTime(),
      new Date(begun.attemptEndsAt).getTime() - 60_000,
      "the second Start keeps the first deadline",
    );
    await rawPool().query(
      `UPDATE assessment.test_attempts SET server_deadline = server_deadline + INTERVAL '1 minute' WHERE id = $1`,
      [opened.id],
    );

    // A reload after Start carries the server's end for the timer cap.
    const reloaded = (await getTestDetail(store, user, teacherTest.id, { startAttempt: true })) as {
      attemptEndsAt?: string | null;
    };
    assert.equal(reloaded.attemptEndsAt, begun.attemptEndsAt);

    // Jump to 10:35:01 (28 min 1 s later): shift every timestamp back by that.
    await setWindow(assignment.id, "NOW() - INTERVAL '35 minutes 1 second'", "NOW() - INTERVAL '1 second'");
    await rawPool().query(
      `UPDATE assessment.test_attempts
          SET started_at = started_at - INTERVAL '28 minutes 1 second',
              server_deadline = server_deadline - INTERVAL '28 minutes 1 second'
        WHERE id = $1`,
      [opened.id],
    );
    const judged = await getAssignedTestForStudent(fx.studentId, teacherTest.id);
    assert.equal(judged?.activeAttempt?.id, opened.id, "the Start-anchored deadline (window end + grace) is still ahead");
    await submitNotRefusedByWindow(store, user, teacherTest.id);
    assert.equal((await attemptsFor(teacherTest.id, fx.studentId))[0].status, "submitted");
  } finally {
    await cleanup(fx);
  }
});

test("R5-L1: a Start delayed beyond the reading allowance buys only the allowance", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const { teacherTest, assignment } = await windowTest(fx, "Wide window, very late Start");
    const store = { tests: [], questions: [] } as unknown as AppStore;
    const user = { id: fx.studentId, role: "student" } as unknown as StoredUser;
    // Window open for hours, so only the allowance can bound the sitting.
    await setWindow(assignment.id, "NOW() - INTERVAL '1 hour'", "NOW() + INTERVAL '5 hours'");
    await getTestDetail(store, user, teacherTest.id, { startAttempt: true });
    const [opened] = await attemptsFor(teacherTest.id, fx.studentId);
    // The paper was loaded 25 minutes ago; Start only now (15 min past the allowance).
    await rawPool().query(
      `UPDATE assessment.test_attempts SET started_at = NOW() - INTERVAL '25 minutes' WHERE id = $1`,
      [opened.id],
    );
    const loadedAt = new Date(
      (await rawPool().query(`SELECT started_at FROM assessment.test_attempts WHERE id = $1`, [opened.id])).rows[0]
        .started_at,
    ).getTime();
    const begun = await beginTeacherTestSitting(fx.studentId, teacherTest.id);
    assert.ok(begun?.attemptEndsAt);
    // Clock starts at load + 10 min, not at Start: ends load + 10 + 30 min.
    assert.equal(new Date(begun.attemptEndsAt).getTime(), loadedAt + (10 + 30) * 60_000);
  } finally {
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
