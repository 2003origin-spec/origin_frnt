/**
 * Feature A — admin-gated teacher code access (PR 1 pure-logic tests).
 * Covers the code-issuance decision (D6 reuse/activate/reuse-display/generate),
 * requested-student-count validation, and the two new feature flags. DB-backed
 * store/service paths are exercised by integration tests, not here.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { decideCodeIssuance } from "../../src/server/workspaces/code-access-admin-service";
import {
  MAX_REQUEST_STUDENT_COUNT,
  normalizeRequestedStudentCount,
} from "../../src/server/workspaces/code-access-service";
import { CodeAccessError } from "../../src/server/workspaces/code-access-store";
import { ALL_FLAG_KEYS, isFeatureEnabled } from "../../src/lib/feature-flags";
import type { WorkspaceCode, WorkspaceCodeStatus } from "../../src/server/workspaces/types";

function code(status: WorkspaceCodeStatus, over: Partial<WorkspaceCode> = {}): WorkspaceCode {
  const displayCode = over.displayCode ?? `code-${status}`;
  return {
    id: over.id ?? `wcode_${status}`,
    workspaceId: "ws_1",
    batchId: null,
    normalizedCode: displayCode.toUpperCase(),
    displayCode,
    codeType: "student_join",
    status,
    createdBy: "user_1",
    expiresAt: null,
    revokedAt: status === "revoked" ? new Date().toISOString() : null,
    metadata: {},
    createdAt: new Date().toISOString(),
    ...over,
  };
}

// ─── decideCodeIssuance (D6) ────────────────────────────────────────────────

test("decideCodeIssuance: no codes → generate a fresh one", () => {
  assert.deepEqual(decideCodeIssuance([]), { kind: "generate" });
});

test("decideCodeIssuance: a reserved institute code → activate it", () => {
  const decision = decideCodeIssuance([code("reserved", { id: "wcode_r" })]);
  assert.deepEqual(decision, { kind: "activate-reserved", codeId: "wcode_r" });
});

test("decideCodeIssuance: only a revoked code → reuse its display value (D6)", () => {
  const decision = decideCodeIssuance([code("revoked", { displayCode: "AKASH-JEE" })]);
  assert.deepEqual(decision, { kind: "reuse-display", displayCode: "AKASH-JEE" });
});

test("decideCodeIssuance: an active code → reuse it (idempotent)", () => {
  const active = code("active", { id: "wcode_a" });
  const decision = decideCodeIssuance([active]);
  assert.equal(decision.kind, "reuse-active");
  assert.equal(decision.kind === "reuse-active" && decision.code.id, "wcode_a");
});

test("decideCodeIssuance precedence: active > reserved > revoked", () => {
  const codes = [code("revoked"), code("reserved", { id: "wcode_r" }), code("active", { id: "wcode_a" })];
  assert.equal(decideCodeIssuance(codes).kind, "reuse-active");
  const noActive = [code("revoked"), code("reserved", { id: "wcode_r" })];
  assert.deepEqual(decideCodeIssuance(noActive), { kind: "activate-reserved", codeId: "wcode_r" });
});

// ─── normalizeRequestedStudentCount ─────────────────────────────────────────

test("normalizeRequestedStudentCount: accepts a positive integer", () => {
  assert.equal(normalizeRequestedStudentCount(50), 50);
});

test("normalizeRequestedStudentCount: floors fractional input", () => {
  assert.equal(normalizeRequestedStudentCount(50.9), 50);
});

test("normalizeRequestedStudentCount: allows the max boundary", () => {
  assert.equal(normalizeRequestedStudentCount(MAX_REQUEST_STUDENT_COUNT), MAX_REQUEST_STUDENT_COUNT);
});

test("normalizeRequestedStudentCount: rejects zero / negative / NaN", () => {
  for (const bad of [0, -5, Number.NaN]) {
    assert.throws(() => normalizeRequestedStudentCount(bad), CodeAccessError);
  }
});

test("normalizeRequestedStudentCount: rejects above the sanity bound", () => {
  assert.throws(() => normalizeRequestedStudentCount(MAX_REQUEST_STUDENT_COUNT + 1), CodeAccessError);
});

// ─── feature flags ──────────────────────────────────────────────────────────

test("both new flags are registered", () => {
  assert.ok(ALL_FLAG_KEYS.includes("teacherCodeApproval"));
  assert.ok(ALL_FLAG_KEYS.includes("adminUserLifecycle"));
});

test("teacherCodeApproval honors the env override", () => {
  const key = "TEACHER_LAUNCH_TEACHER_CODE_APPROVAL";
  const prev = process.env[key];
  try {
    process.env[key] = "0";
    assert.equal(isFeatureEnabled("teacherCodeApproval"), false);
    process.env[key] = "1";
    assert.equal(isFeatureEnabled("teacherCodeApproval"), true);
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
});
