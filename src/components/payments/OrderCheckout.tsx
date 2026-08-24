"use client";

/**
 * Native-gated one-time Orders checkout (Phase 3 / Rail A).
 *
 * The component deliberately keeps the amount displayed in the card separate
 * from the amount sent to Razorpay: checkout creation returns the authoritative
 * server-computed amount, which is what gets passed to the widget.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { NativePurchaseNotice, useIsNativeApp } from "@/components/native/NativePurchaseNotice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createPaymentIdempotencyKey,
  createCheckoutOrder,
  getRazorpay,
  loadRazorpayScript,
  PaymentClientError,
  verifyPayment,
  validatePaymentCoupon,
  type CheckoutInput,
  type PaymentOrderKind,
  type RazorpayCheckout,
} from "@/features/payments/client";

export type OrderCheckoutProps = {
  kind?: PaymentOrderKind;
  subject?: string;
  bundleId?: string;
  /** institute_offering only (plan G16). */
  workspaceId?: string;
  offeringId?: string;
  termMonths?: number;
  couponCode?: string;
  label: string;
  /** Display-only fallback; the checkout response always wins. */
  amountMinor?: number;
  /** Parent can pass the server feature flag; false keeps this purchase rail dark. */
  enabled?: boolean;
  disabled?: boolean;
  className?: string;
  onChanged?: () => void | Promise<void>;
};

type CheckoutState = "idle" | "loading" | "opening" | "success" | "error";

function formatRupees(minor: number): string {
  return Math.round(minor / 100).toLocaleString("en-IN");
}

function isAbort(error: unknown): boolean {
  return typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError";
}

export function OrderCheckout({
  kind = "subject_term",
  subject,
  bundleId,
  workspaceId,
  offeringId,
  termMonths = 1,
  couponCode,
  label,
  amountMinor,
  enabled = false,
  disabled = false,
  className,
  onChanged,
}: OrderCheckoutProps) {
  const native = useIsNativeApp();
  const [state, setState] = useState<CheckoutState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chargedMinor, setChargedMinor] = useState<number | null>(null);
  const [couponPreviewMinor, setCouponPreviewMinor] = useState<number | null>(null);
  const [couponPreviewError, setCouponPreviewError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const checkoutRef = useRef<RazorpayCheckout | null>(null);
  const outcomeRef = useRef<"success" | "failed" | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const intentFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = couponCode?.trim();
    if (!code || !enabled || native || kind === "institute_offering") {
      setCouponPreviewMinor(null);
      setCouponPreviewError(null);
      return () => { cancelled = true; };
    }
    setCouponPreviewMinor(null);
    setCouponPreviewError(null);
    validatePaymentCoupon({ kind, subject, bundleId, termMonths, couponCode: code })
      .then((preview) => {
        if (cancelled) return;
        if (preview.valid) {
          setCouponPreviewMinor(preview.finalMinor ?? preview.amountMinor ?? null);
        } else {
          setCouponPreviewError(preview.reason ?? "Coupon is not valid for this checkout.");
        }
      })
      .catch(() => {
        if (!cancelled) setCouponPreviewError("Coupon preview unavailable; the server will re-check at checkout.");
      });
    return () => { cancelled = true; };
  }, [bundleId, couponCode, enabled, kind, native, subject, termMonths]);

  const input = useCallback((): CheckoutInput => ({
    kind,
    ...(subject ? { subject } : {}),
    ...(bundleId ? { bundleId } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(offeringId ? { offeringId } : {}),
    termMonths,
    // An institute offering is a one-time fee; platform coupons do not apply.
    ...(kind !== "institute_offering" && couponCode?.trim() ? { couponCode: couponCode.trim() } : {}),
  }), [bundleId, couponCode, kind, offeringId, subject, termMonths, workspaceId]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    checkoutRef.current?.close?.();
    checkoutRef.current = null;
    outcomeRef.current = null;
    setState("idle");
    setError(null);
  }, []);

  const startCheckout = useCallback(async () => {
    if (state === "loading" || state === "opening") return;
    setState("loading");
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const intent = input();
      const fingerprint = JSON.stringify(intent);
      if (!idempotencyKeyRef.current || intentFingerprintRef.current !== fingerprint) {
        idempotencyKeyRef.current = createPaymentIdempotencyKey();
        intentFingerprintRef.current = fingerprint;
      }
      const result = await createCheckoutOrder(intent, {
        idempotencyKey: idempotencyKeyRef.current,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setChargedMinor(result.amountMinor);

      // A zero-amount order is already paid server-side (for example, a fully
      // discounted coupon). There is no Razorpay widget to open in that case.
      if (result.amountMinor <= 0) {
        idempotencyKeyRef.current = null;
        intentFingerprintRef.current = null;
        setState("success");
        outcomeRef.current = "success";
        toast.success(`${label} unlocked.`);
        await onChanged?.();
        return;
      }

      // A positive order must always have both gateway identifiers. Treat a
      // partial response as a failed checkout rather than accidentally showing
      // a paid state or opening a widget with an undefined order id.
      if (!result.razorpayOrderId || !result.keyId) {
        throw new Error("The payment order could not be prepared. Please try again.");
      }

      const scriptReady = await loadRazorpayScript();
      if (controller.signal.aborted) return;
      if (!scriptReady || !getRazorpay()) {
        // Keep the idempotency key. Retrying replays this exact order rather
        // than producing a second charge intent after a transient script/CSP
        // failure.
        throw new Error("Could not load the secure checkout. Check your connection and try again.");
      }

      const Razorpay = getRazorpay();
      if (!Razorpay) throw new Error("Secure checkout is unavailable. Please try again.");
      setState("opening");

      const checkout = new Razorpay({
        key: result.keyId,
        amount: result.amountMinor,
        currency: result.currency || "INR",
        order_id: result.razorpayOrderId,
        name: "Origin",
        description:
          kind === "institute_offering"
            ? `${label} — one-time enrolment`
            : `${label} — ${termMonths} month${termMonths === 1 ? "" : "s"}`,
        theme: { color: "#4f46e5" },
        handler: async (response) => {
          if (controller.signal.aborted) return;
          const hasSignature = Boolean(
            response.razorpay_order_id && response.razorpay_payment_id && response.razorpay_signature,
          );
          try {
            if (!hasSignature) {
              throw new Error("Razorpay returned an incomplete payment response.");
            }
            await verifyPayment({
              razorpayOrderId: response.razorpay_order_id as string,
              razorpayPaymentId: response.razorpay_payment_id as string,
              razorpaySignature: response.razorpay_signature as string,
            });
            idempotencyKeyRef.current = null;
            intentFingerprintRef.current = null;
            outcomeRef.current = "success";
            setState("success");
            toast.success("Payment received — your access is unlocking.");
            await onChanged?.();
          } catch (verifyError) {
            if (!hasSignature) {
              const message = verifyError instanceof Error ? verifyError.message : "Payment verification failed.";
              outcomeRef.current = "failed";
              setState("error");
              setError(message);
              toast.error(message);
              return;
            }
            const rejected =
              verifyError instanceof PaymentClientError &&
              verifyError.status >= 400 &&
              verifyError.status < 500 &&
              verifyError.status !== 409 &&
              verifyError.status !== 429;
            if (rejected) {
              const message = verifyError.message;
              outcomeRef.current = "failed";
              setState("error");
              setError(message);
              toast.error(message);
              return;
            }
            // The webhook is authoritative and may still unlock the account even
            // when this best-effort fast path fails. Razorpay has already called
            // the success handler, so never invite a second charge here.
            idempotencyKeyRef.current = null;
            intentFingerprintRef.current = null;
            outcomeRef.current = "success";
            setState("success");
            setError("Payment received. We are confirming it in the background.");
            toast.info("Payment received — confirmation is still processing.");
            await onChanged?.();
            void verifyError;
          } finally {
            checkoutRef.current = null;
            abortRef.current = null;
          }
        },
        modal: {
          ondismiss: () => {
            checkoutRef.current = null;
            abortRef.current = null;
            if (!outcomeRef.current) setState("idle");
          },
        },
      });
      checkoutRef.current = checkout;
      checkout.on?.("payment.failed", (raw) => {
        const response = raw as { error?: { description?: string } } | null;
        const message = response?.error?.description || "Payment failed. You can try again.";
        checkoutRef.current = null;
        abortRef.current = null;
        idempotencyKeyRef.current = null;
        intentFingerprintRef.current = null;
        outcomeRef.current = "failed";
        setError(message);
        setState("error");
        toast.error(message);
      });
      checkout.open();
    } catch (checkoutError) {
      if (isAbort(checkoutError) || controller.signal.aborted) return;
      const message = checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.";
      setError(message);
      setState("error");
      toast.error(message);
    } finally {
      // Keep the controller while the hosted widget is open so the cancel
      // affordance can close/abort this attempt. React state is asynchronous;
      // checking the ref is both more accurate and avoids a stale `state`
      // closure here.
      if (abortRef.current === controller && !checkoutRef.current) abortRef.current = null;
    }
  }, [input, kind, label, onChanged, state, termMonths]);

  if (!enabled) return null;
  if (native) return <NativePurchaseNotice title={label} />;

  const displayMinor = chargedMinor ?? couponPreviewMinor ?? amountMinor ?? 0;
  const isBusy = state === "loading" || state === "opening";

  if (state === "success") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          Payment received
        </div>
        <p className="text-xs text-muted-foreground">
          {error ?? "Your access will appear as soon as Razorpay confirms the payment."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            reset();
            void onChanged?.();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Start another checkout
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {couponPreviewError ? <p className="text-xs text-amber-600 dark:text-amber-400">{couponPreviewError}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="rounded-full bg-primary text-primary-foreground hover:opacity-90"
          onClick={() => void startCheckout()}
          disabled={disabled || isBusy}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {state === "error" ? "Try again" : `Pay${displayMinor > 0 ? ` · ₹${formatRupees(displayMinor)}` : ""}`}
        </Button>
        {isBusy ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={reset} aria-label="Cancel checkout">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {isBusy ? <p className="text-xs text-muted-foreground">Opening secure Razorpay checkout…</p> : null}
    </div>
  );
}

export default OrderCheckout;
