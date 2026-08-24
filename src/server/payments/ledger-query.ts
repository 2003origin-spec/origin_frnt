/**
 * The admin ledger browser: one filterable, exportable view of every order on
 * the money ledger, with the captured charge and the buyer joined on.
 *
 * The browsable row is an **order**, not a payment, because an admin opening
 * this screen is usually asking one of two questions — "who paid, for what,
 * how much" or "why did this checkout not convert" — and only the order side
 * can answer the second. Rail-B mandate charges have no order row; they are
 * counted in the summary and reported here as `subscriptionCharges` so they
 * are never silently missing.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §8 Phase 8.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensurePaymentsSchema } from "./payments-schema";
import type { OrderKind, OrderStatus } from "./payments-store";

export const LEDGER_PAGE_LIMIT = 50;
export const LEDGER_MAX_LIMIT = 200;
/** CSV is a full export, but never an unbounded table scan into memory. */
export const LEDGER_CSV_LIMIT = 5_000;

export const LEDGER_STATUSES: OrderStatus[] = [
  "created",
  "attempted",
  "paid",
  "failed",
  "expired",
  "refunded",
  "partially_refunded",
];

export const LEDGER_KINDS: OrderKind[] = [
  "subject_term",
  "bundle_term",
  "institute_offering",
  "subject_subscription",
  "batch_subscription",
];

export type LedgerFilters = {
  livemode: boolean;
  statuses: OrderStatus[];
  kinds: OrderKind[];
  subject: string | null;
  couponCode: string | null;
  userId: string | null;
  /** Free text over order id, Razorpay ids, buyer email and buyer name. */
  search: string | null;
  fromIso: string | null;
  toIso: string | null;
  limit: number;
  offset: number;
};

export type LedgerRow = {
  orderId: string;
  createdAt: string;
  paidAt: string | null;
  status: OrderStatus;
  kind: OrderKind;
  subject: string | null;
  bundleId: string | null;
  workspaceId: string | null;
  offeringId: string | null;
  termMonths: number;
  baseAmountMinor: number;
  discountMinor: number;
  amountMinor: number;
  currency: string;
  couponCode: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  method: string | null;
  capturedAt: string | null;
  amountRefundedMinor: number;
  disputedAt: string | null;
  failureReason: string | null;
  livemode: boolean;
  userId: string;
  userEmail: string | null;
  userName: string | null;
};

export type LedgerPage = {
  rows: LedgerRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  /** Rail-B invoice charges in the same window that have no order row. */
  subscriptionCharges: number;
};

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function int(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Keeps only values the enum actually accepts, so a filter can never inject. */
export function pickEnum<T extends string>(raw: string[] | null | undefined, allowed: T[]): T[] {
  if (!raw?.length) return [];
  const set = new Set<string>(allowed);
  return [...new Set(raw.map((value) => value.trim().toLowerCase()))].filter(
    (value): value is T => set.has(value),
  );
}

/** Clamps a caller-supplied page size into the allowed band. */
export function clampLimit(raw: unknown, fallback = LEDGER_PAGE_LIMIT, max = LEDGER_MAX_LIMIT): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export async function listLedger(filters: LedgerFilters): Promise<LedgerPage> {
  await ensurePaymentsSchema();
  const db = pool();

  const where: string[] = ["o.livemode = $1"];
  const params: unknown[] = [filters.livemode];
  const bind = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.statuses.length) where.push(`o.status = ANY(${bind(filters.statuses)}::payments.order_status[])`);
  if (filters.kinds.length) where.push(`o.kind = ANY(${bind(filters.kinds)}::payments.order_kind[])`);
  if (filters.subject) where.push(`o.subject = ${bind(filters.subject)}`);
  if (filters.couponCode) where.push(`UPPER(o.coupon_code) = ${bind(filters.couponCode.toUpperCase())}`);
  if (filters.userId) where.push(`o.user_id = ${bind(filters.userId)}`);
  if (filters.fromIso) where.push(`o.created_at >= ${bind(filters.fromIso)}::timestamptz`);
  if (filters.toIso) where.push(`o.created_at < ${bind(filters.toIso)}::timestamptz`);
  if (filters.search) {
    // ILIKE with a leading wildcard cannot use an index; the admin ledger is
    // small and always mode-scoped, and correctness beats a partial-match index
    // we would then have to keep in sync with the columns an admin pastes into.
    const needle = bind(`%${filters.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
    where.push(`(
      o.id ILIKE ${needle}
      OR o.razorpay_order_id ILIKE ${needle}
      OR p.razorpay_payment_id ILIKE ${needle}
      OR u.email ILIKE ${needle}
      OR u.name ILIKE ${needle}
    )`);
  }

  // One captured charge per order (there can only be one — applyPaymentSuccess
  // refuses a second payment id against a paid order), pulled with a LATERAL so
  // the join can never multiply the order rows.
  const from = `
    FROM payments.orders o
    LEFT JOIN LATERAL (
      SELECT * FROM payments.payments
       WHERE order_id = o.id
       ORDER BY (status = 'captured') DESC, captured_at ASC NULLS LAST, created_at ASC
       LIMIT 1
    ) p ON TRUE
    LEFT JOIN origin_users u ON u.id = o.user_id
    WHERE ${where.join(" AND ")}`;

  const countParams = [...params];
  const limitToken = bind(filters.limit);
  const offsetToken = bind(filters.offset);

  const [rows, count, orphans] = await Promise.all([
    db.query(
      `SELECT o.*, u.email AS user_email, u.name AS user_name,
              p.razorpay_payment_id, p.method, p.captured_at,
              p.amount_refunded_minor, p.disputed_at
       ${from}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ${limitToken} OFFSET ${offsetToken}`,
      params,
    ),
    db.query(`SELECT COUNT(*)::int AS total ${from}`, countParams),
    db.query(
      `SELECT COUNT(*)::int AS orphans
         FROM payments.payments
        WHERE livemode = $1 AND order_id IS NULL AND subscription_id IS NOT NULL`,
      [filters.livemode],
    ),
  ]);

  const total = int(count.rows[0]?.total);
  return {
    rows: rows.rows.map((row): LedgerRow => ({
      orderId: String(row.id),
      createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
      paidAt: iso(row.paid_at),
      status: String(row.status) as OrderStatus,
      kind: String(row.kind) as OrderKind,
      subject: row.subject == null ? null : String(row.subject),
      bundleId: row.bundle_id == null ? null : String(row.bundle_id),
      workspaceId: row.workspace_id == null ? null : String(row.workspace_id),
      offeringId: row.offering_id == null ? null : String(row.offering_id),
      termMonths: int(row.term_months),
      baseAmountMinor: int(row.base_amount_minor),
      discountMinor: int(row.discount_minor),
      amountMinor: int(row.amount_minor),
      currency: String(row.currency ?? "INR"),
      couponCode: row.coupon_code == null ? null : String(row.coupon_code),
      razorpayOrderId: row.razorpay_order_id == null ? null : String(row.razorpay_order_id),
      razorpayPaymentId: row.razorpay_payment_id == null ? null : String(row.razorpay_payment_id),
      method: row.method == null ? null : String(row.method),
      capturedAt: iso(row.captured_at),
      amountRefundedMinor: int(row.amount_refunded_minor),
      disputedAt: iso(row.disputed_at),
      failureReason: row.failure_reason == null ? null : String(row.failure_reason),
      livemode: Boolean(row.livemode),
      userId: String(row.user_id),
      userEmail: row.user_email == null ? null : String(row.user_email),
      userName: row.user_name == null ? null : String(row.user_name),
    })),
    total,
    limit: filters.limit,
    offset: filters.offset,
    hasMore: filters.offset + rows.rows.length < total,
    subscriptionCharges: int(orphans.rows[0]?.orphans),
  };
}

export const LEDGER_CSV_COLUMNS = [
  "order_id",
  "created_at",
  "paid_at",
  "status",
  "kind",
  "subject",
  "term_months",
  "currency",
  "base_amount_minor",
  "discount_minor",
  "amount_minor",
  "amount_refunded_minor",
  "coupon_code",
  "method",
  "razorpay_order_id",
  "razorpay_payment_id",
  "captured_at",
  "disputed_at",
  "failure_reason",
  "livemode",
  "user_id",
  "user_email",
  "user_name",
] as const;

/**
 * One CSV cell, RFC-4180 quoted and neutralised against formula injection.
 *
 * A buyer controls their own name and email, and Excel/Sheets execute a cell
 * that starts with `=`, `+`, `-`, `@`, TAB or CR. Prefixing a single quote makes
 * the spreadsheet treat it as text; the value is still readable and still
 * round-trips through any CSV parser.
 */
export function csvCell(value: unknown): string {
  if (value == null) return "";
  const raw = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function ledgerToCsv(rows: LedgerRow[]): string {
  const lines = [LEDGER_CSV_COLUMNS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push([
      csvCell(row.orderId),
      csvCell(row.createdAt),
      csvCell(row.paidAt),
      csvCell(row.status),
      csvCell(row.kind),
      csvCell(row.subject),
      csvCell(row.termMonths),
      csvCell(row.currency),
      csvCell(row.baseAmountMinor),
      csvCell(row.discountMinor),
      csvCell(row.amountMinor),
      csvCell(row.amountRefundedMinor),
      csvCell(row.couponCode),
      csvCell(row.method),
      csvCell(row.razorpayOrderId),
      csvCell(row.razorpayPaymentId),
      csvCell(row.capturedAt),
      csvCell(row.disputedAt),
      csvCell(row.failureReason),
      csvCell(row.livemode),
      csvCell(row.userId),
      csvCell(row.userEmail),
      csvCell(row.userName),
    ].join(","));
  }
  // CRLF + trailing newline: RFC 4180, and what Excel expects on Windows.
  return `${lines.join("\r\n")}\r\n`;
}
