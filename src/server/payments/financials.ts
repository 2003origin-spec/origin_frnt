/**
 * Admin financial reporting over the unified money ledger.
 *
 * Everything here reads `payments.payments` / `payments.orders` — the ledger
 * both rails converge on — so a figure on /admin/financials can always be
 * traced back to a specific captured charge. Nothing is derived from the
 * Razorpay dashboard, and nothing is cached: an admin looking at revenue is
 * looking at the database.
 *
 * Three rules the whole module obeys:
 *
 *  1. **Captured charges are revenue.** `payments.payments.status = 'captured'`
 *     with `livemode` matching the requested mode. An *order* marked paid with
 *     no captured charge is a bug, not revenue, and is deliberately invisible
 *     here so it shows up as a discrepancy rather than as income.
 *  2. **Days are IST days** (D10/§8 Phase 8). Grouping is done with a fixed
 *     +05:30 shift applied to the UTC wall clock, not `AT TIME ZONE`, so the
 *     result cannot be perturbed by the database's ICU/timezone tables and
 *     matches `src/lib/ist-day.ts` exactly.
 *  3. **Test money is quarantined** (D16). Every query is filtered on
 *     `livemode`; a test-mode payment can never be counted in live revenue.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §8 Phase 8.
 */

import type { Pool } from "pg";

import { istDateKey, istDayStartMs, istDayStartMsFromKey, istEpochDay } from "@/lib/ist-day";
import { getUserPostgresPool } from "@/server/user-postgres";

import { ensurePaymentsSchema } from "./payments-schema";

/** The `+ INTERVAL '330 minutes'` shift, spelled once. */
const IST_DAY_EXPR = (column: string) =>
  `to_char((${column} AT TIME ZONE 'UTC') + INTERVAL '330 minutes', 'YYYY-MM-DD')`;

/** A captured charge's revenue instant: Razorpay's capture time, else our insert. */
const REVENUE_AT = "COALESCE(p.captured_at, p.created_at)";

export const MAX_RANGE_DAYS = 366;
export const DEFAULT_RANGE_DAYS = 30;

export type FinancialsRange = {
  /** First IST day in the window, inclusive. */
  fromDay: string;
  /** Last IST day in the window, inclusive. */
  toDay: string;
  /** Instant the window opens (00:00 IST on `fromDay`). */
  fromIso: string;
  /** Instant the window closes — 00:00 IST on the day AFTER `toDay`, exclusive. */
  toIso: string;
  days: number;
};

/**
 * Resolves a reporting window from optional `from`/`to` IST day keys and a day
 * count. Both bounds are inclusive IST days; the returned instants are a
 * half-open `[fromIso, toIso)` interval so a charge at 23:59:59.999 IST on
 * `toDay` is counted exactly once and one at 00:00:00.000 IST the next day is
 * not counted at all.
 */
export function resolveRange(input: {
  from?: string | null;
  to?: string | null;
  days?: number | null;
  now?: Date | number;
}): FinancialsRange {
  const nowMs = typeof input.now === "number" ? input.now : (input.now ?? new Date()).getTime();
  const todayKey = istDateKey(nowMs);

  const toDay = input.to?.trim() ? input.to.trim() : todayKey;
  const toStartMs = istDayStartMsFromKey(toDay);

  let fromDay: string;
  if (input.from?.trim()) {
    fromDay = input.from.trim();
    istDayStartMsFromKey(fromDay); // validate
  } else {
    const requested = Number(input.days);
    const days = Number.isFinite(requested) && requested >= 1
      ? Math.min(Math.floor(requested), MAX_RANGE_DAYS)
      : DEFAULT_RANGE_DAYS;
    fromDay = istDateKey(toStartMs - (days - 1) * 86_400_000);
  }

  const fromStartMs = istDayStartMsFromKey(fromDay);
  if (fromStartMs > toStartMs) throw new Error("`from` must not be after `to`.");
  const days = Math.round((toStartMs - fromStartMs) / 86_400_000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new Error(`A reporting window may span at most ${MAX_RANGE_DAYS} days.`);
  }

  return {
    fromDay,
    toDay,
    fromIso: new Date(fromStartMs).toISOString(),
    toIso: new Date(toStartMs + 86_400_000).toISOString(),
    days,
  };
}

/** Every IST day key in the window, ascending — including the days with no revenue. */
export function istDaysInRange(range: FinancialsRange): string[] {
  const first = istEpochDay(istDayStartMsFromKey(range.fromDay));
  const keys: string[] = [];
  for (let day = first; keys.length < range.days; day += 1) {
    keys.push(istDateKey(istDayStartMs(day)));
  }
  return keys;
}

export type DayPoint = {
  date: string;
  grossMinor: number;
  refundedMinor: number;
  netMinor: number;
  payments: number;
  refunds: number;
};

export type Slice = { key: string; label: string; grossMinor: number; payments: number };

export type CouponAttribution = {
  code: string;
  orders: number;
  discountMinor: number;
  grossMinor: number;
};

export type PaymentsSummary = {
  livemode: boolean;
  range: FinancialsRange;
  generatedAt: string;
  totals: {
    grossMinor: number;
    refundedMinor: number;
    netMinor: number;
    payments: number;
    refunds: number;
    payingUsers: number;
    averageOrderValueMinor: number;
    /** refunded ÷ gross over the window, 0–1, rounded to four places. */
    refundRate: number;
    disputes: number;
  };
  byDay: DayPoint[];
  bySubject: Slice[];
  byMethod: Slice[];
  byKind: Slice[];
  mrr: {
    /** Recurring mandates that bill again on their own (both rails). */
    recurringMinor: number;
    activeSubscriptions: number;
    /**
     * Prepaid terms still inside their access window, amortised to one month
     * (`amount ÷ term_months`). Origin sells mostly prepaid terms, so a
     * subscription-only MRR would read zero while money was coming in.
     */
    prepaidNormalisedMinor: number;
    activePrepaidOrders: number;
    totalMinor: number;
    /** False when the subscription tables are absent (fresh preview database). */
    subscriptionsAvailable: boolean;
  };
  coupons: CouponAttribution[];
  /** Orders opened in the window that never reached a captured charge. */
  funnel: {
    ordersCreated: number;
    ordersPaid: number;
    ordersFailed: number;
    ordersExpired: number;
    conversionRate: number;
  };
};

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function int(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** `refunded ÷ gross`, clamped to [0, 1] and rounded to four decimals. */
export function refundRate(grossMinor: number, refundedMinor: number): number {
  if (!Number.isFinite(grossMinor) || grossMinor <= 0) return 0;
  const ratio = refundedMinor / grossMinor;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.round(Math.min(ratio, 1) * 10_000) / 10_000;
}

/** `paid ÷ created`, clamped to [0, 1] and rounded to four decimals. */
export function conversionRate(created: number, paid: number): number {
  if (!Number.isFinite(created) || created <= 0) return 0;
  return Math.round(Math.min(paid / created, 1) * 10_000) / 10_000;
}

const SUBJECT_LABELS: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  mathematics: "Mathematics",
  biology: "Biology",
};

const KIND_LABELS: Record<string, string> = {
  subject_term: "Subject term",
  bundle_term: "All-subjects bundle",
  institute_offering: "Institute offering",
  subject_subscription: "Subject subscription",
  batch_subscription: "Batch subscription",
};

/**
 * The revenue bucket a captured charge belongs to.
 *
 * A bundle charge is NOT split across its subjects: splitting would invent a
 * per-subject price that no student was ever quoted, and the two views would
 * stop reconciling against the ledger. It gets its own bucket instead.
 */
export function revenueBucket(input: {
  kind: string | null;
  subject: string | null;
  subscriptionSubject?: string | null;
}): { key: string; label: string } {
  const subject = (input.subject ?? input.subscriptionSubject ?? "").trim().toLowerCase();
  if (input.kind === "subject_term" || input.kind === "subject_subscription") {
    if (subject) return { key: subject, label: SUBJECT_LABELS[subject] ?? subject };
  }
  if (input.kind === "bundle_term") return { key: "bundle", label: "All-subjects bundle" };
  if (input.kind === "institute_offering" || input.kind === "batch_subscription") {
    return { key: "institute", label: "Institute / batch" };
  }
  if (subject) return { key: subject, label: SUBJECT_LABELS[subject] ?? subject };
  return { key: "unattributed", label: "Unattributed" };
}

/** Merges rows into one ordered slice list, largest gross first. */
export function foldSlices(
  rows: Array<{ key: string; label: string; grossMinor: number; payments: number }>,
): Slice[] {
  const byKey = new Map<string, Slice>();
  for (const row of rows) {
    const current = byKey.get(row.key);
    if (current) {
      current.grossMinor += row.grossMinor;
      current.payments += row.payments;
    } else {
      byKey.set(row.key, { ...row });
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.grossMinor - a.grossMinor || a.key.localeCompare(b.key),
  );
}

/**
 * Folds mandate-attributed slices into the order-derived ones without
 * double-counting.
 *
 * A Rail-B charge has no order row, so the order join reports it with a NULL
 * kind and it lands in `unattributed`. The mandate join then names its subject.
 * Adding both would count the money twice, and dropping the whole
 * `unattributed` bucket would lose genuinely orphaned charges (a payment whose
 * order row was deleted keeps its money but loses its `order_id`). So exactly
 * the re-attributed amount is subtracted from `unattributed`, which keeps the
 * slices reconciling against the headline gross in every combination.
 */
export function reattributeSubscriptionSlices(
  orderSlices: Array<{ key: string; label: string; grossMinor: number; payments: number }>,
  subscriptionSlices: Array<{ key: string; label: string; grossMinor: number; payments: number }>,
): Slice[] {
  if (subscriptionSlices.length === 0) return foldSlices(orderSlices);
  const attributedGross = subscriptionSlices.reduce((sum, slice) => sum + slice.grossMinor, 0);
  const attributedPayments = subscriptionSlices.reduce((sum, slice) => sum + slice.payments, 0);

  const adjusted = orderSlices
    .map((slice) => {
      if (slice.key !== "unattributed") return slice;
      return {
        ...slice,
        grossMinor: Math.max(0, slice.grossMinor - attributedGross),
        payments: Math.max(0, slice.payments - attributedPayments),
      };
    })
    .filter((slice) => slice.key !== "unattributed" || slice.grossMinor > 0 || slice.payments > 0);

  return foldSlices([...adjusted, ...subscriptionSlices]);
}

/** Pads a sparse day rollup out to every IST day in the window. */
export function fillDaySeries(
  range: FinancialsRange,
  gross: Map<string, { grossMinor: number; payments: number }>,
  refunded: Map<string, { refundedMinor: number; refunds: number }>,
): DayPoint[] {
  return istDaysInRange(range).map((date) => {
    const g = gross.get(date);
    const r = refunded.get(date);
    const grossMinor = g?.grossMinor ?? 0;
    const refundedMinor = r?.refundedMinor ?? 0;
    return {
      date,
      grossMinor,
      refundedMinor,
      netMinor: grossMinor - refundedMinor,
      payments: g?.payments ?? 0,
      refunds: r?.refunds ?? 0,
    };
  });
}

async function tablesPresent(names: string[]): Promise<Set<string>> {
  const res = await pool().query<{ name: string; present: boolean }>(
    `SELECT name, to_regclass(name) IS NOT NULL AS present FROM unnest($1::text[]) AS name`,
    [names],
  );
  return new Set(res.rows.filter((row) => row.present).map((row) => row.name));
}

/**
 * The whole dashboard in one call.
 *
 * Refunds are attributed to the IST day the refund happened, not the day of the
 * original charge, so `netMinor` for a past day never changes retroactively and
 * a window's refund total can exceed its own gross when an older charge is
 * refunded inside it. That is the intended reading of "refunds this week".
 */
export async function getPaymentsSummary(input: {
  livemode: boolean;
  range: FinancialsRange;
}): Promise<PaymentsSummary> {
  await ensurePaymentsSchema();
  const db = pool();
  const { livemode, range } = input;
  const window = [livemode, range.fromIso, range.toIso] as const;

  const [grossByDay, refundsByDay, buckets, methods, kinds, totals, couponRows, funnelRow, prepaid] =
    await Promise.all([
      db.query(
        `SELECT ${IST_DAY_EXPR(REVENUE_AT)} AS day,
                SUM(p.amount_minor)::bigint AS gross_minor,
                COUNT(*)::int              AS payments
           FROM payments.payments p
          WHERE p.status = 'captured' AND p.livemode = $1
            AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz
          GROUP BY 1`,
        [...window],
      ),
      db.query(
        `SELECT ${IST_DAY_EXPR("r.created_at")} AS day,
                SUM(r.amount_minor)::bigint AS refunded_minor,
                COUNT(*)::int               AS refunds
           FROM payments.refunds r
          WHERE r.livemode = $1
            AND r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz
          GROUP BY 1`,
        [...window],
      ),
      db.query(
        `SELECT o.kind::text AS kind, o.subject AS subject,
                SUM(p.amount_minor)::bigint AS gross_minor,
                COUNT(*)::int               AS payments
           FROM payments.payments p
           LEFT JOIN payments.orders o ON o.id = p.order_id
          WHERE p.status = 'captured' AND p.livemode = $1
            AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz
          GROUP BY 1, 2`,
        [...window],
      ),
      db.query(
        `SELECT COALESCE(NULLIF(TRIM(p.method), ''), 'unknown') AS method,
                SUM(p.amount_minor)::bigint AS gross_minor,
                COUNT(*)::int               AS payments
           FROM payments.payments p
          WHERE p.status = 'captured' AND p.livemode = $1
            AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz
          GROUP BY 1`,
        [...window],
      ),
      db.query(
        `SELECT COALESCE(o.kind::text, 'unattributed') AS kind,
                SUM(p.amount_minor)::bigint AS gross_minor,
                COUNT(*)::int               AS payments
           FROM payments.payments p
           LEFT JOIN payments.orders o ON o.id = p.order_id
          WHERE p.status = 'captured' AND p.livemode = $1
            AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz
          GROUP BY 1`,
        [...window],
      ),
      db.query(
        `SELECT
           (SELECT COALESCE(SUM(p.amount_minor), 0)::bigint FROM payments.payments p
             WHERE p.status = 'captured' AND p.livemode = $1
               AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz) AS gross_minor,
           (SELECT COUNT(*)::int FROM payments.payments p
             WHERE p.status = 'captured' AND p.livemode = $1
               AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz) AS payments,
           (SELECT COUNT(DISTINCT p.user_id)::int FROM payments.payments p
             WHERE p.status = 'captured' AND p.livemode = $1 AND p.user_id IS NOT NULL
               AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz) AS paying_users,
           (SELECT COALESCE(SUM(r.amount_minor), 0)::bigint FROM payments.refunds r
             WHERE r.livemode = $1
               AND r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz) AS refunded_minor,
           (SELECT COUNT(*)::int FROM payments.refunds r
             WHERE r.livemode = $1
               AND r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz) AS refunds,
           (SELECT COUNT(*)::int FROM payments.payments p
             WHERE p.livemode = $1 AND p.disputed_at IS NOT NULL
               AND p.disputed_at >= $2::timestamptz AND p.disputed_at < $3::timestamptz) AS disputes`,
        [...window],
      ),
      db.query(
        `SELECT o.coupon_code AS code,
                COUNT(*)::int                    AS orders,
                SUM(o.discount_minor)::bigint    AS discount_minor,
                SUM(p.amount_minor)::bigint      AS gross_minor
           FROM payments.orders o
           JOIN payments.payments p ON p.order_id = o.id AND p.status = 'captured'
          WHERE o.coupon_code IS NOT NULL AND p.livemode = $1
            AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz
          GROUP BY 1
          ORDER BY 3 DESC, 1 ASC
          LIMIT 50`,
        [...window],
      ),
      db.query(
        `SELECT COUNT(*)::int AS created,
                COUNT(*) FILTER (WHERE o.status IN ('paid','refunded','partially_refunded'))::int AS paid,
                COUNT(*) FILTER (WHERE o.status = 'failed')::int  AS failed,
                COUNT(*) FILTER (WHERE o.status = 'expired')::int AS expired
           FROM payments.orders o
          WHERE o.livemode = $1
            AND o.created_at >= $2::timestamptz AND o.created_at < $3::timestamptz`,
        [...window],
      ),
      // Prepaid run rate is a snapshot of NOW, not of the window: it answers
      // "what is currently live", so it is deliberately unbounded by the range.
      db.query(
        `SELECT COALESCE(SUM(o.amount_minor::numeric / GREATEST(o.term_months, 1)), 0)::bigint AS normalised_minor,
                COUNT(*)::int AS orders
           FROM payments.orders o
          WHERE o.status = 'paid' AND o.livemode = $1
            AND o.paid_at IS NOT NULL
            AND o.paid_at + make_interval(months => o.term_months) > NOW()`,
        [livemode],
      ),
    ]);

  const present = await tablesPresent([
    "subscriptions.user_subscriptions",
    "commerce.enrollment_subscriptions",
  ]);
  let recurringMinor = 0;
  let activeSubscriptions = 0;
  const subscriptionSlices: Array<{ key: string; label: string; grossMinor: number; payments: number }> = [];
  if (present.has("subscriptions.user_subscriptions")) {
    const res = await db.query(
      `SELECT COALESCE(SUM(amount_minor), 0)::bigint AS amount_minor, COUNT(*)::int AS subscriptions
         FROM subscriptions.user_subscriptions
        WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW())`,
    );
    recurringMinor += int(res.rows[0]?.amount_minor);
    activeSubscriptions += int(res.rows[0]?.subscriptions);

    // Rail-B charges carry no order row, so their subject comes from the mandate.
    const attributed = await db.query(
      `SELECT s.subject AS subject,
              SUM(p.amount_minor)::bigint AS gross_minor,
              COUNT(*)::int               AS payments
         FROM payments.payments p
         JOIN subscriptions.user_subscriptions s
           ON s.razorpay_subscription_id = p.subscription_id
        WHERE p.status = 'captured' AND p.livemode = $1 AND p.order_id IS NULL
          AND ${REVENUE_AT} >= $2::timestamptz AND ${REVENUE_AT} < $3::timestamptz
        GROUP BY 1`,
      [...window],
    );
    for (const row of attributed.rows) {
      const bucket = revenueBucket({
        kind: "subject_subscription",
        subject: null,
        subscriptionSubject: row.subject as string | null,
      });
      subscriptionSlices.push({ ...bucket, grossMinor: int(row.gross_minor), payments: int(row.payments) });
    }
  }
  if (present.has("commerce.enrollment_subscriptions")) {
    const res = await db.query(
      `SELECT COALESCE(SUM(amount_minor), 0)::bigint AS amount_minor, COUNT(*)::int AS subscriptions
         FROM commerce.enrollment_subscriptions
        WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > NOW())`,
    );
    recurringMinor += int(res.rows[0]?.amount_minor);
    activeSubscriptions += int(res.rows[0]?.subscriptions);
  }

  const grossMap = new Map(
    grossByDay.rows.map((row) => [
      String(row.day),
      { grossMinor: int(row.gross_minor), payments: int(row.payments) },
    ]),
  );
  const refundMap = new Map(
    refundsByDay.rows.map((row) => [
      String(row.day),
      { refundedMinor: int(row.refunded_minor), refunds: int(row.refunds) },
    ]),
  );

  const totalsRow = totals.rows[0] ?? {};
  const grossMinor = int(totalsRow.gross_minor);
  const refundedMinor = int(totalsRow.refunded_minor);
  const payments = int(totalsRow.payments);
  const funnel = funnelRow.rows[0] ?? {};
  const prepaidRow = prepaid.rows[0] ?? {};
  const prepaidNormalisedMinor = int(prepaidRow.normalised_minor);

  const orderSlices = buckets.rows.map((row) => {
    const kind = row.kind == null ? null : String(row.kind);
    const bucket = revenueBucket({ kind, subject: row.subject == null ? null : String(row.subject) });
    return { ...bucket, grossMinor: int(row.gross_minor), payments: int(row.payments) };
  });
  const bySubject = reattributeSubscriptionSlices(orderSlices, subscriptionSlices);

  return {
    livemode,
    range,
    generatedAt: new Date().toISOString(),
    totals: {
      grossMinor,
      refundedMinor,
      netMinor: grossMinor - refundedMinor,
      payments,
      refunds: int(totalsRow.refunds),
      payingUsers: int(totalsRow.paying_users),
      averageOrderValueMinor: payments > 0 ? Math.round(grossMinor / payments) : 0,
      refundRate: refundRate(grossMinor, refundedMinor),
      disputes: int(totalsRow.disputes),
    },
    byDay: fillDaySeries(range, grossMap, refundMap),
    bySubject,
    byMethod: foldSlices(
      methods.rows.map((row) => ({
        key: String(row.method),
        label: String(row.method).toUpperCase(),
        grossMinor: int(row.gross_minor),
        payments: int(row.payments),
      })),
    ),
    byKind: foldSlices(
      kinds.rows.map((row) => ({
        key: String(row.kind),
        label: KIND_LABELS[String(row.kind)] ?? String(row.kind),
        grossMinor: int(row.gross_minor),
        payments: int(row.payments),
      })),
    ),
    mrr: {
      recurringMinor,
      activeSubscriptions,
      prepaidNormalisedMinor,
      activePrepaidOrders: int(prepaidRow.orders),
      totalMinor: recurringMinor + prepaidNormalisedMinor,
      subscriptionsAvailable: present.size > 0,
    },
    coupons: couponRows.rows.map((row) => ({
      code: String(row.code),
      orders: int(row.orders),
      discountMinor: int(row.discount_minor),
      grossMinor: int(row.gross_minor),
    })),
    funnel: {
      ordersCreated: int(funnel.created),
      ordersPaid: int(funnel.paid),
      ordersFailed: int(funnel.failed),
      ordersExpired: int(funnel.expired),
      conversionRate: conversionRate(int(funnel.created), int(funnel.paid)),
    },
  };
}
