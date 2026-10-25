/**
 * Tenant scoping — bug-fix docs 11-new-teacher-admin N9/N10/N12 and
 * 02-uploads-services U6.
 *
 * The decision rules live in src/server/workspaces/tenant-scoping.ts as pure
 * functions so they can be pinned here without a database. The workspace
 * create route is exercised end to end (JWT → role gate) because the refusal
 * happens before any store call. The DB-backed halves (foreign batch on
 * assign/createRoom, non-enrolled batch member, cross-workspace import-job
 * reads → 404) live in tests/integration/tenant-scoping.test.ts.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { NextRequest } from "next/server";

import { AuthzError } from "@/server/authz";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  issueAccessTokenForUser,
} from "@/server/auth-jwt";
import { withStoredUserDefaults, type StoredUser } from "@/server/store";
import {
  MAX_OWNED_WORKSPACES,
  assertBatchesBelongToWorkspace,
  assertStudentsEnrolled,
  batchAssignableStudentIds,
  evaluateWorkspaceCreate,
  findForeignIds,
  isBatchAssignableEnrollmentStatus,
} from "@/server/workspaces/tenant-scoping";

import { POST as createWorkspaceRoute } from "@/app/api/teacher/workspaces/route";

process.env.AUTH_JWT_SECRET_CURRENT ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

function isAuthz(status: number) {
  return (error: unknown) => error instanceof AuthzError && error.status === status;
}

// ─── N9: batch ownership ──────────────────────────────────────────────────────

test("N9: findForeignIds returns the requested ids that are not owned, once each", () => {
  assert.deepEqual(findForeignIds(["b1", "bX", "b2", "bX", "bY"], ["b1", "b2"]), ["bX", "bY"]);
  assert.deepEqual(findForeignIds(["b1"], new Set(["b1"])), []);
  assert.deepEqual(findForeignIds([], []), []);
});

test("N9: a batch id from another workspace is refused with 403 on assign / createRoom", () => {
  const owned = ["batch_a1", "batch_a2"];
  assert.doesNotThrow(() => assertBatchesBelongToWorkspace(["batch_a1", "batch_a2"], owned));
  assert.throws(() => assertBatchesBelongToWorkspace(["batch_b1"], owned), isAuthz(403));
  // One foreign id among valid ones still refuses the whole request.
  assert.throws(() => assertBatchesBelongToWorkspace(["batch_a1", "batch_b1"], owned), isAuthz(403));
  // A workspace with no batches cannot target anything.
  assert.throws(() => assertBatchesBelongToWorkspace(["batch_a1"], []), isAuthz(403));
});

test("N9: addStudentsToBatches checks the batch ids against the workspace inside the transaction", () => {
  const src = readFileSync(new URL("../../src/server/workspaces/batches.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export async function addStudentsToBatches"));
  const body = fn.slice(0, fn.indexOf("\nexport "));
  const begin = body.indexOf('client.query("BEGIN")');
  const ownedCheck = body.indexOf("assertBatchesBelongToWorkspace(");
  const insert = body.indexOf("INSERT INTO app.batch_members");
  assert.ok(begin >= 0 && ownedCheck > begin && insert > ownedCheck, "ownership check runs after BEGIN and before the insert");
  assert.match(body, /SELECT id FROM app\.batches WHERE workspace_id = \$1 AND id = ANY\(\$2::text\[\]\)/);
});

test("N9: student-side batch reads only accept member rows whose workspace matches the batch", () => {
  // A (batch_id, workspace_id) pair that disagrees with app.batches must be
  // invisible even if it exists: the student must never read/post in another
  // institute's batch chat through a mis-scoped membership row.
  const joins: Array<[string, RegExp]> = [
    ["src/server/workspaces/batch-messages-store.ts", /INNER JOIN app\.batches b ON b\.id = m\.batch_id AND b\.workspace_id = m\.workspace_id/],
    ["src/server/workspaces/batches.ts", /INNER JOIN app\.batch_members m ON m\.batch_id = b\.id AND m\.workspace_id = b\.workspace_id\s+WHERE m\.student_id = \$1/],
    ["src/server/workspaces/batches.ts", /INNER JOIN app\.batch_members m ON m\.batch_id = b\.id AND m\.workspace_id = b\.workspace_id\s+WHERE m\.workspace_id = \$1/],
  ];
  for (const [file, pattern] of joins) {
    const src = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(src, pattern, file);
  }
  const chat = readFileSync(new URL("../../src/server/workspaces/batch-messages-store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(chat, /INNER JOIN app\.batches b ON b\.id = m\.batch_id\s*\n/, "no batch_id-only join left in the batch chat store");
});

// ─── N10: enrolment before batch membership ───────────────────────────────────

test("N10: a student id without an enrolment row is refused with 403", () => {
  const enrolled = ["user_s1", "user_s2"];
  assert.doesNotThrow(() => assertStudentsEnrolled(["user_s1"], enrolled));
  assert.doesNotThrow(() => assertStudentsEnrolled(["user_s1", "user_s1"], enrolled));
  assert.throws(() => assertStudentsEnrolled(["user_outsider"], enrolled), isAuthz(403));
  assert.throws(() => assertStudentsEnrolled(["user_s1", "user_outsider"], enrolled), isAuthz(403));
});

test("N10/H2: every enrolment status except left may be (re)placed in a batch", () => {
  assert.equal(isBatchAssignableEnrollmentStatus("unassigned"), true);
  assert.equal(isBatchAssignableEnrollmentStatus("active"), true);
  // A lapsed subscription parks the enrolment as suspended; re-subscribe,
  // marketplace payment and teacher re-add all revive it through the batch add.
  assert.equal(isBatchAssignableEnrollmentStatus("suspended"), true);
  assert.equal(isBatchAssignableEnrollmentStatus("left"), false);
  assert.equal(isBatchAssignableEnrollmentStatus("bogus"), false);
});

test("N10/H2: a suspended student is accepted; left and non-enrolled ids are still refused", () => {
  const rows = [
    { student_id: "user_active", status: "active" },
    { student_id: "user_new", status: "unassigned" },
    { student_id: "user_lapsed", status: "suspended" },
    { student_id: "user_gone", status: "left" },
  ];
  const assignable = batchAssignableStudentIds(rows);
  assert.deepEqual(assignable, ["user_active", "user_new", "user_lapsed"]);

  assert.doesNotThrow(() => assertStudentsEnrolled(["user_lapsed"], assignable));
  assert.doesNotThrow(() => assertStudentsEnrolled(["user_active", "user_new", "user_lapsed"], assignable));
  assert.throws(() => assertStudentsEnrolled(["user_gone"], assignable), isAuthz(403));
  assert.throws(() => assertStudentsEnrolled(["user_outsider"], assignable), isAuthz(403));
  assert.throws(() => assertStudentsEnrolled(["user_lapsed", "user_outsider"], assignable), isAuthz(403));
});

// ─── N12: workspace create gate ───────────────────────────────────────────────

test("N12: only teacher/admin accounts may create workspaces; owners are capped", () => {
  assert.equal(evaluateWorkspaceCreate({ role: "teacher", ownedWorkspaceCount: 0 }), null);
  assert.equal(evaluateWorkspaceCreate({ role: "admin", ownedWorkspaceCount: 0 }), null);
  assert.equal(
    evaluateWorkspaceCreate({ role: "teacher", ownedWorkspaceCount: MAX_OWNED_WORKSPACES - 1 }),
    null,
  );

  const student = evaluateWorkspaceCreate({ role: "student", ownedWorkspaceCount: 0 });
  assert.ok(student instanceof AuthzError);
  assert.equal(student.status, 403);

  const capped = evaluateWorkspaceCreate({ role: "teacher", ownedWorkspaceCount: MAX_OWNED_WORKSPACES });
  assert.ok(capped instanceof AuthzError);
  assert.equal(capped.status, 409);
});

function buildUser(patch: Partial<StoredUser>): StoredUser {
  return withStoredUserDefaults({
    id: "user_tenant_scoping",
    name: "Tenant Scoping",
    email: "tenant-scoping@example.com",
    password: "",
    role: "student",
    studentClass: null,
    fieldOfInterest: null,
    referralSource: null,
    avatar: null,
    streak: 0,
    totalStudyTime: 0,
    joinedAt: new Date(0).toISOString(),
    isPremium: false,
    premiumExpiry: null,
    isOnboarded: false,
    selectedCourse: null,
    isDropper: false,
    yearsOfExperience: null,
    subjects: [],
    studentCapacity: null,
    ...patch,
  });
}

async function authedRequest(user: StoredUser, body: unknown): Promise<NextRequest> {
  const access = await issueAccessTokenForUser(user, "session_tenant_scoping");
  return new NextRequest("https://www.o3origin.com/api/teacher/workspaces", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${ACCESS_COOKIE_NAME}=${encodeURIComponent(access.accessToken)}; ${ACCESS_FINGERPRINT_COOKIE_NAME}=${encodeURIComponent(access.accessFingerprint)}`,
    },
    body: JSON.stringify(body),
  });
}

test("N12: POST /api/teacher/workspaces refuses a student session with 403 before touching the store", async () => {
  const request = await authedRequest(buildUser({ role: "student" }), {
    workspaceType: "institute",
    displayName: "Minted by a student",
  });
  const response = await createWorkspaceRoute(request);
  assert.equal(response.status, 403);
  const payload = (await response.json()) as { detail?: string };
  assert.match(payload.detail ?? "", /teacher or admin/i);
});

test("N12: POST /api/teacher/workspaces still requires a session", async () => {
  const response = await createWorkspaceRoute(
    new NextRequest("https://www.o3origin.com/api/teacher/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceType: "institute", displayName: "Anonymous" }),
    }),
  );
  assert.equal(response.status, 401);
});
