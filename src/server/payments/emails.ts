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

const DEFAULT_SITE_URL = "https://www.o3origin.com";

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

function escapeHtml(value: unknown): string {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function siteUrl(): string {
  const configured = text(process.env.NEXT_PUBLIC_SITE_URL);
  return (configured || DEFAULT_SITE_URL).replace(/\/$/u, "");
}

function absoluteHref(value: string | null | undefined, fallback = "/premium"): string {
  const candidate = text(value, fallback);
  if (/^https?:\/\//iu.test(candidate)) return candidate;
  return `${siteUrl()}${candidate.startsWith("/") ? candidate : `/${candidate}`}`;
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

function shell(title: string, body: string, cta?: { label: string; href: string }): string {
  const action = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.href)}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;max-width:600px;margin:0 auto;padding:24px;color:#171717"><h2 style="color:#3730a3">${escapeHtml(title)}</h2>${body}${action}<p style="font-size:12px;color:#737373;margin-top:32px">Origin · www.o3origin.com</p></div>`;
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
  const htmlBody = [
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p>We received your payment of <strong>${escapeHtml(amount)}</strong> for <strong>${escapeHtml(item)}</strong> (${escapeHtml(termLabel(payload))}).</p>`,
    `<p>${expiry ? `Your access is active until <strong>${escapeHtml(expiry)}</strong>.` : "Your access is now active."}</p>`,
    payload.orderId ? `<p style="font-size:13px;color:#525252">Order: ${escapeHtml(payload.orderId)}${payload.paymentId ? ` · Payment: ${escapeHtml(payload.paymentId)}` : ""}</p>` : "",
  ].filter(Boolean).join("");
  return { to: recipient(payload) ?? "", subject, text: textBody, html: shell(subject, htmlBody, { label: "Open Premium", href }) };
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
  const htmlBody = `<p>Hi ${escapeHtml(name)},</p><p>We couldn't complete your payment for <strong>${escapeHtml(item)}</strong>.</p><p style="color:#991b1b">${escapeHtml(reason)}</p><p>No access was charged for this failed attempt.</p>`;
  return { to: recipient(payload) ?? "", subject, text: textBody, html: shell(subject, htmlBody, { label: "Try again", href }) };
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
  const htmlBody = `<p>Hi ${escapeHtml(name)},</p><p>A refund of <strong>${escapeHtml(refundAmount)}</strong> was processed for <strong>${escapeHtml(item)}</strong>.</p><p>${escapeHtml(accessLine)}</p>${payload.refundReason ? `<p>Reason: ${escapeHtml(payload.refundReason)}</p>` : ""}`;
  return { to: recipient(payload) ?? "", subject, text: textBody, html: shell(subject, htmlBody, { label: "Open Premium", href: absoluteHref(payload.href) }) };
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
  const htmlBody = mandateFailed
    ? `<p>Hi ${escapeHtml(name)},</p><p>We could not collect the latest payment for your <strong>${escapeHtml(item)}</strong>.</p><p>Update or retry your payment mandate to keep access active.</p>`
    : `<p>Hi ${escapeHtml(name)},</p><p>Your <strong>${escapeHtml(item)}</strong> access is scheduled to end ${escapeHtml(timing)}.</p><p>Choose another term to keep studying without an interruption.</p>`;
  return { to: recipient(payload) ?? "", subject, text: textBody, html: shell(subject, htmlBody, { label: "Choose a term", href }) };
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
