/**
 * Data store for per-subject premium subscriptions (Phase 1.2).
 * Aligned to src/db/migrations/20260601_phase13_subscriptions.sql:
 *   subscriptions.user_subscriptions + subscriptions.webhook_events.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";
import type { Subject } from "@/lib/entitlements";

import { ensureSubscriptionsSchema } from "./subscriptions-schema";

export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired";

export type SubjectSubscription = {
  id: string;
  userId: string;
  subject: Subject;
  razorpayPlanId: string | null;
  razorpaySubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  amountMinor: number;
  shortUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToSubscription(row: Record<string, unknown>): SubjectSubscription {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subject: row.subject as Subject,
    razorpayPlanId: (row.razorpay_plan_id as string | null) ?? null,
    razorpaySubscriptionId: (row.razorpay_subscription_id as string | null) ?? null,
    status: row.status as SubscriptionStatus,
    currentPeriodEnd: row.current_period_end
      ? new Date(row.current_period_end as string).toISOString()
      : null,
    amountMinor: Number(row.amount_minor) || 0,
    shortUrl: (row.short_url as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export type UpsertCreatedSubscriptionInput = {
  userId: string;
  subject: Subject;
  razorpayPlanId: string;
  razorpaySubscriptionId: string;
  shortUrl: string | null;
  amountMinor: number;
};

/**
 * Upsert the `(user_id, subject)` row when a Razorpay subscription is created.
 * A prior cancelled/expired row for the same subject is overwritten with the
 * fresh Razorpay subscription id and reset to `created`. Entitlement is granted
 * only later, by the webhook.
 */
export async function upsertCreatedSubscription(
  input: UpsertCreatedSubscriptionInput,
): Promise<SubjectSubscription> {
  await ensureSubscriptionsSchema();
  const id = createPrefixedId("sub");
  const result = await pool().query(
    `INSERT INTO subscriptions.user_subscriptions
       (id, user_id, subject, razorpay_plan_id, razorpay_subscription_id,
        status, amount_minor, short_url, updated_at)
     VALUES ($1,$2,$3,$4,$5,'created',$6,$7,NOW())
     ON CONFLICT (user_id, subject) DO UPDATE SET
       razorpay_plan_id         = EXCLUDED.razorpay_plan_id,
       razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
       status                   = 'created',
       amount_minor             = EXCLUDED.amount_minor,
       short_url                = EXCLUDED.short_url,
       -- A NEW mandate is a new event stream, so the E27 ordering fence must
       -- start clean. Carrying the old subscription's last_event_at forward
       -- would let it reject the new mandate's first webhooks.
       last_event_at            = CASE
         WHEN subscriptions.user_subscriptions.razorpay_subscription_id
              IS DISTINCT FROM EXCLUDED.razorpay_subscription_id THEN NULL
         ELSE subscriptions.user_subscriptions.last_event_at
       END,
       updated_at               = NOW()
     RETURNING *`,
    [
      id,
      input.userId,
      input.subject,
      input.razorpayPlanId,
      input.razorpaySubscriptionId,
      input.amountMinor,
      input.shortUrl,
    ],
  );
  return rowToSubscription(result.rows[0]);
}

export async function getSubscriptionBySubject(
  userId: string,
  subject: Subject,
): Promise<SubjectSubscription | null> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `SELECT * FROM subscriptions.user_subscriptions WHERE user_id = $1 AND subject = $2`,
    [userId, subject],
  );
  return result.rows[0] ? rowToSubscription(result.rows[0]) : null;
}

export async function getSubscriptionByRazorpayId(
  razorpaySubscriptionId: string,
): Promise<SubjectSubscription | null> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `SELECT * FROM subscriptions.user_subscriptions WHERE razorpay_subscription_id = $1`,
    [razorpaySubscriptionId],
  );
  return result.rows[0] ? rowToSubscription(result.rows[0]) : null;
}

export async function listUserSubscriptions(userId: string): Promise<SubjectSubscription[]> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `SELECT * FROM subscriptions.user_subscriptions WHERE user_id = $1 ORDER BY subject ASC`,
    [userId],
  );
  return result.rows.map(rowToSubscription);
}

/** Flip subscriptions whose paid period has ended to the explicit expired state. */
export async function expireLapsedSubscriptions(now = new Date()): Promise<{
  userIds: string[];
  subscriptions: SubjectSubscription[];
}> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `UPDATE subscriptions.user_subscriptions
        SET status = 'expired', updated_at = NOW()
      WHERE status IN ('active', 'pending', 'halted', 'cancelled', 'completed')
        AND current_period_end IS NOT NULL
        AND current_period_end <= $1
      RETURNING *`,
    [now],
  );
  const subscriptions = result.rows.map(rowToSubscription);
  return {
    userIds: Array.from(new Set(subscriptions.map((subscription) => subscription.userId))),
    subscriptions,
  };
}

/** Rows eligible for deterministic failed-mandate dunning. */
export async function listFailedMandateSubscriptions(): Promise<Array<{
  id: string;
  userId: string;
  subject: Subject;
  status: SubscriptionStatus;
  updatedAt: string;
  currentPeriodEnd: string | null;
}>> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `SELECT id, user_id, subject, status, updated_at, current_period_end
       FROM subscriptions.user_subscriptions
      WHERE status IN ('pending', 'halted')
      ORDER BY updated_at ASC, id ASC`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    subject: row.subject as Subject,
    status: row.status as SubscriptionStatus,
    updatedAt: new Date(row.updated_at as string).toISOString(),
    currentPeriodEnd: row.current_period_end
      ? new Date(row.current_period_end as string).toISOString()
      : null,
  }));
}

export type ApplyWebhookTransitionInput = {
  razorpaySubscriptionId: string;
  status: SubscriptionStatus;
  /** Pass null to leave the existing period end untouched (e.g. halted/pending). */
  currentPeriodEnd: Date | null;
  /**
   * Razorpay's `created_at` for the event being applied (plan E27). When the
   * row has already applied a NEWER event this transition is dropped as a
   * re-delivery / out-of-order delivery. Omit (or pass null) to keep the
   * pre-Phase-6 last-writer-wins behaviour.
   */
  eventAt?: Date | null;
};

export type WebhookTransitionResult =
  /** No row carries this Razorpay subscription id. */
  | { outcome: "unknown"; subscription: null }
  /** A newer event has already been applied; the row is returned untouched. */
  | { outcome: "stale"; subscription: SubjectSubscription }
  | { outcome: "applied"; subscription: SubjectSubscription };

/**
 * Apply a status transition keyed on the Razorpay subscription id.
 *
 * Order-independent (plan E27): Razorpay redelivers on any non-2xx and does not
 * guarantee ordering, so `subscription.charged` (T=100) can land after
 * `subscription.halted` (T=200). Applying the older event would silently
 * resurrect access that has already lapsed — or, worse, revoke access that has
 * already been renewed. The row therefore remembers the event time it last
 * applied and refuses anything older. `current_period_end` additionally only
 * ever moves forward, so a stale renewal can never shorten a live term.
 *
 * The row is locked FOR UPDATE so two concurrent deliveries of different events
 * cannot both read "no newer event applied" and then both write.
 */
export async function applyWebhookTransition(
  input: ApplyWebhookTransitionInput,
): Promise<WebhookTransitionResult> {
  await ensureSubscriptionsSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT * FROM subscriptions.user_subscriptions
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

    const updated = await client.query(
      `UPDATE subscriptions.user_subscriptions
          SET status             = $2,
              -- GREATEST ignores NULLs, so a lapse event (period end NULL)
              -- keeps the stored end and a stale renewal cannot shorten it.
              current_period_end = GREATEST($3::timestamptz, current_period_end),
              last_event_at      = GREATEST($4::timestamptz, last_event_at),
              updated_at         = NOW()
        WHERE razorpay_subscription_id = $1
        RETURNING *`,
      [input.razorpaySubscriptionId, input.status, input.currentPeriodEnd, input.eventAt ?? null],
    );
    await client.query("COMMIT");
    return { outcome: "applied", subscription: rowToSubscription(updated.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Idempotency ledger insert. Returns true when the event is new (caller should
 * process it), false when it has already been recorded (caller returns 200).
 */
export async function recordWebhookEvent(eventId: string, eventType: string | null): Promise<boolean> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `INSERT INTO subscriptions.webhook_events (event_id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, eventType],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Removes a ledger entry so a failed-after-record event is reprocessed on the
 * next Razorpay retry instead of being permanently skipped.
 */
export async function deleteWebhookEvent(eventId: string): Promise<void> {
  await ensureSubscriptionsSchema();
  await pool().query(`DELETE FROM subscriptions.webhook_events WHERE event_id = $1`, [eventId]);
}
