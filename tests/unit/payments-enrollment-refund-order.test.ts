/**
 * F4 — `runEnrollmentOrderRefund` tears the enrolment down BEFORE it marks the
 * commerce order refunded, so a transient error part-way through leaves the
 * order `paid` and the outbox retry finishes the job. An order that is
 * already `refunded` but still has a live paid seat (the old ordering's
 * half-done state) is repaired on re-entry.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  runEnrollmentOrderRefund,
  type EnrollmentRefundDeps,
} from "@/server/workspaces/marketplace-service";
import type {
  EnrollmentOrder,
  EnrollmentOrderStatus,
  WorkspaceStudentEnrollment,
  WorkspaceOffering,
} from "@/server/workspaces/types";

type Step = keyof EnrollmentRefundDeps;

type World = {
  order: EnrollmentOrder;
  enrollment: WorkspaceStudentEnrollment;
  batchMemberActive: boolean;
  audits: string[];
  calls: Step[];
  /** Active free Flow-1 `teacher_code` grants the student holds at ws_1. */
  teacherCodeGrants: number;
  revokeCalls: Array<{ status: string; reason?: string }>;
  /** Steps that throw ONCE (a transient error) the next time they run. */
  failOnce: Set<Step>;
};

function world(orderStatus: EnrollmentOrderStatus = "paid", enrollmentStatus: "active" | "left" = "active"): World {
  return {
    order: {
      id: "eo_1",
      offeringId: "off_1",
      workspaceId: "ws_1",
      studentId: "stu_1",
      status: orderStatus,
      provider: "razorpay",
      providerPaymentId: "pay_1",
      amountMinor: 49900,
      currency: "INR",
      enrollmentId: "enr_1",
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-20T00:00:00.000Z",
    },
    enrollment: {
      id: "enr_1",
      workspaceId: "ws_1",
      studentId: "stu_1",
      source: "paid_app",
      joinCodeId: null,
      status: enrollmentStatus,
      enrolledAt: "2026-10-20T00:00:00.000Z",
      assignedAt: null,
      suspendedAt: null,
      leftAt: null,
      notes: null,
      metadata: {},
    },
    batchMemberActive: enrollmentStatus === "active",
    audits: [],
    calls: [],
    teacherCodeGrants: 1,
    revokeCalls: [],
    failOnce: new Set(),
  };
}

function deps(w: World): EnrollmentRefundDeps {
  const step = (name: Step) => {
    w.calls.push(name);
    if (w.failOnce.delete(name)) throw new Error(`transient: ${name}`);
  };
  const impl = {
    getOrder: async () => {
      step("getOrder");
      return { ...w.order };
    },
    getOffering: async () => {
      step("getOffering");
      return { id: "off_1", targetBatchId: "batch_1" } as WorkspaceOffering;
    },
    getEnrollment: async () => {
      step("getEnrollment");
      return { ...w.enrollment };
    },
    listStudentOrders: async () => {
      step("listStudentOrders");
      return [{ ...w.order }];
    },
    listStudentEnrollmentSubscriptions: async () => {
      step("listStudentEnrollmentSubscriptions");
      return [];
    },
    removeStudentFromBatch: async () => {
      step("removeStudentFromBatch");
      const changed = w.batchMemberActive;
      w.batchMemberActive = false;
      return changed;
    },
    setEnrollmentStatus: async (_ws: string, _stu: string, status: WorkspaceStudentEnrollment["status"]) => {
      step("setEnrollmentStatus");
      w.enrollment = { ...w.enrollment, status };
      return { ...w.enrollment };
    },
    revokeTeacherCodeGrantsForEnrollment: async (args: { status: string; reason?: string }) => {
      step("revokeTeacherCodeGrantsForEnrollment");
      w.revokeCalls.push({ status: args.status, reason: args.reason });
      const revoked = w.teacherCodeGrants;
      w.teacherCodeGrants = 0;
      return revoked;
    },
    updateOrderStatus: async (_o: string, _ws: string, status: EnrollmentOrderStatus) => {
      step("updateOrderStatus");
      w.order = { ...w.order, status };
      return { ...w.order };
    },
    recordAuditEvent: async (event: { action: string }) => {
      step("recordAuditEvent");
      w.audits.push(event.action);
    },
  };
  return impl as unknown as EnrollmentRefundDeps;
}

const input = { orderId: "eo_1", workspaceId: "ws_1", reason: "razorpay_refund:rfnd_1" };

test("teardown runs before the order is marked refunded", async () => {
  const w = world();
  const result = await runEnrollmentOrderRefund(input, deps(w));
  assert.equal(result.status, "refunded");
  const order = w.calls.filter(
    (c) =>
      c === "removeStudentFromBatch" ||
      c === "setEnrollmentStatus" ||
      c === "revokeTeacherCodeGrantsForEnrollment" ||
      c === "updateOrderStatus",
  );
  assert.deepEqual(order, [
    "removeStudentFromBatch",
    "setEnrollmentStatus",
    "revokeTeacherCodeGrantsForEnrollment",
    "updateOrderStatus",
  ]);
  assert.deepEqual(w.revokeCalls, [{ status: "left", reason: "enrollment_refunded" }]);
  assert.equal(w.teacherCodeGrants, 0, "the free Flow-1 subject goes with the enrolment");
  assert.equal(w.enrollment.status, "left");
  assert.equal(w.batchMemberActive, false);
  assert.deepEqual(w.audits, ["order.refunded"]);
});

for (const failing of [
  "removeStudentFromBatch",
  "setEnrollmentStatus",
  "revokeTeacherCodeGrantsForEnrollment",
  "updateOrderStatus",
  "listStudentOrders",
] as const) {
  test(`a transient error at ${failing} leaves the retry able to finish the teardown`, async () => {
    const w = world();
    w.failOnce.add(failing);
    await assert.rejects(runEnrollmentOrderRefund(input, deps(w)), /transient/);
    assert.equal(w.order.status, "paid", "the order is not marked refunded while the seat may still be live");

    const result = await runEnrollmentOrderRefund(input, deps(w)); // outbox retry
    assert.equal(result.status, "refunded");
    assert.equal(w.enrollment.status, "left");
    assert.equal(w.batchMemberActive, false);
    assert.equal(w.teacherCodeGrants, 0, "the retry still revokes the free subject");
    assert.deepEqual(w.audits, ["order.refunded"]);
  });
}

test("an already-refunded order with a live paid seat is repaired on re-entry", async () => {
  // The state the old ordering could leave behind: status flipped, teardown lost.
  const w = world("refunded", "active");
  const result = await runEnrollmentOrderRefund(input, deps(w));
  assert.equal(result.status, "refunded");
  assert.equal(w.enrollment.status, "left");
  assert.equal(w.batchMemberActive, false);
  assert.equal(w.calls.includes("updateOrderStatus"), false, "the status is not re-written");
  assert.deepEqual(w.revokeCalls, [{ status: "left", reason: "enrollment_refunded" }]);
  assert.deepEqual(w.audits, ["order.refund_teardown_completed"]);
});

test("a fully torn-down refunded order is a no-op on re-entry", async () => {
  const w = world("refunded", "left");
  const result = await runEnrollmentOrderRefund(input, deps(w));
  assert.equal(result.status, "refunded");
  for (const write of [
    "removeStudentFromBatch",
    "setEnrollmentStatus",
    "revokeTeacherCodeGrantsForEnrollment",
    "updateOrderStatus",
    "recordAuditEvent",
  ] as const) {
    assert.equal(w.calls.includes(write), false, `${write} must not run`);
  }
});

test("a refunded order whose seat another paid source keeps is left alone", async () => {
  const w = world("refunded", "active");
  const d = deps(w);
  d.listStudentOrders = async () => [{ ...w.order }, { ...w.order, id: "eo_2", status: "paid" }];
  await runEnrollmentOrderRefund(input, d);
  assert.equal(w.enrollment.status, "active");
  assert.equal(w.batchMemberActive, true);
  assert.equal(w.calls.includes("revokeTeacherCodeGrantsForEnrollment"), false, "the free subject stays");
  assert.deepEqual(w.audits, []);
});

test("an unpaid order still throws 409 so the outbox retries after it is paid", async () => {
  const w = world("payment_pending");
  await assert.rejects(runEnrollmentOrderRefund(input, deps(w)), (e: unknown) => (e as { status?: number }).status === 409);
  assert.equal(w.enrollment.status, "active");
});

test("a refund never revokes the free subject of an enrolment it did not create", async () => {
  const w = world();
  w.enrollment = { ...w.enrollment, source: "code" };
  await runEnrollmentOrderRefund(input, deps(w));
  assert.equal(w.enrollment.status, "active");
  assert.equal(w.calls.includes("revokeTeacherCodeGrantsForEnrollment"), false);
  assert.equal(w.teacherCodeGrants, 1);
});

test("the production deps wire connect-grants' revokeTeacherCodeGrantsForEnrollment", () => {
  const src = readFileSync(new URL("../../src/server/workspaces/marketplace-service.ts", import.meta.url), "utf8");
  assert.match(src, /import \{ revokeTeacherCodeGrantsForEnrollment \} from "@\/server\/connect\/grant-revocation";/);
  const depsBlock = src.slice(src.indexOf("const ENROLLMENT_REFUND_DEPS"), src.indexOf("};", src.indexOf("const ENROLLMENT_REFUND_DEPS")));
  assert.match(depsBlock, /\brevokeTeacherCodeGrantsForEnrollment,/);
  assert.match(src, /reason: "enrollment_refunded"/);
});
