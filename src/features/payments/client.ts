/**
 * Browser client for the Phase 3 one-time Razorpay Orders rail.
 *
 * The server is the authority for every amount.  This module only sends the
 * checkout intent, opens the hosted Razorpay widget, and forwards the widget's
 * signed response to the fast-path verify endpoint.  The webhook remains the
 * source of truth for entitlement.
 */

import { mutateJson } from "@/lib/csrf";
import type { Subject } from "@/lib/entitlements";

export type PaymentOrderKind = "subject_term" | "bundle_term" | "institute_offering";

export type CheckoutInput = {
  kind: PaymentOrderKind;
  subject?: Subject | string;
  bundleId?: string;
  /** institute_offering only (plan G16); the server prices the offering. */
  workspaceId?: string;
  offeringId?: string;
  termMonths: number;
  couponCode?: string;
};

export type CheckoutResponse = {
  orderId: string;
  razorpayOrderId: string | null;
  amountMinor: number;
  currency: string;
  keyId: string | null;
  /** Present for a coupon-funded (zero-amount) order. */
  status?: "created" | "paid" | "attempted" | "failed";
  order?: PaymentOrder;
};

export type VerifyInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type VerifyResponse = {
  ok?: boolean;
  alreadyApplied?: boolean;
  order?: PaymentOrder;
  payment?: Record<string, unknown>;
  grants?: Array<Record<string, unknown>>;
  detail?: string;
};

export type PaymentOrder = {
  id: string;
  userId?: string;
  kind: PaymentOrderKind | string;
  subject?: string | null;
  bundleId?: string | null;
  termMonths: number;
  baseAmountMinor: number;
  discountMinor: number;
  amountMinor: number;
  currency: string;
  couponCode?: string | null;
  razorpayOrderId?: string | null;
  status: string;
  createdAt?: string;
  paidAt?: string | null;
  failureReason?: string | null;
};

export type CouponValidationInput = Omit<CheckoutInput, "termMonths"> & {
  termMonths?: number;
};

export type CouponValidationResponse = {
  valid: boolean;
  code?: string;
  reason?: string;
  baseMinor?: number;
  discountMinor?: number;
  amountMinor?: number;
  finalMinor?: number;
  currency?: string;
};

export type PublicPricingResponse = {
  subjects: Array<{
    subject: string;
    amountMinor: number;
    listAmountMinor?: number | null;
  }>;
  bundle?: {
    id?: string;
    name: string;
    subjects: string[];
    amountMinor: number;
    listAmountMinor?: number | null;
  } | null;
  terms?: Array<{
    termMonths: number;
    label: string;
    discountPercent: number;
  }>;
  currency?: string;
};

export const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpayCheckoutResponse = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  handler?: (response: RazorpayCheckoutResponse) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
  on?: (event: string, handler: (response: unknown) => void) => void;
};

export type RazorpayCheckout = {
  open: () => void;
  close?: () => void;
  on?: (event: string, handler: (response: unknown) => void) => void;
};

export type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayCheckout;

type RazorpayWindow = Window & { Razorpay?: RazorpayConstructor };

export class PaymentClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PaymentClientError";
    this.status = status;
  }
}

function razorpayConstructor(): RazorpayConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as RazorpayWindow).Razorpay;
}

/**
 * Script loading is shared across checkout instances.  A failed script is
 * removed and the promise is cleared, so a user can retry after a transient
 * network or content-blocker failure instead of being stuck on a rejected
 * singleton promise.
 */
let scriptPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }
  if (razorpayConstructor()) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    let settled = false;
    const timeout = setTimeout(() => finish(false), 15_000);

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (!ok && script.parentNode) script.parentNode.removeChild(script);
      if (!ok) scriptPromise = null;
      resolve(ok);
    };
    const onLoad = () => finish(Boolean(razorpayConstructor()));
    const onError = () => finish(false);

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      script.dataset.originRazorpay = "true";
      document.head.appendChild(script);
    } else if (razorpayConstructor()) {
      finish(true);
    }
  }).catch(() => {
    scriptPromise = null;
    return false;
  });

  return scriptPromise;
}

/** Test/support hook: permit a fresh script attempt after a test changes DOM. */
export function resetRazorpayScriptLoader(): void {
  scriptPromise = null;
}

export function createPaymentIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

async function parseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as
    | { detail?: unknown; message?: unknown; error?: unknown }
    | null;
  const detail = data?.detail ?? data?.message ?? data?.error;
  return detail ? String(detail) : `Request failed with status ${response.status}`;
}

function checkoutBody(input: CheckoutInput): Record<string, unknown> {
  return {
    kind: input.kind,
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.bundleId ? { bundleId: input.bundleId } : {}),
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    ...(input.offeringId ? { offeringId: input.offeringId } : {}),
    termMonths: input.termMonths,
    ...(input.couponCode?.trim() ? { couponCode: input.couponCode.trim() } : {}),
  };
}

/** Create one server-priced Razorpay order. Never send a client amount. */
export async function createCheckoutOrder(
  input: CheckoutInput,
  options: { idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<CheckoutResponse> {
  const key = options.idempotencyKey?.trim() || createPaymentIdempotencyKey();
  const response = await mutateJson("/api/payments/checkout", {
    method: "POST",
    signal: options.signal,
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(checkoutBody(input)),
  });
  if (!response.ok) throw new PaymentClientError(await parseError(response), response.status);
  return (await response.json()) as CheckoutResponse;
}

/** Browser fast-path signature verification; webhook remains authoritative. */
export async function verifyPayment(input: VerifyInput): Promise<VerifyResponse> {
  const response = await mutateJson("/api/payments/verify", {
    method: "POST",
    body: JSON.stringify({
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
    }),
  });
  if (!response.ok) throw new PaymentClientError(await parseError(response), response.status);
  const result = (await response.json()) as VerifyResponse;
  if (result.ok === false) {
    throw new PaymentClientError(result.detail || "Payment verification failed.", 400);
  }
  return result;
}

/** Return the caller's order/receipt history. */
export async function listPaymentOrders(): Promise<PaymentOrder[]> {
  const response = await fetch("/api/payments/orders", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new PaymentClientError(await parseError(response), response.status);
  const data = (await response.json()) as { orders?: PaymentOrder[] } | PaymentOrder[];
  return Array.isArray(data) ? data : data.orders ?? [];
}

/** Preview a coupon. This endpoint never reserves or commits a redemption. */
export async function validatePaymentCoupon(
  input: CouponValidationInput,
): Promise<CouponValidationResponse> {
  const response = await mutateJson("/api/payments/coupon/validate", {
    method: "POST",
    body: JSON.stringify({
      ...checkoutBody({ ...input, termMonths: input.termMonths ?? 1 }),
    }),
  });
  if (!response.ok) throw new PaymentClientError(await parseError(response), response.status);
  return (await response.json()) as CouponValidationResponse;
}

/** Public display snapshot. Amounts returned here are never trusted for charge. */
export async function getPublicPaymentPricing(): Promise<PublicPricingResponse> {
  const response = await fetch("/api/pricing", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new PaymentClientError(await parseError(response), response.status);
  return (await response.json()) as PublicPricingResponse;
}

export function getRazorpay(): RazorpayConstructor | undefined {
  return razorpayConstructor();
}
