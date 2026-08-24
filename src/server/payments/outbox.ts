/**
 * Transactional payment-outbox consumer.
 *
 * `applyPaymentSuccess()` (and the later refund/dunning paths) enqueue rows in
 * the same database transaction as the money/entitlement change. This module
 * is deliberately the only place that performs the slow side effects. A
 * claimed row is executed at most once concurrently; a failed delivery is
 * returned to the store's retry state by `dispatchOutbox`/`drainOutbox`.
 */

import {
  createDeterministicNotification,
  type NotificationType,
} from "@/server/notifications";
import { sendEmail, type SendEmailInput, type SendEmailResult } from "@/server/email";

import {
  claimDueOutboxRows,
  claimOutboxRow,
  markOutboxDone,
  markOutboxFailed,
  type OutboxRow,
} from "./payments-store";
import {
  renderDunningEmail,
  renderPaymentFailedEmail,
  renderReceiptEmail,
  renderRefundEmail,
  type PaymentDunningPayload,
  type PaymentFailedPayload,
  type PaymentReceiptPayload,
  type PaymentRefundPayload,
} from "./emails";

export type OutboxDeliveryResult = {
  email: { sent: boolean; skipped: boolean; messageId?: string };
  notification: { sent: boolean; skipped: boolean };
};

export type OutboxDispatchResult =
  | { status: "done"; id: string; result: OutboxDeliveryResult }
  | { status: "skipped"; id: string; reason: "not_due_or_already_claimed" };

export type OutboxDispatchDeps = {
  sendEmail?: (input: SendEmailInput) => Promise<SendEmailResult>;
  createNotification?: (
    id: string,
    userId: string,
    input: { type?: NotificationType; title: string; message?: string; href?: string | null },
  ) => Promise<void>;
  claimOutboxRow?: typeof claimOutboxRow;
  claimDueOutboxRows?: typeof claimDueOutboxRows;
  markOutboxDone?: typeof markOutboxDone;
  markOutboxFailed?: typeof markOutboxFailed;
};

export type OutboxDrainResult = {
  claimed: number;
  done: number;
  failed: number;
  skipped: number;
};

type LoosePayload = Record<string, unknown>;

function asText(value: unknown): string | null {
  if (typeof value !== "string") return value == null ? null : String(value);
  const trimmed = value.trim();
  return trimmed || null;
}

function firstText(payload: LoosePayload, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asText(payload[key]);
    if (value) return value;
  }
  return null;
}

function firstNumber(payload: LoosePayload, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (value == null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return Math.round(number);
  }
  return null;
}

function firstBoolean(payload: LoosePayload, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = payload[key];
    if (value == null) continue;
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }
  return null;
}

/** Accept both the plan's camelCase payload and SQL/webhook snake_case names. */
export function normalizeOutboxPayload(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    to: firstText(value, "to", "email", "recipient", "recipientEmail"),
    email: firstText(value, "email", "to", "recipient", "recipientEmail"),
    userId: firstText(value, "userId", "user_id"),
    studentName: firstText(value, "studentName", "student_name", "name"),
    orderId: firstText(value, "orderId", "order_id"),
    paymentId: firstText(value, "paymentId", "payment_id", "razorpayPaymentId", "razorpay_payment_id"),
    amountMinor: firstNumber(value, "amountMinor", "amount_minor", "amount"),
    currency: firstText(value, "currency") ?? "INR",
    subject: firstText(value, "subject"),
    kind: firstText(value, "kind", "orderKind", "order_kind"),
    termMonths: firstNumber(value, "termMonths", "term_months"),
    paidAt: firstText(value, "paidAt", "paid_at", "capturedAt", "captured_at"),
    expiresAt: firstText(value, "expiresAt", "expires_at"),
    href: firstText(value, "href", "notificationHref"),
  };
}

function payloadTarget(payload: LoosePayload): { userId: string | null; to: string | null } {
  return {
    userId: firstText(payload, "userId", "user_id"),
    to: firstText(payload, "to", "email", "recipient", "recipientEmail"),
  };
}

function productLabel(payload: LoosePayload): string {
  const subject = firstText(payload, "subject");
  if (subject) return `${subject[0].toUpperCase()}${subject.slice(1)} Premium`;
  const kind = firstText(payload, "kind", "orderKind", "order_kind");
  return kind?.includes("bundle") ? "All-subjects bundle" : "Origin Premium access";
}

function notificationCopy(
  kind: string,
  payload: LoosePayload,
): { type: NotificationType; title: string; message: string; href: string } {
  const customTitle = firstText(payload, "notificationTitle", "notification_title");
  const customMessage = firstText(payload, "notificationMessage", "notification_message");
  const href = firstText(payload, "href", "notificationHref") ?? "/premium";
  if (customTitle || customMessage) {
    return {
      type: kind === "receipt_email" ? "success" : kind.includes("failed") ? "warning" : "info",
      title: customTitle ?? "Origin payment update",
      message: customMessage ?? "Your Origin payment has been updated.",
      href,
    };
  }
  const item = productLabel(payload);
  if (kind === "receipt_email" || kind === "receipt" || kind === "payment_receipt") {
    return { type: "success", title: "Payment received", message: `Your payment for ${item} was received. Your access is active.`, href };
  }
  if (kind === "payment_failed_email" || kind === "payment_failed" || kind === "failed_email") {
    const reason = firstText(payload, "failureReason", "failure_reason") ?? "The payment was not completed.";
    return { type: "warning", title: "Payment failed", message: `${item}: ${reason}`, href };
  }
  if (kind === "refund_email" || kind === "refund" || kind === "payment_refund_email") {
    return { type: "info", title: "Refund processed", message: `A refund for ${item} has been processed.`, href };
  }
  if (kind === "dunning_email" || kind === "dunning") {
    if (firstText(payload, "dunningKind", "dunning_kind") === "mandate_failed") {
      return { type: "warning", title: "Payment action needed", message: `We could not collect the latest payment for ${item}. Update or retry the mandate to keep access active.`, href };
    }
    return { type: "warning", title: "Premium access ending soon", message: `${item} access is ending soon. Choose another term to continue learning.`, href };
  }
  return {
    type: (firstText(payload, "type") as NotificationType | null) ?? "info",
    title: firstText(payload, "title", "notificationTitle") ?? "Origin notification",
    message: firstText(payload, "message", "notificationMessage") ?? "You have a new Origin update.",
    href,
  };
}

export function paymentNotificationId(outboxId: string, payload: Record<string, unknown> = {}): string {
  const explicit = firstText(payload, "notificationId", "notification_id");
  return explicit ?? `payment:${outboxId}`;
}

function asReceiptPayload(payload: LoosePayload): PaymentReceiptPayload {
  return normalizeOutboxPayload(payload) as PaymentReceiptPayload;
}

function asFailedPayload(payload: LoosePayload): PaymentFailedPayload {
  const normalized = normalizeOutboxPayload(payload);
  return {
    ...normalized,
    failureReason: firstText(payload, "failureReason", "failure_reason", "reason"),
    retryHref: firstText(payload, "retryHref", "retry_href"),
  } as PaymentFailedPayload;
}

function asRefundPayload(payload: LoosePayload): PaymentRefundPayload {
  const normalized = normalizeOutboxPayload(payload);
  return {
    ...normalized,
    refundId: firstText(payload, "refundId", "refund_id"),
    refundAmountMinor: firstNumber(payload, "refundAmountMinor", "refund_amount_minor", "refundAmount", "refund_amount"),
    isFull: firstBoolean(payload, "isFull", "is_full"),
    refundReason: firstText(payload, "refundReason", "refund_reason", "reason"),
  } as PaymentRefundPayload;
}

function asDunningPayload(payload: LoosePayload): PaymentDunningPayload {
  const normalized = normalizeOutboxPayload(payload);
  return {
    ...normalized,
    daysUntilExpiry: firstNumber(payload, "daysUntilExpiry", "days_until_expiry"),
    dunningKind: firstText(payload, "dunningKind", "dunning_kind") ?? undefined,
    retryHref: firstText(payload, "retryHref", "retry_href"),
  } as PaymentDunningPayload;
}

function emailFor(kind: string, payload: LoosePayload): SendEmailInput | null {
  if (kind === "receipt_email" || kind === "receipt" || kind === "payment_receipt") return renderReceiptEmail(asReceiptPayload(payload));
  if (kind === "payment_failed_email" || kind === "payment_failed" || kind === "failed_email") return renderPaymentFailedEmail(asFailedPayload(payload));
  if (kind === "refund_email" || kind === "refund" || kind === "payment_refund_email") return renderRefundEmail(asRefundPayload(payload));
  if (kind === "dunning_email" || kind === "dunning") return renderDunningEmail(asDunningPayload(payload));
  return null;
}

function isNotificationOnly(kind: string): boolean {
  return kind === "notification" || kind === "in_app_notification";
}

/**
 * Kinds whose whole job is a server-side side effect, not a message. They send
 * no mail and write no notification of their own — the receipt row enqueued
 * alongside them in the same transaction is what the student sees.
 */
function isActionOnly(kind: string): boolean {
  return kind === "institute_enrollment";
}

/**
 * Runs the side effect for an action-only row. Dynamically imported so the
 * outbox keeps no static dependency on the marketplace/enrolment services,
 * which reach back into payments through applyPaymentSuccess.
 */
async function runOutboxAction(kind: string, payload: LoosePayload): Promise<void> {
  if (kind !== "institute_enrollment") throw new Error(`No action for payment outbox kind: ${kind}`);
  const enrollmentOrderId = firstText(payload, "enrollmentOrderId", "enrollment_order_id");
  const workspaceId = firstText(payload, "workspaceId", "workspace_id");
  const razorpayPaymentId = firstText(payload, "paymentId", "payment_id", "razorpayPaymentId");
  if (!enrollmentOrderId || !workspaceId || !razorpayPaymentId) {
    throw new Error("institute_enrollment outbox row is missing its order reference");
  }
  const { applyInstituteEnrollment } = await import("./institute-orders");
  await applyInstituteEnrollment({ enrollmentOrderId, workspaceId, razorpayPaymentId });
}

function isKnownKind(kind: string): boolean {
  return Boolean(emailFor(kind, {}) || isNotificationOnly(kind) || isActionOnly(kind));
}

/** Execute side effects for one already-claimed row; does not mutate outbox status. */
export async function dispatchOutboxRow(
  row: OutboxRow,
  deps: Pick<OutboxDispatchDeps, "sendEmail" | "createNotification"> = {},
): Promise<OutboxDeliveryResult> {
  const kind = row.kind.trim().toLowerCase();
  if (!isKnownKind(kind)) throw new Error(`Unsupported payment outbox kind: ${row.kind}`);

  const payload = normalizeOutboxPayload(row.payload);
  const target = payloadTarget(payload);
  const send = deps.sendEmail ?? sendEmail;
  const notify = deps.createNotification ?? createDeterministicNotification;
  const notification = notificationCopy(kind, payload);
  let notificationResult: OutboxDeliveryResult["notification"] = { sent: false, skipped: true };
  let emailResult: OutboxDeliveryResult["email"] = { sent: false, skipped: true };

  // Action-only rows carry no message: their companion receipt row does the
  // mailing, so notifying here would double up in the student's inbox/bell.
  if (isActionOnly(kind)) {
    await runOutboxAction(kind, row.payload as LoosePayload);
    return { email: emailResult, notification: notificationResult };
  }

  // Write the deterministic in-app record first. If mail then fails, a retry
  // sees the same notification id and the INSERT becomes a no-op, while mail
  // gets another attempt. This minimises duplicate emails on crash recovery.
  if (target.userId) {
    await notify(paymentNotificationId(row.id, row.payload), target.userId, notification);
    notificationResult = { sent: true, skipped: false };
  }

  if (!isNotificationOnly(kind)) {
    const rendered = emailFor(kind, payload);
    if (!rendered) throw new Error(`No renderer for payment outbox kind: ${row.kind}`);
    if (rendered.to.trim()) {
      const result = await send(rendered);
      if (!result.success) {
        const detail = result.error instanceof Error ? result.error.message : String(result.error);
        throw new Error(`Payment email delivery failed: ${detail}`);
      }
      emailResult = { sent: true, skipped: false, messageId: result.messageId };
    }
  }

  return { email: emailResult, notification: notificationResult };
}

function retryDelaySeconds(attempts: number): number {
  // 1m, 2m, 4m, 8m, 16m, capped at 30m; the store parks the row at its cap.
  return Math.min(30 * 60, 60 * 2 ** Math.max(0, Math.min(attempts - 1, 5)));
}

/** Claim, execute, and terminally mark one row (QStash or direct invocation). */
export async function dispatchOutbox(
  id: string,
  via = "cron",
  deps: OutboxDispatchDeps = {},
): Promise<OutboxDispatchResult> {
  const claim = deps.claimOutboxRow ?? claimOutboxRow;
  const row = await claim(id);
  if (!row) return { status: "skipped", id, reason: "not_due_or_already_claimed" };
  try {
    const result = await dispatchOutboxRow(row, deps);
    await (deps.markOutboxDone ?? markOutboxDone)(row.id, via);
    return { status: "done", id: row.id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await (deps.markOutboxFailed ?? markOutboxFailed)(row.id, message, retryDelaySeconds(row.attempts));
    throw error;
  }
}

/** Claim and process a bounded batch for the minute cron backstop. */
export async function drainOutbox(limit = 25, deps: OutboxDispatchDeps = {}): Promise<OutboxDrainResult> {
  const claimMany = deps.claimDueOutboxRows ?? claimDueOutboxRows;
  const rows = await claimMany(Math.min(Math.max(Math.trunc(limit), 1), 100));
  const result: OutboxDrainResult = { claimed: rows.length, done: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    try {
      await dispatchOutboxRow(row, deps);
      await (deps.markOutboxDone ?? markOutboxDone)(row.id, "cron");
      result.done += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await (deps.markOutboxFailed ?? markOutboxFailed)(row.id, message, retryDelaySeconds(row.attempts));
      result.failed += 1;
    }
  }
  return result;
}
