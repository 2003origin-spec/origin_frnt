/**
 * Shared client-side contract for the CBT participation quota.
 *
 * Lives in its own module (not in a `"use client"` component) so both server
 * components and client components can import the type without dragging a
 * client boundary along.
 */

import type { CbtQuotaState } from "@/lib/cbt/quota-model";

export type CbtQuotaClientState = CbtQuotaState & {
  /** False when the platform kill switch is off — the UI then renders nothing. */
  enforced: boolean;
  pendingRequest: {
    id: string;
    requestedAdditional: number;
    note: string | null;
    createdAt: string;
  } | null;
  supportPhone: string | null;
};

/**
 * Dispatched on `window` after any action that could move the meter (a room
 * created, a request sent/withdrawn, a refused code reveal). The navbar meter
 * listens and re-fetches, so the number never lags behind what just happened.
 */
export const CBT_QUOTA_CHANGED_EVENT = "cbt:quota-changed";

export function notifyCbtQuotaChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CBT_QUOTA_CHANGED_EVENT));
}
