"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { NativePurchaseNotice, useIsNativeApp } from "@/components/native/NativePurchaseNotice";
import { OrderCheckout } from "@/components/payments/OrderCheckout";

type Props = {
  workspaceId: string;
  offeringId: string;
  /** Server-resolved Rail A flag. On = real Razorpay checkout (plan G16). */
  paymentsEnabled?: boolean;
  /** Offering title, used as the Razorpay widget description. */
  title?: string;
  /** Display-only; the checkout response carries the authoritative amount. */
  amountMinor?: number;
};

export function CheckoutForm({
  workspaceId,
  offeringId,
  paymentsEnabled = false,
  title,
  amountMinor,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const native = useIsNativeApp();

  async function submit() {
    setError(null);
    const res = await fetch("/api/enrollments/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, offeringId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? `Checkout failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as {
      order: { id: string; status: string };
    };
    setOrderId(data.order.id);

    // In production: redirect to the payment provider's hosted page or
    // initialise a JS SDK with a return URL. For now we land on the
    // orders list so the student can see the created order.
    router.push("/marketplace/orders");
  }

  // Android app: order creation is a paid-offering purchase intent —
  // consumption-only notice instead (ANDROID_HYBRID_APP_PLAN.md §5.4).
  if (native) {
    return <NativePurchaseNotice />;
  }

  // Rail A on: the order is created AND paid through Razorpay in one flow
  // (plan G16). Before this, "Place order" only wrote a commerce row and an
  // external caller holding PAYMENT_WEBHOOK_TOKEN had to mark it paid — there
  // was no gateway behind the button at all.
  if (paymentsEnabled) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          By continuing you agree to the institute&apos;s enrollment terms.
          After successful payment you&apos;ll be auto-enrolled and
          assigned to the offering&apos;s target batch.
        </p>
        <OrderCheckout
          kind="institute_offering"
          workspaceId={workspaceId}
          offeringId={offeringId}
          termMonths={1}
          label={title ?? "Enrolment"}
          amountMinor={amountMinor}
          enabled
          onChanged={() => router.push("/marketplace/orders")}
        />
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">Order created.</p>
        <p className="font-mono text-xs text-muted-foreground">
          Order ID: {orderId}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        By continuing you agree to the institute&apos;s enrollment terms.
        After successful payment you&apos;ll be auto-enrolled and
        assigned to the offering&apos;s target batch.
      </p>
      <Button
        size="lg"
        disabled={isPending}
        onClick={() => startTransition(submit)}
      >
        {isPending ? "Creating order…" : "Place order"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
