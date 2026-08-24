/**
 * Paid one-time entitlement grants (Rail A).
 *
 * A grant belongs to one paid order. Older versions collapsed all paid
 * purchases for a `(user, subject)` into one row; that made a refund revoke
 * another purchase. Phase 7 keeps one row per order and rebases the remaining
 * rows after a full refund.
 */

import type { PoolClient } from "pg";

import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { createSubjectGrantId } from "@/server/workspaces/ids";
import { isSubject, type Subject } from "@/lib/entitlements";

import { ensurePaymentsAndGrantSchema } from "./payments-schema";

export type PaidTermGrant = {
  id: string;
  userId: string;
  subject: Subject;
  source: "paid_order";
  orderId: string | null;
  expiresAt: string;
  status: "active";
  createdAt: string;
  updatedAt: string;
};

export type GrantPaidTermInput = {
  userId: string;
  subject: Subject | string;
  termMonths: number;
  orderId?: string | null;
  paidAt?: Date;
  client?: PoolClient;
  now?: Date;
};

type QueryRunner = Pick<PoolClient, "query">;

function asDate(value: unknown): Date {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid grant expiry");
  return date;
}

function rowToGrant(row: Record<string, unknown>): PaidTermGrant {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    subject: row.subject as Subject,
    source: "paid_order",
    orderId: row.order_id == null ? null : String(row.order_id),
    expiresAt: asDate(row.expires_at).toISOString(),
    status: "active",
    createdAt: asDate(row.created_at).toISOString(),
    updatedAt: asDate(row.updated_at).toISOString(),
  };
}

/** Pure calendar-month addition used by the database writer and unit tests. */
export function paidTermExpiry(
  existingExpiry: Date | string | null | undefined,
  termMonths: number,
  now = new Date(),
): Date {
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error("termMonths must be a positive integer");
  }
  const nowDate = asDate(now);
  const existing = existingExpiry == null ? nowDate : asDate(existingExpiry);
  const start = existing.getTime() > nowDate.getTime() ? existing : nowDate;
  const expiry = new Date(start.getTime());
  const originalDay = expiry.getUTCDate();
  expiry.setUTCDate(1);
  expiry.setUTCMonth(expiry.getUTCMonth() + termMonths);
  const lastDay = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate();
  expiry.setUTCDate(Math.min(originalDay, lastDay));
  return expiry;
}

export type RebaseGrantInput = { id: string; paidAt: Date | string; termMonths: number };

/** Pure form of the grant rebase algorithm, exported for unit tests. */
export function rebasePaidGrantExpiries(
  grants: RebaseGrantInput[],
): Array<{ id: string; expiresAt: Date }> {
  let previous: Date | null = null;
  return [...grants]
    .sort((a, b) => {
      const byTime = asDate(a.paidAt).getTime() - asDate(b.paidAt).getTime();
      return byTime || a.id.localeCompare(b.id);
    })
    .map((grant) => {
      const paidAt = asDate(grant.paidAt);
      const start = previous && previous.getTime() > paidAt.getTime() ? previous : paidAt;
      const expiresAt = paidTermExpiry(start, grant.termMonths, start);
      previous = expiresAt;
      return { id: grant.id, expiresAt };
    });
}

/** Rebase active paid grants for a user/subject inside the caller's transaction. */
export async function rebasePaidGrantExpiriesForSubject(input: {
  userId: string;
  subject: Subject | string;
  client: PoolClient;
  now?: Date;
}): Promise<PaidTermGrant[]> {
  const subject = typeof input.subject === "string" ? input.subject.trim().toLowerCase() : input.subject;
  if (!isSubject(subject)) throw new Error("A valid subject is required for a paid grant rebase");
  await input.client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.userId]);
  const rows = await input.client.query(
    `SELECT g.*,
            COALESCE(o.paid_at, p.captured_at, o.created_at, g.created_at) AS paid_at_for_rebase,
            COALESCE(o.term_months, 1) AS term_months_for_rebase
       FROM entitlements.subject_grants g
       LEFT JOIN payments.orders o ON o.id = g.order_id
       LEFT JOIN LATERAL (
         SELECT captured_at FROM payments.payments
          WHERE order_id = g.order_id AND status = 'captured'
          ORDER BY captured_at ASC NULLS LAST LIMIT 1
       ) p ON TRUE
      WHERE g.user_id = $1 AND g.subject = $2
        AND g.source = 'paid_order' AND g.status = 'active'
      ORDER BY paid_at_for_rebase ASC, g.id ASC
      FOR UPDATE OF g`,
    [input.userId, subject],
  );
  const values = (rows.rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    // Pass the pg Date through unconverted: String(Date) renders a locale
    // string with no milliseconds, which silently truncated every rebased
    // expiry to the whole second.
    paidAt: (row.paid_at_for_rebase ?? row.created_at) as Date | string,
    termMonths: Number(row.term_months_for_rebase) || 1,
  }));
  const rebased = rebasePaidGrantExpiries(values);
  for (const next of rebased) {
    await input.client.query(
      `UPDATE entitlements.subject_grants SET expires_at = $2, updated_at = NOW() WHERE id = $1`,
      [next.id, next.expiresAt],
    );
  }
  const byId = new Map(rebased.map((row) => [row.id, row.expiresAt.toISOString()]));
  return (rows.rows as Array<Record<string, unknown>>).map((row) =>
    rowToGrant({ ...row, expires_at: byId.get(String(row.id)) ?? row.expires_at }),
  );
}

async function rebaseSubjectAndGetTarget(
  input: {
    userId: string;
    subject: Subject;
    orderId: string;
    termMonths: number;
    paidAt: Date;
  },
  runner: QueryRunner,
): Promise<PaidTermGrant> {
  const rows = await runner.query(
    `SELECT g.*,
            COALESCE(o.paid_at, p.captured_at, o.created_at, g.created_at) AS paid_at_for_rebase,
            COALESCE(o.term_months, $3::int) AS term_months_for_rebase
       FROM entitlements.subject_grants g
       LEFT JOIN payments.orders o ON o.id = g.order_id
       LEFT JOIN LATERAL (
         SELECT captured_at FROM payments.payments
          WHERE order_id = g.order_id AND status = 'captured'
          ORDER BY captured_at ASC NULLS LAST LIMIT 1
       ) p ON TRUE
      WHERE g.user_id = $1 AND g.subject = $2
        AND g.source = 'paid_order' AND g.status = 'active'
      ORDER BY paid_at_for_rebase ASC, g.id ASC
      FOR UPDATE OF g`,
    [input.userId, input.subject, input.termMonths],
  );
  const sourceRows = rows.rows as Array<Record<string, unknown>>;
  const values = sourceRows.map((row) => ({
    id: String(row.id),
    // The pg Date is passed through unconverted: String(Date) renders a locale
    // string with no milliseconds, which collapsed two purchases made in the
    // same second onto one timestamp and left their stacking order to an
    // id tie-break.
    paidAt: (row.paid_at_for_rebase
      ?? (String(row.order_id ?? "") === input.orderId ? input.paidAt : row.created_at)) as Date | string,
    termMonths: Number(row.term_months_for_rebase) || input.termMonths,
  }));
  const rebased = rebasePaidGrantExpiries(values);
  for (const next of rebased) {
    await runner.query(
      `UPDATE entitlements.subject_grants
          SET expires_at = $2, updated_at = NOW()
        WHERE id = $1 AND status = 'active'`,
      [next.id, next.expiresAt],
    );
  }
  const target = sourceRows.find((row) => String(row.order_id ?? "") === input.orderId);
  const targetExpiry = target && rebased.find((row) => row.id === String(target.id))?.expiresAt;
  if (!target || !targetExpiry) throw new Error("Paid entitlement grant could not be loaded after insert");
  return rowToGrant({ ...target, expires_at: targetExpiry });
}

async function writeGrant(input: GrantPaidTermInput, runner: QueryRunner, now: Date): Promise<PaidTermGrant> {
  const subject = typeof input.subject === "string" ? input.subject.trim().toLowerCase() : input.subject;
  if (!isSubject(subject)) throw new Error("A valid subject is required for a paid grant");
  if (!input.userId) throw new Error("userId is required for a paid grant");
  if (!Number.isInteger(input.termMonths) || input.termMonths <= 0) {
    throw new Error("termMonths must be a positive integer");
  }
  await runner.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.userId]);

  const orderId = input.orderId?.trim() || null;
  const paidAt = input.paidAt ?? now;
  // Compatibility for non-order callers that predate Rail A. All payment
  // paths provide orderId and therefore use the per-order branch below.
  if (!orderId) {
    const existing = await runner.query(
      `SELECT * FROM entitlements.subject_grants
        WHERE user_id = $1 AND subject = $2
          AND source = 'paid_order' AND status = 'active'
        ORDER BY expires_at DESC NULLS LAST, id ASC
        LIMIT 1 FOR UPDATE`,
      [input.userId, subject],
    );
    if (existing.rows[0]) {
      const old = existing.rows[0] as Record<string, unknown>;
      const updated = await runner.query(
        `UPDATE entitlements.subject_grants
            SET expires_at = $2, updated_at = NOW()
          WHERE id = $1 RETURNING *`,
        [old.id, paidTermExpiry(old.expires_at == null ? null : String(old.expires_at), input.termMonths, now)],
      );
      return rowToGrant(updated.rows[0]);
    }
    const inserted = await runner.query(
      `INSERT INTO entitlements.subject_grants
         (id, user_id, subject, source, status, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'paid_order', 'active', $4, NOW(), NOW())
       RETURNING *`,
      [createSubjectGrantId(), input.userId, subject, paidTermExpiry(null, input.termMonths, now)],
    );
    return rowToGrant(inserted.rows[0]);
  }

  // Preserve uniqueness across all statuses: a revoked row blocks a late
  // duplicate capture from creating a fresh grant for this order.
  const existing = await runner.query(
    `SELECT * FROM entitlements.subject_grants
      WHERE user_id = $1 AND subject = $2 AND source = 'paid_order' AND order_id = $3
      FOR UPDATE`,
    [input.userId, subject, orderId],
  );
  if (existing.rows[0] && String(existing.rows[0].status) !== "active") {
    throw new Error("This paid order's entitlement has already been revoked");
  }
  if (!existing.rows[0]) {
    await runner.query(
      `INSERT INTO entitlements.subject_grants
         (id, user_id, subject, source, status, expires_at, order_id, created_at, updated_at)
       VALUES ($1, $2, $3, 'paid_order', 'active', $4, $5, NOW(), NOW())`,
      [createSubjectGrantId(), input.userId, subject, paidTermExpiry(null, input.termMonths, paidAt), orderId],
    );
  }
  return rebaseSubjectAndGetTarget(
    { userId: input.userId, subject, orderId, termMonths: input.termMonths, paidAt },
    runner,
  );
}

/** Creates the paid grant for one order. */
export async function grantPaidTerm(input: GrantPaidTermInput): Promise<PaidTermGrant> {
  if (!isUserPostgresConfigured() && !input.client) {
    throw new Error("USER_DATABASE_URL is not configured");
  }
  await ensurePaymentsAndGrantSchema();
  const now = input.now ?? new Date();
  if (input.client) return writeGrant(input, input.client, now);

  const db = getUserPostgresPool();
  if (!db) throw new Error("USER_DATABASE_URL is not configured");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const grant = await writeGrant(input, client, now);
    await client.query("COMMIT");
    await recomputeUserPremiumFlags(input.userId);
    return grant;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Compatibility alias for callers that describe this operation as an apply. */
export const createPaidTermGrant = grantPaidTerm;
