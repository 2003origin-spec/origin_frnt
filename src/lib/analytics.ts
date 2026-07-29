"use client";

import { sendGAEvent } from "@next/third-parties/google";

/**
 * Fire a GA4 event. Safe to call anywhere on the client — if GA isn't loaded
 * (dev/preview, or the ID unset) it's a no-op. Use snake_case event names and
 * keep params flat (strings/numbers).
 *
 * Funnel events we care about: sign_up, login, otp_sent, test_start,
 * test_submit, dpp_solve, doubt_asked, subscribe_checkout, share_card.
 */
export function track(event: string, params: Record<string, string | number | boolean> = {}): void {
  try {
    if (typeof window === "undefined") return;
    sendGAEvent("event", event, params);
  } catch {
    // never let analytics break a user flow
  }
}
