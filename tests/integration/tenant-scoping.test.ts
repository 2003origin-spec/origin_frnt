/**
 * Tenant scoping (DB-backed) — bug-fix docs 11-new-teacher-admin N9/N10/N11
 * and 02-uploads-services U6.
 *
 * Two independent workspaces (A = acting, B = victim) and the cross-tenant
 * calls that used to succeed:
 *  - N9  assignTestToBatches / createRoom with one of B's batch ids → 403
 *  - N10 addStudentsToBatches with a student not enrolled in A → 403
 *  - N9  addStudentsToBatches through A targeting B's batch → 403, and a
 *        mis-scoped member row never opens B's batch chat / "My institutes"
 *  - N11 workspace-wide study material invisible to a non-enrolled student
 *  - U6  pages / questions of B's import job read through A → [] / 404
 *
 * The pure decision rules are pinned in tests/workspaces/tenant-scoping.test.ts.
 * Skipped when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { AuthzError } from "@/server/authz";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  issueAccessTokenForUser,
} from "@/server/auth-jwt";
import { withStoredUserDefaults } from "@/server/store";
import { addStudentsToBatches, listStudentBatchesAcrossWorkspaces } from "@/server/workspaces/batches";
import { getStudentBatchContext } from "@/server/workspaces/batch-messages-store";
import {
  addJobPage,
  addJobQuestion,
  createImportJob,
  getJobPages,
  getJobQuestions,
  getJobWithProgress,
  updateQuestionStatus,
} from "@/server/workspaces/document-import-store";
import { enrollStudent, setEnrollmentStatus } from "@/server/workspaces/enrollments";
import { createOrderService, markOrderPaidService } from "@/server/workspaces/marketplace-service";
import {
  assignStudyMaterial,
  createStudyMaterial,
  getMaterialsForStudent,
  publishStudyMaterial,
} from "@/server/workspaces/study-materials-store";
import { createRoom } from "@/server/workspaces/teacher-rooms-service";
import { assignTestToBatches } from "@/server/workspaces/tests-service";
import { addQuestionToTest, createTest } from "@/server/workspaces/tests-store";

import { GET as importJobRoute } from "@/app/api/teacher/workspaces/[workspaceId]/import-jobs/[jobId]/route";

import { cleanup, closePool, dbConfigured, enrollFixtureStudent, rawPool, seedFixtures, type Fixtures } from "./_db";

process.env.AUTH_JWT_SECRET_CURRENT ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";
// The U6 case creates an import job; once the private-bucket fix lands that
// requires a private bucket name. Any value works here — nothing is uploaded.
process.env.R2_PRIVATE_BUCKET ??= "origin-private-test";

const SKIP = !dbConfigured();
const it = test;

function isAuthz(status: number) {
  return (error: unknown) => error instanceof AuthzError && error.status === status;
}

async function teacherRequest(userId: string, url: string): Promise<NextRequest> {
  const user = withStoredUserDefaults({
    id: userId,
    name: "Fixture Owner",
    email: `${userId}@example.com`,
    password: "",
    role: "teacher",
    studentClass: null,
    fieldOfInterest: null,
    referralSource: null,
    avatar: null,
    streak: 0,
    totalStudyTime: 0,
    joinedAt: new Date(0).toISOString(),
    isPremium: false,
    premiumExpiry: null,
    isOnboarded: true,
    selectedCourse: null,
    isDropper: false,
    yearsOfExperience: null,
    subjects: [],
    studentCapacity: null,
  });
  const access = await issueAccessTokenForUser(user, `session_${userId}`);
  return new NextRequest(url, {
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=${encodeURIComponent(access.accessToken)}; ${ACCESS_FINGERPRINT_COOKIE_NAME}=${encodeURIComponent(access.accessFingerprint)}`,
    },
  });
}

async function cleanupPair(a: Fixtures, b: Fixtures): Promise<void> {
  const pool = rawPool();
  for (const fx of [a, b]) {
    await pool.query(`DELETE FROM import.document_import_jobs WHERE workspace_id = $1`, [fx.workspaceId]);
    await pool.query(`DELETE FROM content.study_materials WHERE workspace_id = $1`, [fx.workspaceId]);
    await pool.query(`DELETE FROM assessment.test_assignments WHERE workspace_id = $1`, [fx.workspaceId]);
    await pool.query(`DELETE FROM assessment.tests WHERE workspace_id = $1`, [fx.workspaceId]);
    await pool.query(`DELETE FROM app.batch_members WHERE workspace_id = $1`, [fx.workspaceId]);
    await pool.query(`DELETE FROM commerce.enrollment_orders WHERE workspace_id = $1`, [fx.workspaceId]);
    await pool.query(`DELETE FROM app.workspace_student_enrollments WHERE workspace_id = $1`, [fx.workspaceId]);
  }
  await cleanup(a);
  await cleanup(b);
}

it("N9: a test cannot be assigned, nor a room targeted, to another workspace's batch", { skip: SKIP }, async () => {
  const a = await seedFixtures();
  const b = await seedFixtures();
  try {
    const teacherTest = await createTest({
      workspaceId: a.workspaceId,
      createdBy: a.ownerId,
      title: "Cross-tenant probe",
      subject: "physics",
      durationMinutes: 30,
      totalQuestions: 1,
      status: "published",
    });
    await addQuestionToTest({
      testId: teacherTest.id,
      position: 0,
      sourceBank: "ogcode",
      ogcodeQuestionId: "ogq_tenant_scoping",
    });

    await assert.rejects(
      assignTestToBatches({
        actorUserId: a.ownerId,
        workspaceId: a.workspaceId,
        testId: teacherTest.id,
        batchIds: [b.batchId],
      }),
      isAuthz(403),
    );
    // Mixed lists are refused as a whole — nothing is assigned.
    await assert.rejects(
      assignTestToBatches({
        actorUserId: a.ownerId,
        workspaceId: a.workspaceId,
        testId: teacherTest.id,
        batchIds: [a.batchId, b.batchId],
      }),
      isAuthz(403),
    );
    const leaked = await rawPool().query(
      `SELECT COUNT(*)::int AS n FROM assessment.test_assignments WHERE test_id = $1`,
      [teacherTest.id],
    );
    assert.equal(Number(leaked.rows[0].n), 0);

    // The workspace's own batch still works.
    const assignments = await assignTestToBatches({
      actorUserId: a.ownerId,
      workspaceId: a.workspaceId,
      testId: teacherTest.id,
      batchIds: [a.batchId],
    });
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].batchId, a.batchId);

    // Rooms: refused before any rooms-DB write.
    await assert.rejects(
      createRoom({
        actorUserId: a.ownerId,
        workspaceId: a.workspaceId,
        name: "Cross-tenant room",
        batchId: b.batchId,
      }),
      isAuthz(403),
    );
  } finally {
    await cleanupPair(a, b);
  }
});

it("N10: only students enrolled in the workspace can be placed in its batches", { skip: SKIP }, async () => {
  const a = await seedFixtures();
  const b = await seedFixtures();
  try {
    // b.studentId has no enrolment row in A.
    await assert.rejects(
      addStudentsToBatches({
        workspaceId: a.workspaceId,
        batchIds: [a.batchId],
        studentIds: [b.studentId],
        assignedBy: a.ownerId,
      }),
      isAuthz(403),
    );
    // Mixed lists are refused as a whole (transaction rolled back).
    await enrollFixtureStudent(a);
    await assert.rejects(
      addStudentsToBatches({
        workspaceId: a.workspaceId,
        batchIds: [a.batchId],
        studentIds: [a.studentId, b.studentId],
        assignedBy: a.ownerId,
      }),
      isAuthz(403),
    );
    const members = await rawPool().query(
      `SELECT COUNT(*)::int AS n FROM app.batch_members WHERE batch_id = $1`,
      [a.batchId],
    );
    assert.equal(Number(members.rows[0].n), 0);

    // An enrolled (still unassigned) student is accepted and flipped to active.
    const added = await addStudentsToBatches({
      workspaceId: a.workspaceId,
      batchIds: [a.batchId],
      studentIds: [a.studentId],
      assignedBy: a.ownerId,
    });
    assert.equal(added.length, 1);
    assert.equal(added[0].studentId, a.studentId);

    // A student who left the workspace is refused too.
    await enrollStudent({
      workspaceId: a.workspaceId,
      studentId: b.studentId,
      source: "manual",
      initialStatus: "left",
    });
    await assert.rejects(
      addStudentsToBatches({
        workspaceId: a.workspaceId,
        batchIds: [a.batchId],
        studentIds: [b.studentId],
        assignedBy: a.ownerId,
      }),
      isAuthz(403),
    );
  } finally {
    await cleanupPair(a, b);
  }
});

it("N9: a teacher cannot place their own student into another workspace's batch, and a mis-scoped row stays invisible", { skip: SKIP }, async () => {
  const a = await seedFixtures();
  const b = await seedFixtures();
  try {
    await enrollFixtureStudent(a);
    // Teacher of A, A's enrolled student, B's batch id (ids are visible in
    // /api/connect/batches/[batchId]/... responses) → refused as a whole.
    await assert.rejects(
      addStudentsToBatches({
        workspaceId: a.workspaceId,
        batchIds: [b.batchId],
        studentIds: [a.studentId],
        assignedBy: a.ownerId,
      }),
      isAuthz(403),
    );
    await assert.rejects(
      addStudentsToBatches({
        workspaceId: a.workspaceId,
        batchIds: [a.batchId, b.batchId],
        studentIds: [a.studentId],
        assignedBy: a.ownerId,
      }),
      isAuthz(403),
    );
    const members = await rawPool().query(
      `SELECT COUNT(*)::int AS n FROM app.batch_members WHERE batch_id = ANY($1::text[])`,
      [[a.batchId, b.batchId]],
    );
    assert.equal(Number(members.rows[0].n), 0, "nothing inserted for either batch");
    assert.equal(await getStudentBatchContext(b.batchId, a.studentId), null);

    // Defence in depth: even a row written with the wrong workspace (legacy
    // data, a future bug) must not open B's batch chat or list B's batch.
    await rawPool().query(
      `INSERT INTO app.batch_members (batch_id, workspace_id, student_id, status, assigned_by)
       VALUES ($1, $2, $3, 'active', $4)`,
      [b.batchId, a.workspaceId, a.studentId, a.ownerId],
    );
    assert.equal(await getStudentBatchContext(b.batchId, a.studentId), null);
    const mine = await listStudentBatchesAcrossWorkspaces(a.studentId);
    assert.deepEqual(mine.map((batch) => batch.id), []);

    // The legitimate add still works and is the only row the student sees.
    const added = await addStudentsToBatches({
      workspaceId: a.workspaceId,
      batchIds: [a.batchId],
      studentIds: [a.studentId],
      assignedBy: a.ownerId,
    });
    assert.equal(added.length, 1);
    const own = await getStudentBatchContext(a.batchId, a.studentId);
    assert.equal(own?.workspaceId, a.workspaceId);
    assert.deepEqual((await listStudentBatchesAcrossWorkspaces(a.studentId)).map((batch) => batch.id), [a.batchId]);
  } finally {
    await cleanupPair(a, b);
  }
});

it("N10/H2: a suspended student can be re-added to a batch (teacher re-add and paid re-enrolment)", { skip: SKIP }, async () => {
  const a = await seedFixtures();
  const b = await seedFixtures();
  try {
    // Teacher re-add: enrolled, then suspended (what a lapsed subscription does).
    await enrollFixtureStudent(a);
    await setEnrollmentStatus(a.workspaceId, a.studentId, "suspended");
    // Re-subscribe calls enrollStudent first; it keeps a suspended row as-is.
    await enrollStudent({ workspaceId: a.workspaceId, studentId: a.studentId, source: "paid_app", initialStatus: "active" });
    const added = await addStudentsToBatches({
      workspaceId: a.workspaceId,
      batchIds: [a.batchId],
      studentIds: [a.studentId],
      assignedBy: null,
    });
    assert.equal(added.length, 1);
    const enrolment = await rawPool().query(
      `SELECT status FROM app.workspace_student_enrollments WHERE workspace_id = $1 AND student_id = $2`,
      [a.workspaceId, a.studentId],
    );
    assert.equal(enrolment.rows[0].status, "active", "the batch add revives the suspended enrolment");

    // Marketplace: a suspended student pays again and lands in the target batch.
    await enrollFixtureStudent(b);
    await setEnrollmentStatus(b.workspaceId, b.studentId, "suspended");
    const order = await createOrderService({ workspaceId: b.workspaceId, offeringId: b.offeringId, studentId: b.studentId });
    const paid = await markOrderPaidService({
      orderId: order.id,
      workspaceId: b.workspaceId,
      provider: "razorpay",
      providerPaymentId: `pi_${Math.random().toString(36).slice(2)}`,
    });
    assert.equal(paid.status, "paid");
    const member = await rawPool().query(
      `SELECT status FROM app.batch_members WHERE batch_id = $1 AND student_id = $2`,
      [b.batchId, b.studentId],
    );
    assert.equal(member.rows[0]?.status, "active");
  } finally {
    await cleanupPair(a, b);
  }
});

it("N11: workspace-wide study materials are visible to enrolled students only", { skip: SKIP }, async () => {
  const a = await seedFixtures();
  const b = await seedFixtures();
  try {
    const material = await createStudyMaterial({
      workspaceId: a.workspaceId,
      title: "Whole-institute notes",
      createdBy: a.ownerId,
    });
    assert.ok(await publishStudyMaterial(a.workspaceId, material.id));
    await assignStudyMaterial({
      materialId: material.id,
      workspaceId: a.workspaceId,
      targetType: "workspace",
      targetId: a.workspaceId,
      assignedBy: a.ownerId,
    });

    // b.studentId is not enrolled in A: nothing, even though the workspace id is public.
    assert.deepEqual(await getMaterialsForStudent(a.workspaceId, b.studentId), []);

    // Enrolled (unassigned) student sees it.
    await enrollFixtureStudent(a);
    const visible = await getMaterialsForStudent(a.workspaceId, a.studentId);
    assert.deepEqual(visible.map((m) => m.id), [material.id]);
  } finally {
    await cleanupPair(a, b);
  }
});

it("U6: an import job's pages and questions cannot be read through another workspace", { skip: SKIP }, async () => {
  const a = await seedFixtures();
  const b = await seedFixtures();
  try {
    const job = await createImportJob({
      workspaceId: b.workspaceId,
      userId: b.ownerId,
      sourceType: "pdf",
      fileName: "victim.pdf",
    });
    const page = await addJobPage(job.id, 1, { status: "parsed", extractedText: "Q1 ..." });
    const question = await addJobQuestion(job.id, page.id, {
      questionNumber: 1,
      questionText: "What is 2+2?",
      status: "review_required",
    });

    // Store: the owning workspace reads its rows, any other workspace reads none.
    assert.equal((await getJobPages(b.workspaceId, job.id)).length, 1);
    assert.equal((await getJobQuestions(b.workspaceId, job.id)).length, 1);
    assert.deepEqual(await getJobPages(a.workspaceId, job.id), []);
    assert.deepEqual(await getJobQuestions(a.workspaceId, job.id), []);
    assert.equal(await getJobWithProgress(a.workspaceId, job.id), null);

    // Store: the status write is workspace-scoped too.
    assert.equal(await updateQuestionStatus(a.workspaceId, job.id, question.id, "accepted"), null);
    const unchanged = await getJobQuestions(b.workspaceId, job.id);
    assert.equal(unchanged[0]?.status, "review_required");
    const updated = await updateQuestionStatus(b.workspaceId, job.id, question.id, "accepted");
    assert.equal(updated?.status, "accepted");

    // Route: member of A asking for B's job through A → 404 for every type.
    const base = `https://www.o3origin.com/api/teacher/workspaces/${a.workspaceId}/import-jobs/${job.id}`;
    for (const query of ["?type=pages", "?type=questions", ""]) {
      const response = await importJobRoute(await teacherRequest(a.ownerId, `${base}${query}`), {
        params: Promise.resolve({ workspaceId: a.workspaceId, jobId: job.id }),
      });
      assert.equal(response.status, 404, `expected 404 for ${query || "(job)"}`);
    }

    // Route: the owning workspace still works.
    const own = `https://www.o3origin.com/api/teacher/workspaces/${b.workspaceId}/import-jobs/${job.id}`;
    const pagesResponse = await importJobRoute(await teacherRequest(b.ownerId, `${own}?type=pages`), {
      params: Promise.resolve({ workspaceId: b.workspaceId, jobId: job.id }),
    });
    assert.equal(pagesResponse.status, 200);
    const pagesPayload = (await pagesResponse.json()) as { pages: { id: string }[] };
    assert.deepEqual(pagesPayload.pages.map((p) => p.id), [page.id]);
  } finally {
    await cleanupPair(a, b);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
