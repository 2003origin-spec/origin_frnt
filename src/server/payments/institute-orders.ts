/**
 * Institute one-time offerings on Rail A (plan G16, Phase 6).
 *
 * Before this, `commerce.enrollment_orders` was marked paid by an EXTERNAL
 * caller holding `PAYMENT_WEBHOOK_TOKEN` — there was no gateway behind it, so
 * the institute one-time flow had never actually taken money. It now rides the
 * same Rail-A order → Razorpay → capture → `applyPaymentSuccess()` path as
 * prepaid subject terms, with the commerce order as the downstream side effect.
 *
 * The token path is intentionally left in place (back-compat, plan Phase 6
 * "existing ledgers keep working"); both converge on `markOrderPaidService`,
 * which is idempotent on the already-paid order.
 */

import { AuthzError } from "@/server/authz";
import { createOrderService, markOrderPaidService } from "@/server/workspaces/marketplace-service";
import { getOffering } from "@/server/workspaces/marketplace-store";
import type { EnrollmentOrder, WorkspaceOffering } from "@/server/workspaces/types";

const CURRENCY = "INR";

export type InstituteOfferingCheckoutTarget = {
  workspaceId: string;
  offeringId: string;
  title: string;
  amountMinor: number;
  currency: string;
  offering: WorkspaceOffering;
};

/**
 * Guard chain for a one-time institute purchase. Deliberately mirrors the
 * checks `createOrderService` already applies, plus the two Rail A invariants
 * (INR only, and a recurring offering belongs on the Connect rail, not here).
 */
export async function resolveInstituteOffering(input: {
  workspaceId: string;
  offeringId: string;
}): Promise<InstituteOfferingCheckoutTarget> {
  const offering = await getOffering(input.workspaceId, input.offeringId);
  if (!offering) throw new AuthzError(404, "Offering not found.");
  if (offering.status !== "active") {
    throw new AuthzError(400, `Offering is ${offering.status}; not available for purchase.`);
  }
  // Flow-2 (recurring batch tuition) offerings belong on the Connect
  // subscription rail, not here. `billing_period` alone cannot decide that: the
  // column was added in Phase 14 with DEFAULT 'monthly', so every pre-Phase-14
  // one-time offering inherited it. A Razorpay PLAN is what actually marks an
  // offering as set up for recurring billing — it is created at publish time
  // only for that rail — so the two signals together are the reliable test.
  if (offering.billingPeriod === "monthly" && offering.razorpayPlanId) {
    throw new AuthzError(
      400,
      "This offering bills monthly and is enrolled through the institute checkout, not a one-time order.",
    );
  }
  const currency = (offering.currency || CURRENCY).toUpperCase();
  if (currency !== CURRENCY) {
    throw new AuthzError(400, "Only INR offerings can be purchased through Razorpay.");
  }
  if (!Number.isFinite(offering.priceMinor) || offering.priceMinor < 0) {
    throw new AuthzError(400, "This offering has no valid price.");
  }

  return {
    workspaceId: input.workspaceId,
    offeringId: input.offeringId,
    title: offering.title,
    amountMinor: Math.round(offering.priceMinor),
    currency,
    offering,
  };
}

/**
 * Opens (or reuses) the `commerce.enrollment_orders` row that a Rail-A order
 * pays for. `createOrderService` already returns an existing non-terminal or
 * paid order for the same (workspace, offering, student), so a second checkout
 * attempt reuses one commerce order rather than minting a parallel one.
 */
export async function openInstituteEnrollmentOrder(input: {
  workspaceId: string;
  offeringId: string;
  studentId: string;
}): Promise<EnrollmentOrder> {
  return createOrderService({
    workspaceId: input.workspaceId,
    offeringId: input.offeringId,
    studentId: input.studentId,
    provider: "razorpay",
  });
}

export type ApplyInstituteEnrollmentInput = {
  enrollmentOrderId: string;
  workspaceId: string;
  razorpayPaymentId: string;
};

/**
 * Executed by the transactional outbox after a capture commits.
 *
 * Kept OUT of the payment transaction on purpose: enrolling a student touches
 * `app.workspace_student_enrollments`, batches and the audit log through their
 * own services, and a failure there must not roll back the money ledger.
 * `markOrderPaidService` returns the already-paid order unchanged on re-entry,
 * so a retried outbox row cannot double-enrol.
 */
export async function applyInstituteEnrollment(
  input: ApplyInstituteEnrollmentInput,
): Promise<EnrollmentOrder> {
  return markOrderPaidService({
    orderId: input.enrollmentOrderId,
    workspaceId: input.workspaceId,
    provider: "razorpay",
    providerPaymentId: input.razorpayPaymentId,
  });
}
