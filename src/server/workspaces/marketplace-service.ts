/**
 * Paid enrollment and marketplace service (Phase 12).
 * Aligned to V1/teacher-admin-launch-plan/02-database-schema-design.md.
 *
 * Lifecycle (commerce.order_status):
 *   created → payment_pending → (paid | failed | cancelled)
 *   paid    → refunded
 *
 * When an order transitions to "paid" we:
 *   1. Create or update the row in app.workspace_student_enrollments
 *      (source = 'paid_app') and link enrollment_id back on the order.
 *   2. Assign the student to the offering's target_batch_id if set.
 *
 * Idempotency is guaranteed by the unique partial index on
 * (provider, provider_payment_id) in commerce.enrollment_orders, plus
 * the UNIQUE (workspace_id, student_id) constraint on
 * app.workspace_student_enrollments — repeated payment webhooks
 * resolve to the same enrollment record instead of duplicating.
 */

import { AuthzError } from "@/server/authz";
import { isFeatureEnabled } from "@/lib/feature-flags";

import { recordAuditEvent } from "./audit";
import { addStudentsToBatches, getBatch, removeStudentFromBatch } from "./batches";
import {
  createEnrollmentOrder as storeCreateEnrollmentOrder,
  createOffering as storeCreateOffering,
  getInstitutePublicProfile,
  getOffering,
  getOrder,
  listOfferings,
  listPublicInstitutes,
  listStudentOrders,
  updateOffering as storeUpdateOffering,
  updateOrderStatus,
  type CreateEnrollmentOrderInput,
  type CreateOfferingInput,
  type PublicInstituteFilter,
  type UpdateOfferingPatch,
} from "./marketplace-store";
import { getActiveMembership, getWorkspaceById } from "./store";
import { enrollStudent, getEnrollment, setEnrollmentStatus } from "./enrollments";
import { listStudentEnrollmentSubscriptions } from "@/server/connect/enrollment-subscriptions-store";
import { revokeTeacherCodeGrantsForEnrollment } from "@/server/connect/grant-revocation";
import type {
  EnrollmentOrder,
  EnrollmentSource,
  EnrollmentSubscriptionStatus,
  InstitutePublicProfile,
  OfferingStatus,
  WorkspaceOffering,
} from "./types";

const TEACHER_ROLES = new Set(["owner", "admin", "teacher"]);
const ADMIN_ROLES = new Set(["owner", "admin"]);

async function requireTeacher(workspaceId: string, userId: string): Promise<void> {
  const ws = await getWorkspaceById(workspaceId);
  if (!ws) throw new AuthzError(404, "Workspace not found.");
  const m = await getActiveMembership(workspaceId, userId);
  if (!m || !TEACHER_ROLES.has(m.role)) {
    throw new AuthzError(403, "Teacher access required.");
  }
}

async function requireWorkspaceAdmin(workspaceId: string, userId: string): Promise<void> {
  const m = await getActiveMembership(workspaceId, userId);
  if (!m || !ADMIN_ROLES.has(m.role)) {
    throw new AuthzError(403, "Workspace admin required.");
  }
}

// ─── Offering CRUD ────────────────────────────────────────────────────────────

export async function createOfferingService(input: {
  workspaceId: string;
  actorUserId: string;
  title: string;
  description?: string | null;
  priceMinor: number;
  currency?: string;
  targetBatchId?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
}): Promise<WorkspaceOffering> {
  await requireTeacher(input.workspaceId, input.actorUserId);
  if (input.priceMinor < 0) throw new AuthzError(400, "Price must be non-negative.");

  const created: CreateOfferingInput = {
    workspaceId: input.workspaceId,
    title: input.title,
    description: input.description,
    priceMinor: input.priceMinor,
    currency: input.currency,
    targetBatchId: input.targetBatchId,
    metadata: input.metadata,
  };
  const offering = await storeCreateOffering(created);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "workspace_offering",
    entityId: offering.id,
    action: "offering.created",
    after: offering,
    requestId: input.requestId,
  });

  return offering;
}

export async function listOfferingsService(
  workspaceId: string,
  actorUserId: string,
  filter?: { status?: OfferingStatus | "all" },
): Promise<WorkspaceOffering[]> {
  await requireTeacher(workspaceId, actorUserId);
  return listOfferings(workspaceId, filter);
}

export async function getOfferingService(
  workspaceId: string,
  offeringId: string,
): Promise<WorkspaceOffering | null> {
  return getOffering(workspaceId, offeringId);
}

export async function updateOfferingService(input: {
  workspaceId: string;
  offeringId: string;
  actorUserId: string;
  patch: UpdateOfferingPatch;
  requestId?: string | null;
}): Promise<WorkspaceOffering | null> {
  await requireTeacher(input.workspaceId, input.actorUserId);
  if (input.patch.priceMinor !== undefined && input.patch.priceMinor < 0) {
    throw new AuthzError(400, "Price must be non-negative.");
  }
  const before = await getOffering(input.workspaceId, input.offeringId);
  if (!before) throw new AuthzError(404, "Offering not found.");

  const updated = await storeUpdateOffering(input.workspaceId, input.offeringId, input.patch);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "workspace_offering",
    entityId: input.offeringId,
    action: "offering.updated",
    before,
    after: updated,
    requestId: input.requestId,
  });

  // Phase 14: publishing a recurring offering creates its Razorpay plan in the
  // background so checkout never pays the plan-creation cost. Dark unless
  // teacherConnect is on; a queue hiccup here must never block the publish.
  if (
    updated &&
    input.patch.status === "active" &&
    isFeatureEnabled("teacherConnect") &&
    (updated.billingPeriod ?? "monthly") === "monthly" &&
    !updated.razorpayPlanId
  ) {
    try {
      const { enqueueOfferingPlanCreation } = await import(
        "@/server/connect/enrollment-subscription-service"
      );
      await enqueueOfferingPlanCreation(updated.workspaceId, updated.id);
    } catch (error) {
      console.error("[marketplace] offering plan enqueue failed", error);
    }
  }

  return updated;
}

// ─── Order lifecycle ──────────────────────────────────────────────────────────

export async function createOrderService(input: {
  workspaceId: string;
  offeringId: string;
  studentId: string;
  /** Optional at this stage: the provider name + payment intent ID can
   * be added later via initiatePayment when the provider hands back an
   * ID. */
  provider?: string | null;
  providerPaymentId?: string | null;
}): Promise<EnrollmentOrder> {
  const offering = await getOffering(input.workspaceId, input.offeringId);
  if (!offering) throw new AuthzError(404, "Offering not found.");
  if (offering.status !== "active") {
    throw new AuthzError(400, `Offering is ${offering.status}; not available for purchase.`);
  }

  // Duplicate-purchase idempotency (plan: phase 12 acceptance "duplicate
  // purchase handled idempotently"). If the student already has a non-
  // terminal or paid order for this offering, return that one — never
  // create a parallel order.
  const existing = await findReusableOrderForStudent({
    workspaceId: input.workspaceId,
    offeringId: input.offeringId,
    studentId: input.studentId,
  });
  if (existing) return existing;

  const created: CreateEnrollmentOrderInput = {
    workspaceId: input.workspaceId,
    offeringId: input.offeringId,
    studentId: input.studentId,
    amountMinor: offering.priceMinor,
    currency: offering.currency,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
  };
  const order = await storeCreateEnrollmentOrder(created);

  await recordAuditEvent({
    actorUserId: input.studentId,
    workspaceId: input.workspaceId,
    entityType: "enrollment_order",
    entityId: order.id,
    action: "order.created",
    after: order,
  });

  return order;
}

/** Find an order on the same (workspace, offering, student) tuple that
 * a new buy click should reuse instead of creating a duplicate:
 *   - status='paid'           → already bought, return same row.
 *   - status='created'        → checkout flow still in progress, reuse.
 *   - status='payment_pending'→ provider intent already issued, reuse.
 * 'failed', 'refunded', 'cancelled' are terminal — caller may retry. */
async function findReusableOrderForStudent(args: {
  workspaceId: string;
  offeringId: string;
  studentId: string;
}): Promise<EnrollmentOrder | null> {
  const all = await listStudentOrders(args.studentId);
  return (
    all.find(
      (o) =>
        o.workspaceId === args.workspaceId &&
        o.offeringId === args.offeringId &&
        (o.status === "paid" || o.status === "created" || o.status === "payment_pending"),
    ) ?? null
  );
}

export async function markOrderPaymentPendingService(input: {
  orderId: string;
  workspaceId: string;
  provider: string;
  providerPaymentId: string;
}): Promise<EnrollmentOrder | null> {
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  if (order.status !== "created") {
    throw new AuthzError(409, `Order is ${order.status}, expected created.`);
  }
  return updateOrderStatus(input.orderId, input.workspaceId, "payment_pending", {
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
  });
}

/**
 * Webhook handler: provider confirms successful payment.
 * Idempotent — re-running on the same providerPaymentId returns the
 * already-paid order without duplicating the enrollment.
 */
export async function markOrderPaidService(input: {
  orderId: string;
  workspaceId: string;
  provider: string;
  providerPaymentId: string;
}): Promise<EnrollmentOrder> {
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  if (order.status === "paid") return order; // idempotent re-entry
  if (order.status !== "created" && order.status !== "payment_pending") {
    throw new AuthzError(409, `Order is ${order.status}; cannot mark paid.`);
  }

  const offering = await getOffering(input.workspaceId, order.offeringId);
  if (!offering) throw new AuthzError(404, "Offering not found.");

  // Phase 14 back-port: only assign to the target batch when it still exists and
  // is active (closes the Phase-12 gap where a paid order could be routed to a
  // deleted/archived batch). The enrollment status mirrors whether we can assign.
  const targetBatch = offering.targetBatchId
    ? await getBatch(input.workspaceId, offering.targetBatchId)
    : null;
  const canAssignBatch = Boolean(targetBatch && targetBatch.status === "active");

  // Create or revive enrollment row first so we have its id to link.
  // enrollStudent() upserts on (workspace_id, student_id) and revives a
  // previously-left enrollment back to 'unassigned' so the batch
  // assignment below can move it to 'active'.
  const { enrollment } = await enrollStudent({
    workspaceId: input.workspaceId,
    studentId: order.studentId,
    source: "paid_app",
    initialStatus: canAssignBatch ? "active" : "unassigned",
  });

  const updated = await updateOrderStatus(input.orderId, input.workspaceId, "paid", {
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    enrollmentId: enrollment.id,
  });
  if (!updated) throw new Error("Failed to mark order paid.");

  // Assign to batch only when it is a live target.
  if (canAssignBatch && offering.targetBatchId) {
    await addStudentsToBatches({
      workspaceId: input.workspaceId,
      batchIds: [offering.targetBatchId],
      studentIds: [order.studentId],
      // null = system-initiated; FK constraint disallows sentinel strings.
      assignedBy: null,
    });
  }

  await recordAuditEvent({
    actorUserId: order.studentId,
    workspaceId: input.workspaceId,
    entityType: "enrollment_order",
    entityId: order.id,
    action: "order.paid",
    before: order,
    after: updated,
  });

  return updated;
}

export async function markOrderFailedService(input: {
  orderId: string;
  workspaceId: string;
  reason?: string | null;
}): Promise<EnrollmentOrder | null> {
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  if (order.status === "paid") {
    throw new AuthzError(409, "Cannot mark a paid order as failed; use refund instead.");
  }
  const updated = await updateOrderStatus(input.orderId, input.workspaceId, "failed");
  if (updated) {
    await recordAuditEvent({
      actorUserId: order.studentId,
      workspaceId: input.workspaceId,
      entityType: "enrollment_order",
      entityId: order.id,
      action: "order.failed",
      before: order,
      after: updated,
      requestId: input.reason ?? undefined,
    });
  }
  return updated;
}

export async function refundOrderService(input: {
  orderId: string;
  workspaceId: string;
  actorUserId: string;
  reason: string;
}): Promise<EnrollmentOrder> {
  await requireWorkspaceAdmin(input.workspaceId, input.actorUserId);
  const order = await getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  if (order.status !== "paid") {
    throw new AuthzError(409, `Order is ${order.status}; only paid orders can be refunded.`);
  }
  return applyEnrollmentOrderRefundBySystem({
    orderId: input.orderId,
    workspaceId: input.workspaceId,
    reason: input.reason,
    actorUserId: input.actorUserId,
  });
}

/** Subscription states that still give the student a live paid seat. */
const LIVE_ENROLLMENT_SUBSCRIPTION_STATUSES: ReadonlySet<EnrollmentSubscriptionStatus> = new Set([
  "active",
  "authenticated",
  "pending",
  "halted",
]);

/**
 * Pure teardown guard for a refunded enrolment order. Only an enrolment THIS
 * purchase created (`paid_app`) is torn down, and only when no other live paid
 * source keeps the student in the workspace — a second paid order or a live
 * Flow-2 subscription. Teacher-added / code / import enrolments are never
 * touched by a refund.
 */
export function shouldTearDownPaidEnrollment(input: {
  enrollmentSource: EnrollmentSource | null;
  enrollmentStatus?: string | null;
  hasOtherPaidOrder: boolean;
  hasLiveSubscription: boolean;
}): boolean {
  if (input.enrollmentSource !== "paid_app") return false;
  if (input.enrollmentStatus === "left") return false;
  return !input.hasOtherPaidOrder && !input.hasLiveSubscription;
}

/**
 * Store calls `runEnrollmentOrderRefund` needs. Injected so the ordering and
 * retry behaviour can be unit-tested without a database; production passes
 * `ENROLLMENT_REFUND_DEPS` (the real stores).
 */
export type EnrollmentRefundDeps = {
  getOrder: typeof getOrder;
  getOffering: typeof getOffering;
  getEnrollment: typeof getEnrollment;
  listStudentOrders: typeof listStudentOrders;
  listStudentEnrollmentSubscriptions: typeof listStudentEnrollmentSubscriptions;
  removeStudentFromBatch: typeof removeStudentFromBatch;
  setEnrollmentStatus: typeof setEnrollmentStatus;
  revokeTeacherCodeGrantsForEnrollment: typeof revokeTeacherCodeGrantsForEnrollment;
  updateOrderStatus: typeof updateOrderStatus;
  recordAuditEvent: typeof recordAuditEvent;
};

const ENROLLMENT_REFUND_DEPS: EnrollmentRefundDeps = {
  getOrder,
  getOffering,
  getEnrollment,
  listStudentOrders,
  listStudentEnrollmentSubscriptions,
  removeStudentFromBatch,
  setEnrollmentStatus,
  revokeTeacherCodeGrantsForEnrollment,
  updateOrderStatus,
  recordAuditEvent,
};

/**
 * Marks a paid enrolment order refunded and removes the access it bought.
 *
 * The system path behind a processed Razorpay refund (outbox kind
 * `institute_enrollment_revoke`) and the body of the admin `refundOrderService`
 * after its authz check. `commerce.enrollment_orders.status='refunded'` is the
 * "is this paid for" marker; `status='left'` on the enrolment is the access
 * revocation (`enrollStudent` revives `left` rows on a re-purchase).
 *
 * ORDER MATTERS. The steps are not one transaction (each store call has its
 * own pool query + schema ensure), so the teardown runs FIRST and the status
 * flip runs LAST:
 *   1. remove the batch seat   (idempotent: only `status='active'` rows change)
 *   2. set the enrolment `left` (idempotent: `shouldTearDownPaidEnrollment`
 *      skips an enrolment that is already `left`)
 *   3. revoke the institute's free Flow-1 `teacher_code` subject, which only
 *      lives while the enrolment does (idempotent: a second call revokes 0)
 *   4. flip the order to `refunded`
 * A transient error at any step throws, the outbox retries, and the retry
 * re-runs whatever is left. Flipping the status first (the old order) let a
 * retry exit early on `refunded` while the student kept the seat.
 *
 * Re-entry on an order that is ALREADY `refunded` still re-checks the
 * enrolment and finishes the teardown if it is not done, which also repairs
 * orders left half-done by the old ordering. A fully torn-down refunded order
 * is a no-op (no writes, no second audit event).
 */
export async function applyEnrollmentOrderRefundBySystem(input: {
  orderId: string;
  workspaceId: string;
  reason: string;
  actorUserId?: string | null;
}): Promise<EnrollmentOrder> {
  return runEnrollmentOrderRefund(input, ENROLLMENT_REFUND_DEPS);
}

/** Body of `applyEnrollmentOrderRefundBySystem` with its stores injected. */
export async function runEnrollmentOrderRefund(
  input: { orderId: string; workspaceId: string; reason: string; actorUserId?: string | null },
  deps: EnrollmentRefundDeps,
): Promise<EnrollmentOrder> {
  const order = await deps.getOrder(input.workspaceId, input.orderId);
  if (!order) throw new AuthzError(404, "Order not found.");
  const alreadyRefunded = order.status === "refunded";
  if (!alreadyRefunded && order.status !== "paid") {
    // Not yet paid locally (its institute_enrollment row has not run): throw so
    // the outbox retries after the enrolment lands, then tears it down.
    throw new AuthzError(409, `Order is ${order.status}; only paid orders can be refunded.`);
  }

  const [offering, enrollment, studentOrders, subscriptions] = await Promise.all([
    deps.getOffering(input.workspaceId, order.offeringId),
    deps.getEnrollment(input.workspaceId, order.studentId),
    deps.listStudentOrders(order.studentId),
    deps.listStudentEnrollmentSubscriptions(order.studentId),
  ]);
  const tearDown = shouldTearDownPaidEnrollment({
    enrollmentSource: enrollment?.source ?? null,
    enrollmentStatus: enrollment?.status ?? null,
    // Excludes THIS order, which is still `paid` until step 3 below.
    hasOtherPaidOrder: studentOrders.some(
      (other) => other.id !== order.id && other.workspaceId === input.workspaceId && other.status === "paid",
    ),
    hasLiveSubscription: subscriptions.some(
      (sub) => sub.workspaceId === input.workspaceId && LIVE_ENROLLMENT_SUBSCRIPTION_STATUSES.has(sub.status),
    ),
  });

  // Fully done already (outbox retry after success): nothing to write.
  if (alreadyRefunded && !tearDown) return order;

  if (tearDown) {
    // Batch seat before the enrolment: if this throws, the enrolment is still
    // active, so the retry decides to tear down again and redoes both.
    if (offering?.targetBatchId) {
      await deps.removeStudentFromBatch({
        workspaceId: input.workspaceId,
        batchId: offering.targetBatchId,
        studentId: order.studentId,
      });
    }
    await deps.setEnrollmentStatus(input.workspaceId, order.studentId, "left", { notes: input.reason });
  }

  // "left => free Flow-1 subject revoked" (connect-grants F13). Also on a retry
  // whose earlier attempt set the enrolment `left` and then failed here: that
  // retry no longer tears down (the enrolment is already `left`), but the order
  // is still `paid`, so the revoke must run again before the flip below.
  const paidEnrollmentLeft = enrollment?.source === "paid_app" && enrollment.status === "left";
  if (tearDown || paidEnrollmentLeft) {
    await deps.revokeTeacherCodeGrantsForEnrollment({
      studentId: order.studentId,
      workspaceId: input.workspaceId,
      status: "left",
      actorUserId: input.actorUserId ?? null,
      reason: "enrollment_refunded",
      requestId: input.reason,
    });
  }

  let updated = order;
  if (!alreadyRefunded) {
    const flipped = await deps.updateOrderStatus(input.orderId, input.workspaceId, "refunded");
    if (!flipped) throw new Error("Failed to update order to refunded.");
    updated = flipped;
  }

  await deps.recordAuditEvent({
    actorUserId: input.actorUserId ?? order.studentId,
    workspaceId: input.workspaceId,
    entityType: "enrollment_order",
    entityId: order.id,
    action: alreadyRefunded ? "order.refund_teardown_completed" : "order.refunded",
    before: order,
    after: {
      ...updated,
      refundReason: input.reason,
      enrollmentTornDown: tearDown,
      // True when an earlier, interrupted attempt already removed the seat.
      enrollmentAlreadyLeft: enrollment?.source === "paid_app" && enrollment.status === "left",
    },
  });
  return updated;
}

export async function listStudentOrdersService(studentId: string): Promise<EnrollmentOrder[]> {
  return listStudentOrders(studentId);
}

// ─── Public marketplace read-side ─────────────────────────────────────────────

export async function getInstituteProfileService(workspaceId: string): Promise<InstitutePublicProfile | null> {
  return getInstitutePublicProfile(workspaceId);
}

export async function listPublicInstitutesService(
  filter?: PublicInstituteFilter,
): Promise<InstitutePublicProfile[]> {
  const institutes = await listPublicInstitutes(filter);

  // ODG Phase 3: re-rank by node-activation score when enabled. The base list is
  // already ordered by verification/recency; we apply a stable sort that keeps
  // verified-first but promotes institutes whose teaching demonstrably lifts
  // mastery. Best-effort: any failure leaves the base order untouched.
  if (!isFeatureEnabled("odgTeacherRanking") || institutes.length < 2) {
    return institutes;
  }
  try {
    const { getOdgTeacherRanking } = await import("@/server/analytics-client");
    const ranking = await getOdgTeacherRanking({ subject: filter?.subject });
    if (ranking.length === 0) return institutes;

    const scoreByWorkspace = new Map(ranking.map((entry) => [entry.workspace_id, entry.score]));
    return institutes
      .map((institute, index) => ({ institute, index }))
      .sort((a, b) => {
        // Keep verified institutes ahead of unverified ones.
        if (a.institute.verified !== b.institute.verified) {
          return a.institute.verified ? -1 : 1;
        }
        const scoreA = scoreByWorkspace.get(a.institute.workspaceId) ?? -1;
        const scoreB = scoreByWorkspace.get(b.institute.workspaceId) ?? -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.index - b.index; // stable: preserve original order on ties
      })
      .map((entry) => entry.institute);
  } catch (error) {
    console.error("[marketplace] ODG ranking re-rank failed", error);
    return institutes;
  }
}
