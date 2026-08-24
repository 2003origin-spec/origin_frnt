/**
 * Data store for commerce.enrollment_subscriptions (Phase 14, Flow 2) — recurring
 * batch tuition backed by a Razorpay Subscription — plus the batch webhook's
 * idempotency ledger (commerce.subscription_webhook_events) and the offering
 * razorpay_plan_id setter.
 */

import type { Pool, PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createEnrollmentSubscriptionId } from "@/server/workspaces/ids";
import type {
  EnrollmentSubscription,
  EnrollmentSubscriptionStatus,
} from "@/server/workspaces/types";

import { ensureEnrollmentSubscriptionsSchema } from "./enrollment-subscriptions-schema";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToSubscription(row: Record<string, unknown>): EnrollmentSubscription {
  return {
    id: row.id as string,
    offeringId: row.offering_id as string,
    workspaceId: row.workspace_id as string,
    studentId: row.student_id as string,
    targetBatchId: (row.target_batch_id as string | null) ?? null,
    razorpayPlanId: (row.razorpay_plan_id as string | null) ?? null,
    razorpaySubscriptionId: (row.razorpay_subscription_id as string | null) ?? null,
    status: row.status as EnrollmentSubscriptionStatus,
    amountMinor: Number(row.amount_minor) || 0,
    currentPeriodEnd: row.current_period_end
      ? new Date(row.current_period_end as string).toISOString()
      : null,
    shortUrl: (row.short_url as string | null) ?? null,
    enrollmentId: (row.enrollment_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

/** Persists the Razorpay plan id created (at publish time) for a recurring offering. */
export async function setOfferingPlanId(
  workspaceId: string,
  offeringId: string,
  planId: string,
): Promise<void> {
  await ensureEnrollmentSubscriptionsSchema();
  await pool().query(
    `UPDATE commerce.workspace_offerings
        SET razorpay_plan_id = $3
      WHERE id = $1 AND workspace_id = $2`,
    [offeringId, workspaceId, planId],
  );
}

export type CreateEnrollmentSubscriptionInput = {
  offeringId: string;
  workspaceId: string;
  studentId: string;
  targetBatchId: string | null;
  razorpayPlanId: string;
  razorpaySubscriptionId: string;
  amountMinor: number;
  shortUrl: string | null;
};

export async function createEnrollmentSubscription(
  input: CreateEnrollmentSubscriptionInput,
): Promise<EnrollmentSubscription> {
  await ensureEnrollmentSubscriptionsSchema();
  const id = createEnrollmentSubscriptionId();
  const res = await pool().query(
    `INSERT INTO commerce.enrollment_subscriptions
       (id, offering_id, workspace_id, student_id, target_batch_id,
        razorpay_plan_id, razorpay_subscription_id, status, amount_minor, short_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'created',$8,$9)
     RETURNING *`,
    [
      id,
      input.offeringId,
      input.workspaceId,
      input.studentId,
      input.targetBatchId,
      input.razorpayPlanId,
      input.razorpaySubscriptionId,
      input.amountMinor,
      input.shortUrl,
    ],
  );
  return rowToSubscription(res.rows[0]);
}

export async function getEnrollmentSubscriptionByRazorpayId(
  razorpaySubscriptionId: string,
): Promise<EnrollmentSubscription | null> {
  await ensureEnrollmentSubscriptionsSchema();
  const res = await pool().query(
    `SELECT * FROM commerce.enrollment_subscriptions WHERE razorpay_subscription_id = $1`,
    [razorpaySubscriptionId],
  );
  return res.rows[0] ? rowToSubscription(res.rows[0]) : null;
}

export async function listStudentEnrollmentSubscriptions(
  studentId: string,
): Promise<EnrollmentSubscription[]> {
  await ensureEnrollmentSubscriptionsSchema();
  const res = await pool().query(
    `SELECT * FROM commerce.enrollment_subscriptions WHERE student_id = $1 ORDER BY created_at DESC`,
    [studentId],
  );
  return res.rows.map(rowToSubscription);
}

/** Connect rows eligible for the Phase 7 T+0/T+3 mandate-failure notices. */
export async function listFailedMandateEnrollmentSubscriptions(): Promise<EnrollmentSubscription[]> {
  await ensureEnrollmentSubscriptionsSchema();
  const res = await pool().query(
    `SELECT * FROM commerce.enrollment_subscriptions
      WHERE status IN ('pending', 'halted')
      ORDER BY updated_at ASC, id ASC`,
  );
  return res.rows.map(rowToSubscription);
}

/**
 * Applies a status transition keyed on the Razorpay subscription id. Only forward
 * `active` transitions move the billing period (pass null otherwise to keep the
 * existing current_period_end so access persists until it lapses).
 */
export type EnrollmentTransitionResult =
  /** No row carries this Razorpay subscription id. */
  | { outcome: "unknown"; subscription: null }
  /** A newer event has already been applied; the row is returned untouched. */
  | { outcome: "stale"; subscription: EnrollmentSubscription }
  | { outcome: "applied"; subscription: EnrollmentSubscription };

/**
 * Apply a status transition keyed on the Razorpay subscription id.
 *
 * Order-independent (plan E27) — the same fence as the platform rail in
 * subscriptions-store.ts: the row remembers the Razorpay event time it last
 * applied and refuses anything older, and `current_period_end` only moves
 * forward. Without it a redelivered `subscription.charged` could re-enrol a
 * student the institute has already lapsed. `eventAt` omitted keeps the
 * pre-Phase-6 last-writer-wins behaviour.
 */
export async function applyEnrollmentSubscriptionTransition(input: {
  razorpaySubscriptionId: string;
  status: EnrollmentSubscriptionStatus;
  currentPeriodEnd: Date | null;
  eventAt?: Date | null;
}): Promise<EnrollmentTransitionResult> {
  await ensureEnrollmentSubscriptionsSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT * FROM commerce.enrollment_subscriptions
        WHERE razorpay_subscription_id = $1
        FOR UPDATE`,
      [input.razorpaySubscriptionId],
    );
    const current = locked.rows[0];
    if (!current) {
      await client.query("COMMIT");
      return { outcome: "unknown", subscription: null };
    }

    const lastEventAt = current.last_event_at ? new Date(current.last_event_at as string) : null;
    if (input.eventAt && lastEventAt && input.eventAt.getTime() < lastEventAt.getTime()) {
      await client.query("COMMIT");
      return { outcome: "stale", subscription: rowToSubscription(current) };
    }

    const res = await client.query(
      `UPDATE commerce.enrollment_subscriptions
          SET status = $2,
              current_period_end = GREATEST($3::timestamptz, current_period_end),
              last_event_at      = GREATEST($4::timestamptz, last_event_at),
              updated_at = NOW()
        WHERE razorpay_subscription_id = $1
        RETURNING *`,
      [input.razorpaySubscriptionId, input.status, input.currentPeriodEnd, input.eventAt ?? null],
    );
    await client.query("COMMIT");
    return { outcome: "applied", subscription: rowToSubscription(res.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function linkEnrollmentSubscriptionEnrollment(
  subscriptionId: string,
  enrollmentId: string,
): Promise<void> {
  await ensureEnrollmentSubscriptionsSchema();
  await pool().query(
    `UPDATE commerce.enrollment_subscriptions SET enrollment_id = $2, updated_at = NOW() WHERE id = $1`,
    [subscriptionId, enrollmentId],
  );
}

/**
 * Lapsed recurring batch subscriptions whose grace period has ended: status is a
 * lapse state and current_period_end is in the past. Used by the reconciliation
 * cron to tear down batch access.
 */
export async function listLapsedEnrollmentSubscriptions(): Promise<EnrollmentSubscription[]> {
  await ensureEnrollmentSubscriptionsSchema();
  const res = await pool().query(
    `SELECT * FROM commerce.enrollment_subscriptions
      WHERE status IN ('active', 'pending', 'halted', 'cancelled', 'completed')
        AND current_period_end IS NOT NULL
        AND current_period_end < NOW()`,
  );
  return res.rows.map(rowToSubscription);
}

/** Mark one fully torn-down enrollment subscription explicitly expired. */
export async function markEnrollmentSubscriptionExpired(id: string): Promise<void> {
  await ensureEnrollmentSubscriptionsSchema();
  await pool().query(
    `UPDATE commerce.enrollment_subscriptions
        SET status = 'expired', updated_at = NOW()
      WHERE id = $1 AND status <> 'expired'`,
    [id],
  );
}

// ─── webhook idempotency ledger ────────────────────────────────────────────────

export async function recordConnectWebhookEvent(
  eventId: string,
  eventType: string | null,
  client?: PoolClient,
): Promise<boolean> {
  await ensureEnrollmentSubscriptionsSchema();
  const runner = client ?? pool();
  const res = await runner.query(
    `INSERT INTO commerce.subscription_webhook_events (event_id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, eventType],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function deleteConnectWebhookEvent(eventId: string): Promise<void> {
  await ensureEnrollmentSubscriptionsSchema();
  await pool().query(`DELETE FROM commerce.subscription_webhook_events WHERE event_id = $1`, [
    eventId,
  ]);
}
