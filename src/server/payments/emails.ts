/**
 * Payment email copy and delivery helpers.
 *
 * Payment state is committed before any of these functions run.  They are
 * intentionally small side-effect adapters for the transactional outbox: a
 * delivery failure is represented by a rejected promise so the caller can
 * leave the row retryable, while the entitlement transaction is never rolled
 * back because an SMTP provider is unavailable.
 */

import { sendEmail as defaultSendEmail, type SendEmailInput, type SendEmailResult } from "@/server/email";
import { absoluteHref } from "@/server/email/assets";
import { detailsCard, infoStrip, paragraph, renderEmail, type DetailRow } from "@/server/email/layout";

/** Fields shared by all payment side-effect payloads. */
export type PaymentEmailBase = {
  /** Recipient. `email` is accepted as an alias for outbox rows from older code. */
  to?: string | null;
  email?: string | null;
  userId?: string | null;
  studentName?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  subject?: string | null;
  kind?: string | null;
  termMonths?: number | null;
  paidAt?: string | null;
  expiresAt?: string | null;
  /** Optional absolute or app-relative link to the relevant payment surface. */
  href?: string | null;
};

export type PaymentReceiptPayload = PaymentEmailBase & {
  type?: "receipt";
};

export type PaymentFailedPayload = PaymentEmailBase & {
  failureReason?: string | null;
  retryHref?: string | null;
  type?: "payment_failed";
};

export type PaymentRefundPayload = PaymentEmailBase & {
  refundId?: string | null;
  refundAmountMinor?: number | null;
  isFull?: boolean | null;
  refundReason?: string | null;
  type?: "refund";
};

export type PaymentDunningPayload = PaymentEmailBase & {
  daysUntilExpiry?: number | null;
  dunningKind?: "expiry_warning" | "mandate_failed" | "payment_retry" | string;
  retryHref?: string | null;
  type?: "dunning";
};

export type PaymentEmailPayload =
  | PaymentReceiptPayload
  | PaymentFailedPayload
  | PaymentRefundPayload
  | PaymentDunningPayload;

export type RenderedPaymentEmail = SendEmailInput;

export type PaymentEmailDelivery = {
  sent: boolean;
  skipped: boolean;
  messageId?: string;
};

export type PaymentEmailSender = (input: SendEmailInput) => Promise<SendEmailResult>;

export class PaymentEmailError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PaymentEmailError";
  }
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function recipient(payload: PaymentEmailBase): string | null {
  const value = text(payload.to ?? payload.email);
  return value || null;
}

function displayName(payload: PaymentEmailBase): string {
  return text(payload.studentName, "there");
}

function currencyCode(payload: PaymentEmailBase): string {
  const value = text(payload.currency, "INR").toUpperCase();
  return /^[A-Z]{3}$/u.test(value) ? value : "INR";
}

/** Format minor units without ever displaying fractional paise. */
export function formatPaymentAmount(amountMinor: number | null | undefined, currency = "INR"): string {
  const amount = Number.isFinite(Number(amountMinor)) ? Math.max(0, Math.round(Number(amountMinor))) : 0;
  const code = /^[A-Z]{3}$/u.test(currency.toUpperCase()) ? currency.toUpperCase() : "INR";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  } catch {
    return `${code} ${(amount / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function productLabel(payload: PaymentEmailBase): string {
  const subject = text(payload.subject);
  if (subject) return `${subject[0].toUpperCase()}${subject.slice(1)} Premium`;
  if (payload.kind === "bundle_term" || text(payload.kind).includes("bundle")) return "All-subjects bundle";
  return "Origin Premium access";
}

function termLabel(payload: PaymentEmailBase): string {
  const months = Number(payload.termMonths);
  if (!Number.isInteger(months) || months <= 0) return "your selected term";
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function renderReceiptEmail(payload: PaymentReceiptPayload): RenderedPaymentEmail {
  const item = productLabel(payload);
  const amount = formatPaymentAmount(payload.amountMinor, currencyCode(payload));
  const paidAt = formatDate(payload.paidAt);
  const expiry = formatDate(payload.expiresAt);
  const name = displayName(payload);
  const href = absoluteHref(payload.href);
  const subject = "Your Origin payment was received";
  const textBody = [
    `Hi ${name},`,
    "",
    `We received your payment of ${amount} for ${item} (${termLabel(payload)}).`,
    payload.orderId ? `Order: ${payload.orderId}.` : "",
    payload.paymentId ? `Payment: ${payload.paymentId}.` : "",
    paidAt ? `Paid on: ${paidAt}.` : "",
    expiry ? `Your access is active until ${expiry}.` : "Your access is now active.",
    "",
    `Open Origin Premium: ${href}`,
    "",
    "Thank you for learning with Origin.",
  ].filter(Boolean).join("\n");
  const rows: DetailRow[] = [
    { label: "Item", value: `${item} (${termLabel(payload)})` },
    { label: "Amount", value: amount },
    { label: "Order ID", value: text(payload.orderId) },
    { label: "Payment ID", value: text(payload.paymentId) },
    { label: "Paid on", value: paidAt },
    { label: "Status", value: "Success", pill: "success" },
  ];
  return {
    to: recipient(payload) ?? "",
    subject,
    text: textBody,
    html: renderEmail({
      preheader: `We received your payment of ${amount} for ${item}.`,
      documentTitle: "Origin - Payment Successful",
      mascot: "happy",
      title: "Payment",
      titleAccent: "Successful!",
      accent: "green",
      intro: [`Hi ${name}, your payment has been processed successfully.`, "Thank you for your trust in Origin."],
      blocks: [
        detailsCard("Payment Details", rows),
        infoStrip(
          expiry ? `Your access is active until ${expiry}.` : "Your access is now active.",
          "You're all set — let's build your future together.",
          "success",
          "thumbsup",
        ),
      ],
      cta: { label: "Open Premium", href },
      footerNote: "If you didn't make this payment, please contact our support team immediately.",
    }),
  };
}

export function renderPaymentFailedEmail(payload: PaymentFailedPayload): RenderedPaymentEmail {
  const item = productLabel(payload);
  const reason = text(payload.failureReason, "The payment was not completed.");
  const href = absoluteHref(payload.retryHref ?? payload.href);
  const name = displayName(payload);
  const subject = "Your Origin payment could not be completed";
  const textBody = [
    `Hi ${name},`,
    "",
    `We couldn't complete your payment for ${item}.`,
    `Reason: ${reason}`,
    payload.orderId ? `Order: ${payload.orderId}.` : "",
    "No access was charged for this failed attempt. You can start a new checkout whenever you're ready.",
    `Try again: ${href}`,
  ].filter(Boolean).join("\n");
  const rows: DetailRow[] = [
    { label: "Item", value: item },
    { label: "Amount", value: formatPaymentAmount(payload.amountMinor, currencyCode(payload)) },
    { label: "Order ID", value: text(payload.orderId) },
    { label: "Status", value: "Failed", pill: "danger" },
    { label: "Reason", value: reason },
  ];
  return {
    to: recipient(payload) ?? "",
    subject,
    text: textBody,
    html: renderEmail({
      preheader: `We couldn't complete your payment for ${item}.`,
      documentTitle: "Origin - Payment Failed",
      mascot: "failed",
      title: "Payment",
      titleAccent: "Failed",
      accent: "red",
      intro: [`Hi ${name}, we couldn't process your payment.`, "Please try again or use a different method."],
      blocks: [
        detailsCard("Payment Details", rows),
        infoStrip(
          "Don't worry, it happens!",
          "No access was charged for this failed attempt — try again whenever you're ready.",
          "danger",
          "failed",
        ),
      ],
      cta: { label: "Try again", href, accent: "red" },
      footerNote: "If you didn't attempt this payment, please contact our support team immediately.",
    }),
  };
}

export function renderRefundEmail(payload: PaymentRefundPayload): RenderedPaymentEmail {
  const refundAmount = formatPaymentAmount(payload.refundAmountMinor ?? payload.amountMinor, currencyCode(payload));
  const item = productLabel(payload);
  const full = payload.isFull === true;
  const name = displayName(payload);
  const subject = full ? "Your Origin payment was refunded" : "Your Origin payment was partially refunded";
  const accessLine = full
    ? "Your Premium access for this purchase has been revoked."
    : "Your existing Premium access remains active until its original expiry.";
  const textBody = [
    `Hi ${name},`,
    "",
    `A refund of ${refundAmount} was processed for ${item}.`,
    payload.refundId ? `Refund: ${payload.refundId}.` : "",
    accessLine,
    payload.refundReason ? `Reason: ${payload.refundReason}` : "",
    `Visit Origin Premium: ${absoluteHref(payload.href)}`,
  ].filter(Boolean).join("\n");
  const rows: DetailRow[] = [
    { label: "Item", value: item },
    { label: "Refund amount", value: refundAmount },
    { label: "Refund ID", value: text(payload.refundId) },
    { label: "Order ID", value: text(payload.orderId) },
    { label: "Reason", value: text(payload.refundReason) },
    { label: "Status", value: full ? "Refunded" : "Partially refunded", pill: "info" },
  ];
  return {
    to: recipient(payload) ?? "",
    subject,
    text: textBody,
    html: renderEmail({
      preheader: `A refund of ${refundAmount} was processed for ${item}.`,
      documentTitle: "Origin - Payment Refunded",
      mascot: "thumbsup",
      title: "Payment",
      titleAccent: full ? "Refunded" : "Partially Refunded",
      intro: [`Hi ${name}, your refund has been processed.`, "It will reach your original payment method shortly."],
      blocks: [
        detailsCard("Refund Details", rows),
        infoStrip(
          "Refunds typically take 5–7 working days",
          "to appear in your bank or UPI account.",
          "info",
          "thumbsup",
        ),
        paragraph(accessLine, { muted: true, size: 14, align: "center" }),
      ],
      cta: { label: "Open Premium", href: absoluteHref(payload.href) },
      footerNote: "If you did not request this refund, please contact our support team immediately.",
    }),
  };
}

export function renderDunningEmail(payload: PaymentDunningPayload): RenderedPaymentEmail {
  const item = productLabel(payload);
  const name = displayName(payload);
  const days = Number(payload.daysUntilExpiry);
  const expiry = formatDate(payload.expiresAt);
  const mandateFailed = payload.dunningKind === "mandate_failed";
  const subject = mandateFailed ? "Action needed for your Origin Premium access" : "Your Origin Premium access is ending soon";
  const timing = Number.isInteger(days) && days >= 0 ? `in ${days} day${days === 1 ? "" : "s"}` : expiry ? `on ${expiry}` : "soon";
  const href = absoluteHref(payload.retryHref ?? payload.href);
  const textBody = [
    `Hi ${name},`,
    "",
    mandateFailed
      ? `We could not collect the latest payment for your ${item}.`
      : `Your ${item} access is scheduled to end ${timing}.`,
    expiry ? `Current expiry: ${expiry}.` : "",
    mandateFailed
      ? "Update or retry your payment mandate to keep access active."
      : "Choose another term to keep studying without an interruption.",
    `Continue: ${href}`,
  ].filter(Boolean).join("\n");
  const rows: DetailRow[] = [
    { label: "Item", value: item },
    { label: "Amount", value: formatPaymentAmount(payload.amountMinor, currencyCode(payload)) },
    { label: "Order ID", value: text(payload.orderId) },
    { label: mandateFailed ? "Current expiry" : "Access ends", value: expiry },
    {
      label: "Status",
      value: mandateFailed ? "Action needed" : "Ending soon",
      pill: mandateFailed ? "danger" : "warning",
    },
  ];
  return {
    to: recipient(payload) ?? "",
    subject,
    text: textBody,
    html: renderEmail({
      preheader: mandateFailed
        ? `We could not collect the latest payment for your ${item}.`
        : `Your ${item} access is scheduled to end ${timing}.`,
      documentTitle: mandateFailed ? "Origin - Action Needed" : "Origin - Payment Reminder",
      mascot: mandateFailed ? "failed" : "curious",
      title: mandateFailed ? "Action" : "Payment",
      titleAccent: mandateFailed ? "Needed" : "Reminder",
      accent: mandateFailed ? "red" : "amber",
      intro: mandateFailed
        ? [`Hi ${name}, we could not collect the latest payment for your ${item}.`, "Update or retry your mandate to keep access active."]
        : [`Hi ${name}, your ${item} access is scheduled to end ${timing}.`, "Complete a new term to keep learning without an interruption."],
      blocks: [
        detailsCard(mandateFailed ? "Payment Details" : "Pending Payment Details", rows),
        infoStrip(
          mandateFailed ? "Update your payment method" : "Renew now to keep your streak alive",
          mandateFailed
            ? "Access stays active as soon as the payment goes through."
            : "Premium access, doubt solving and full analytics stay unlocked.",
          mandateFailed ? "danger" : "warning",
          mandateFailed ? "failed" : "curious",
        ),
      ],
      cta: { label: "Choose a term", href, accent: mandateFailed ? "red" : "amber" },
      footerNote: "If you have any questions, feel free to reach out to our support team.",
    }),
  };
}

function deliveryError(result: SendEmailResult): PaymentEmailError {
  const detail = result.success ? "" : result.error instanceof Error ? result.error.message : String(result.error);
  return new PaymentEmailError(`Payment email delivery failed${detail ? `: ${detail}` : "."}`);
}

async function deliver(
  rendered: RenderedPaymentEmail,
  sender: PaymentEmailSender,
): Promise<PaymentEmailDelivery> {
  if (!rendered.to.trim()) return { sent: false, skipped: true };
  const result = await sender(rendered);
  if (!result.success) throw deliveryError(result);
  return { sent: true, skipped: false, messageId: result.messageId };
}

export async function sendPaymentReceipt(
  payload: PaymentReceiptPayload,
  sender: PaymentEmailSender = defaultSendEmail,
): Promise<PaymentEmailDelivery> {
  return deliver(renderReceiptEmail(payload), sender);
}

export async function sendPaymentFailedEmail(
  payload: PaymentFailedPayload,
  sender: PaymentEmailSender = defaultSendEmail,
): Promise<PaymentEmailDelivery> {
  return deliver(renderPaymentFailedEmail(payload), sender);
}

export async function sendPaymentRefundEmail(
  payload: PaymentRefundPayload,
  sender: PaymentEmailSender = defaultSendEmail,
): Promise<PaymentEmailDelivery> {
  return deliver(renderRefundEmail(payload), sender);
}

export async function sendPaymentDunningEmail(
  payload: PaymentDunningPayload,
  sender: PaymentEmailSender = defaultSendEmail,
): Promise<PaymentEmailDelivery> {
  return deliver(renderDunningEmail(payload), sender);
}

/** Normalise an arbitrary outbox JSON object into a typed email payload. */
export function paymentEmailPayload(value: Record<string, unknown>): PaymentEmailPayload {
  return value as PaymentEmailPayload;
}
