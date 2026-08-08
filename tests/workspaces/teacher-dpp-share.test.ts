import test from "node:test";
import assert from "node:assert/strict";

import {
  TEACHER_DPP_LIFETIME_DAYS,
  isTestShareableAsDpp,
  resolveShareQuestionIds,
  resolveShareableBatchIds,
  teacherDppExpiryFrom,
} from "../../src/server/workspaces/teacher-dpp-service";
import { teacherDppPlanId } from "../../src/legacy/analytics-store";
import { toIsoTimestamp } from "../../src/server/workspaces/teacher-dpp-store";
import { toMaterializations } from "../../src/server/teacher-dpp-materializer";
import type { TestQuestion, TeacherDppShareForStudent } from "../../src/server/workspaces/types";

function question(overrides: Partial<TestQuestion>): TestQuestion {
  return {
    testId: "test_1",
    position: 1,
    sourceBank: "ogcode",
    ogcodeQuestionId: null,
    contentQuestionId: null,
    contentQuestionVersionId: null,
    marks: 4,
    negativeMarks: -1,
    metadata: {},
    ...overrides,
  };
}

// ─── question snapshot (decision D5) ───────────────────────────────────────────

test("share snapshot keeps test order across mixed OG Code + Question Bag sources", () => {
  const ids = resolveShareQuestionIds([
    question({ position: 3, sourceBank: "ogcode", ogcodeQuestionId: "og_3" }),
    question({
      position: 1,
      sourceBank: "workspace_bag",
      contentQuestionId: "q_1",
      contentQuestionVersionId: "qv_1",
    }),
    question({ position: 2, sourceBank: "ogcode", ogcodeQuestionId: "og_2" }),
  ]);

  assert.deepEqual(ids, ["q_1", "og_2", "og_3"]);
});

test("share snapshot drops repeats — dpp_questions is keyed on (dpp_id, position)", () => {
  const ids = resolveShareQuestionIds([
    question({ position: 1, ogcodeQuestionId: "og_1" }),
    question({ position: 2, ogcodeQuestionId: "og_1" }),
    question({ position: 3, ogcodeQuestionId: "og_2" }),
  ]);

  assert.deepEqual(ids, ["og_1", "og_2"]);
});

test("share snapshot skips rows whose source id is missing for their bank", () => {
  const ids = resolveShareQuestionIds([
    // workspace_bag row with only an ogcode id set — unusable.
    question({ position: 1, sourceBank: "workspace_bag", ogcodeQuestionId: "og_1" }),
    question({ position: 2, sourceBank: "ogcode", ogcodeQuestionId: "og_2" }),
  ]);

  assert.deepEqual(ids, ["og_2"]);
});

// ─── batch selection ───────────────────────────────────────────────────────────

test("batch selection accepts owned batches and reports foreign ones separately", () => {
  const result = resolveShareableBatchIds({
    requested: ["batch_a", "batch_stolen"],
    workspaceBatchIds: ["batch_a", "batch_b"],
    alreadyLiveBatchIds: [],
  });

  assert.deepEqual(result.accepted, ["batch_a"]);
  assert.deepEqual(result.unknown, ["batch_stolen"]);
  assert.deepEqual(result.duplicates, []);
});

test("batch selection refuses a batch that already has this test live as a DPP", () => {
  const result = resolveShareableBatchIds({
    requested: ["batch_a", "batch_b"],
    workspaceBatchIds: ["batch_a", "batch_b"],
    alreadyLiveBatchIds: ["batch_a"],
  });

  assert.deepEqual(result.accepted, ["batch_b"]);
  assert.deepEqual(result.duplicates, ["batch_a"]);
});

test("batch selection de-duplicates a repeated batch id in one request", () => {
  const result = resolveShareableBatchIds({
    requested: ["batch_a", "batch_a"],
    workspaceBatchIds: ["batch_a"],
    alreadyLiveBatchIds: [],
  });

  assert.deepEqual(result.accepted, ["batch_a"]);
});

// ─── lifetime ──────────────────────────────────────────────────────────────────

test("a shared DPP expires exactly 30 days after it is shared", () => {
  const now = new Date("2026-08-08T10:00:00.000Z");
  assert.equal(TEACHER_DPP_LIFETIME_DAYS, 30);
  assert.equal(teacherDppExpiryFrom(now), "2026-09-07T10:00:00.000Z");
});

// ─── shareable statuses ────────────────────────────────────────────────────────

test("only a settled test can be shared — a draft has no stable question set", () => {
  assert.equal(isTestShareableAsDpp("draft"), false);
  assert.equal(isTestShareableAsDpp("archived"), false);
  for (const status of ["published", "scheduled", "live", "closed"]) {
    assert.equal(isTestShareableAsDpp(status), true, status);
  }
});

// ─── timestamp round-trip ──────────────────────────────────────────────────────

test("expiresAt read back from Postgres round-trips as ISO, not Date.toString()", () => {
  // Regression: node-postgres hands back a Date for TIMESTAMPTZ. String(date)
  // gives "Mon Sep 07 2026 11:53:43 GMT+0530 (India Standard Time)", which
  // Postgres then refuses as a TIMESTAMPTZ parameter ("time zone \"gmt+0530\"
  // not recognized") — and since the materializer writes this value straight
  // back, that silently rolled back every materialization transaction.
  const iso = toIsoTimestamp(new Date("2026-09-07T06:23:43.862Z"));
  assert.equal(iso, "2026-09-07T06:23:43.862Z");
  assert.doesNotMatch(iso, /GMT/);
  // Must survive a second pass unchanged (values already stored as ISO).
  assert.equal(toIsoTimestamp(iso), iso);
});

test("toIsoTimestamp leaves an unparseable value alone rather than emitting Invalid Date", () => {
  assert.equal(toIsoTimestamp("not-a-date"), "not-a-date");
});

// ─── materialization (decision D1) ─────────────────────────────────────────────

function share(overrides: Partial<TeacherDppShareForStudent>): TeacherDppShareForStudent {
  return {
    shareId: "tdshare_1",
    workspaceId: "ws_1",
    title: "Kinematics Drill",
    subject: "physics",
    summary: null,
    durationMinutes: 30,
    questionIds: ["og_1", "og_2"],
    teacherDisplayName: "Origin Institute",
    teacherLogoUrl: null,
    expiresAt: "2026-09-07T10:00:00.000Z",
    ...overrides,
  };
}

test("materialization falls back to a teacher-attributed summary when the test had none", () => {
  const [plan] = toMaterializations([share({ summary: null })]);
  assert.equal(plan.summary, "Practice set shared with your batch by Origin Institute.");
});

test("materialization keeps the teacher's own description when present", () => {
  const [plan] = toMaterializations([share({ summary: "Ch. 3 revision" })]);
  assert.equal(plan.summary, "Ch. 3 revision");
});

test("a share whose source questions were all deleted is not materialized", () => {
  assert.deepEqual(toMaterializations([share({ questionIds: [] })]), []);
});

test("materialized plan ids are deterministic so concurrent reads cannot duplicate a DPP", () => {
  assert.equal(teacherDppPlanId("tdshare_1", "user_9"), "tdpp_tdshare_1_user_9");
  assert.equal(teacherDppPlanId("tdshare_1", "user_9"), teacherDppPlanId("tdshare_1", "user_9"));
  assert.notEqual(teacherDppPlanId("tdshare_1", "user_9"), teacherDppPlanId("tdshare_1", "user_8"));
});
