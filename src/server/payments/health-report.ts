/**
 * The single computation behind "is the payment system actually wired up?".
 *
 * Two very different callers need the same answer and must never disagree:
 * `/api/internal/payments/health` (cron/uptime probe, bearer-token auth) and
 * the admin financials dashboard (`/api/admin/payments/summary`, session auth).
 * Before this module the probe owned the logic and the dashboard had none, so a
 * second implementation was the obvious next mistake.
 *
 * Reports presence and provenance only — never a secret, never part of one.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md (D15, Phases 1 and 8).
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { isUserPostgresConfigured } from "@/server/user-postgres";

import { getPaymentsBacklog, type PaymentsBacklog } from "./payments-store";
import { getRazorpayConfigStatus, type RazorpayConfigStatus } from "./razorpay-client";

export type PaymentsHealth = {
  ok: boolean;
  featureEnabled: boolean;
  razorpay: RazorpayConfigStatus;
  qstashConfigured: boolean;
  redisConfigured: boolean;
  databaseConfigured: boolean;
  backlog: PaymentsBacklog | null;
  backlogError: string | null;
  /** Human-readable reasons `ok` is false. Empty when healthy. */
  problems: string[];
};

/**
 * Turns the raw inputs into the report. Pure, so the problem list is unit
 * testable without a database, Redis, or a Razorpay account.
 */
export function assessPaymentsHealth(input: {
  featureEnabled: boolean;
  razorpay: RazorpayConfigStatus;
  qstashConfigured: boolean;
  redisConfigured: boolean;
  databaseConfigured: boolean;
  backlog: PaymentsBacklog | null;
  backlogError: string | null;
}): PaymentsHealth {
  const problems: string[] = [];
  if (!input.razorpay.keyIdConfigured) problems.push("Razorpay key id is not configured.");
  if (!input.razorpay.keySecretConfigured) problems.push("Razorpay key secret is not configured.");
  if (!input.razorpay.webhookSecretConfigured) {
    problems.push("Razorpay webhook secret is not configured — no webhook can be verified.");
  }
  if (input.razorpay.modeMismatch) problems.push(input.razorpay.modeMismatch);
  if (!input.databaseConfigured) problems.push("USER_DATABASE_URL is not configured.");
  if (input.backlogError) problems.push(`Backlog query failed: ${input.backlogError}`);
  const backlog = input.backlog;
  if (backlog && backlog.failedEvents > 0) {
    problems.push(`${backlog.failedEvents} webhook event(s) parked as failed.`);
  }
  if (backlog && backlog.failedOutbox > 0) {
    problems.push(`${backlog.failedOutbox} outbox row(s) parked as failed.`);
  }
  if (backlog && backlog.stuckOrders > 0) {
    problems.push(
      `${backlog.stuckOrders} order(s) stuck unpaid for >15m — webhooks may not be arriving.`,
    );
  }

  return {
    ok: problems.length === 0,
    featureEnabled: input.featureEnabled,
    razorpay: input.razorpay,
    qstashConfigured: input.qstashConfigured,
    redisConfigured: input.redisConfigured,
    databaseConfigured: input.databaseConfigured,
    backlog,
    backlogError: input.backlogError,
    problems,
  };
}

/** Reads the live environment + backlog and assesses them. */
export async function buildPaymentsHealth(): Promise<PaymentsHealth> {
  const databaseConfigured = isUserPostgresConfigured();
  let backlog: PaymentsBacklog | null = null;
  let backlogError: string | null = null;
  if (databaseConfigured) {
    try {
      backlog = await getPaymentsBacklog();
    } catch (error) {
      backlogError = error instanceof Error ? error.message : String(error);
    }
  }

  return assessPaymentsHealth({
    featureEnabled: isFeatureEnabled("payments"),
    razorpay: getRazorpayConfigStatus(),
    qstashConfigured: Boolean(
      process.env.QSTASH_TOKEN?.trim() && process.env.QSTASH_CURRENT_SIGNING_KEY?.trim(),
    ),
    redisConfigured: Boolean(
      process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
    ),
    databaseConfigured,
    backlog,
    backlogError,
  });
}
