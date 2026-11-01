/**
 * P3 + P4 — the status-aware refund lifecycle.
 *
 * `applyRefundInTransaction` is driven with a scripted in-memory PoolClient
 * that models just the rows the refund path touches (payment, refunds, order,
 * grants, outbox). No database: the assertions are about WHICH effects each
 * Razorpay refund status produces — revoke only on `processed`, a pending
 * marker on `created`, a cleared marker + alert on `failed`, and an institute
 * enrolment teardown row only for a full refund.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";

import {
  applyRefundInTransaction,
  abandonRefundIntent,
  initiateRefund,
  isDefiniteRefundRejection,
  mergeRefundPhase,
  PaymentLifecycleError,
  refundInputFromEvent,
  REFUND_INTENT_SETTLE_MS,
  refundPhaseOf,
  settleRefundIntents,
  validateRefundRequest,
} from "@/server/payments/refunds-service";
import { dispatchOutboxRow } from "@/server/payments/outbox";
import { shouldTearDownPaidEnrollment } from "@/server/workspaces/marketplace-service";
import { recordAuditEvent } from "@/server/workspaces/audit";
import type { OutboxRow } from "@/server/payments/payments-store";

type RefundRow = { paymentId: string; amount: number; status: string; seq: number };
type Grant = { orderId: string; userId: string; subject: string; status: string };

type World = {
  payment: {
    razorpay_payment_id: string;
    order_id: string;
    user_id: string;
    amount_minor: number;
    amount_refunded_minor: number;
    status: string;
    currency: string;
    livemode: boolean;
  };
  order: { id: string; kind: string; status: string; notes: Record<string, unknown>; workspace_id: string | null };
  refunds: Map<string, RefundRow>;
  grants: Grant[];
  outbox: Map<string, { kind: string; payload: Record<string, unknown> }>;
};

function world(overrides: { kind?: string; amount?: number; notes?: Record<string, unknown>; workspaceId?: string | null } = {}): World {
  return {
    payment: {
      razorpay_payment_id: "pay_1",
      order_id: "ord_1",
      user_id: "user_1",
      amount_minor: overrides.amount ?? 49900,
      amount_refunded_minor: 0,
      status: "captured",
      currency: "INR",
      livemode: false,
    },
    order: {
      id: "ord_1",
      kind: overrides.kind ?? "subject_term",
      status: "paid",
      notes: overrides.notes ?? {},
      workspace_id: overrides.workspaceId ?? null,
    },
    refunds: new Map(),
    grants: overrides.kind === "institute_offering"
      ? []
      : [{ orderId: "ord_1", userId: "user_1", subject: "physics", status: "active" }],
    outbox: new Map(),
  };
}

const ORDER_TRANSITIONS: Record<string, string[]> = {
  paid: ["paid", "refunded", "partially_refunded"],
  refunded: ["refunded", "partially_refunded"],
  partially_refunded: ["refunded", "partially_refunded"],
};

let seq = 0;

/** A PoolClient that understands exactly the SQL the refund path issues. */
function scriptedClient(w: World): PoolClient {
  const sum = (paymentId: string, statuses: string[]) =>
    [...w.refunds.values()]
      .filter((r) => r.paymentId === paymentId && statuses.includes(r.status))
      .reduce((total, r) => total + r.amount, 0);
  const result = (rows: Array<Record<string, unknown>>) => ({ rows, rowCount: rows.length });

  const query = async (rawSql: string, params: unknown[] = []) => {
    const sql = rawSql.replace(/\s+/g, " ").trim();
    if (/^SELECT \* FROM payments\.payments WHERE razorpay_payment_id = \$1 FOR UPDATE/.test(sql)) {
      return result(params[0] === w.payment.razorpay_payment_id ? [{ ...w.payment }] : []);
    }
    if (/^SELECT razorpay_payment_id, status FROM payments\.refunds WHERE razorpay_refund_id = \$1 FOR UPDATE/.test(sql)) {
      const row = w.refunds.get(String(params[0]));
      return result(row ? [{ razorpay_payment_id: row.paymentId, status: row.status }] : []);
    }
    if (/SUM\(amount_minor\).*status IN \('pending', 'processed'\)/.test(sql)) {
      return result([{ total: sum(String(params[0]), ["pending", "processed"]) }]);
    }
    if (/^INSERT INTO payments\.refunds/.test(sql)) {
      const [id, paymentId, amount, , status] = params as [string, string, number, boolean, string];
      const existing = w.refunds.get(id);
      if (existing) {
        // Mirrors insertRefund's CASE: processed never regresses, failed is
        // never reopened by a late pending.
        if (existing.status === "processed") { /* keep */ }
        else if (existing.status === "failed" && status !== "processed") { /* keep */ }
        else existing.status = status;
        return result([{ inserted: false }]);
      }
      w.refunds.set(id, { paymentId, amount, status, seq: ++seq });
      return result([{ inserted: true }]);
    }
    if (/^UPDATE payments\.payments SET amount_refunded_minor = GREATEST\(amount_refunded_minor, LEAST/.test(sql)) {
      const processed = Math.min(w.payment.amount_minor, sum(String(params[0]), ["processed"]));
      w.payment.amount_refunded_minor = Math.max(w.payment.amount_refunded_minor, processed);
      return result([]);
    }
    if (/SUM\(amount_minor\).*status = 'processed'/.test(sql)) {
      return result([{ total: sum(String(params[0]), ["processed"]) }]);
    }
    if (/^SELECT razorpay_refund_id FROM payments\.refunds WHERE razorpay_payment_id = \$1 AND status = 'pending'/.test(sql)) {
      const latest = [...w.refunds.entries()]
        .filter(([, r]) => r.paymentId === params[0] && r.status === "pending")
        .sort((a, b) => b[1].seq - a[1].seq)[0];
      return result(latest ? [{ razorpay_refund_id: latest[0] }] : []);
    }
    if (/jsonb_build_object\('refund_pending', \$2::text\)/.test(sql)) {
      w.order.notes = { ...w.order.notes, refund_pending: params[1] };
      return result([]);
    }
    if (/- 'refund_pending'/.test(sql)) {
      const { refund_pending: _drop, ...rest } = w.order.notes;
      void _drop;
      w.order.notes = rest;
      return result([]);
    }
    if (/^UPDATE payments\.refunds SET is_full/.test(sql)) return result([]);
    if (/^UPDATE payments\.payments SET amount_refunded_minor = GREATEST\(amount_refunded_minor, \$2\)/.test(sql)) {
      w.payment.amount_refunded_minor = Math.max(w.payment.amount_refunded_minor, Number(params[1]));
      if (params[2]) w.payment.status = "refunded";
      return result([]);
    }
    if (/^UPDATE payments\.orders SET status = \$2::payments\.order_status/.test(sql)) {
      const next = String(params[1]);
      if ((ORDER_TRANSITIONS[w.order.status] ?? [next]).includes(next)) w.order.status = next;
      return result([]);
    }
    if (/^SELECT kind::text AS kind, notes, workspace_id FROM payments\.orders/.test(sql)) {
      return result([{ kind: w.order.kind, notes: w.order.notes, workspace_id: w.order.workspace_id }]);
    }
    if (/^UPDATE entitlements\.subject_grants SET status = 'revoked'/.test(sql)) {
      const revoked = w.grants.filter((g) => g.orderId === params[0] && g.status === "active");
      revoked.forEach((g) => { g.status = "revoked"; });
      return result(revoked.map((g) => ({ user_id: g.userId, subject: g.subject })));
    }
    if (/pg_advisory_xact_lock/.test(sql)) return result([]);
    if (/^SELECT g\.\*/.test(sql)) return result([]);
    if (/^SELECT email, name FROM origin_users WHERE id = \$1/.test(sql)) {
      return result([{ email: "student@example.com", name: "Student" }]);
    }
    if (/^SELECT id FROM origin_users WHERE role = 'admin'/.test(sql)) return result([{ id: "admin_1" }]);
    if (/^INSERT INTO payments\.outbox/.test(sql)) {
      const id = String(params[0]);
      if (!w.outbox.has(id)) w.outbox.set(id, { kind: String(params[1]), payload: JSON.parse(String(params[2])) });
      return result([]);
    }
    throw new Error(`scriptedClient: unexpected SQL: ${sql.slice(0, 120)}`);
  };
  return { query } as unknown as PoolClient;
}

function refund(status: string | null, overrides: { id?: string; amount?: number } = {}) {
  return {
    razorpayRefundId: overrides.id ?? "rfnd_1",
    razorpayPaymentId: "pay_1",
    amountMinor: overrides.amount ?? 49900,
    status,
  };
}

const outboxOfKind = (w: World, kind: string) => [...w.outbox.entries()].filter(([, row]) => row.kind === kind);

// ─── pure helpers ──────────────────────────────────────────────────────────────

test("refundPhaseOf: only Razorpay's processed/failed are terminal; anything else is pending", () => {
  assert.equal(refundPhaseOf("processed"), "processed");
  assert.equal(refundPhaseOf("PROCESSED"), "processed");
  assert.equal(refundPhaseOf("failed"), "failed");
  assert.equal(refundPhaseOf("pending"), "pending");
  assert.equal(refundPhaseOf("created"), "pending");
  assert.equal(refundPhaseOf(null), "pending");
  assert.equal(refundPhaseOf(undefined), "pending");
});

test("mergeRefundPhase: processed never regresses and a late pending never reopens failed", () => {
  assert.equal(mergeRefundPhase(null, "pending"), "pending");
  assert.equal(mergeRefundPhase("pending", "processed"), "processed");
  assert.equal(mergeRefundPhase("processed", "pending"), "processed");
  assert.equal(mergeRefundPhase("processed", "failed"), "processed");
  assert.equal(mergeRefundPhase("pending", "failed"), "failed");
  assert.equal(mergeRefundPhase("failed", "pending"), "failed");
});

test("refundInputFromEvent never defaults to processed", () => {
  const body = (event: string, status?: string) => ({
    event,
    payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 100, ...(status ? { status } : {}) } } },
  });
  assert.equal(refundInputFromEvent(body("refund.created")).status, "pending");
  assert.equal(refundInputFromEvent(body("refund.created", "pending")).status, "pending");
  assert.equal(refundInputFromEvent(body("refund.processed", "processed")).status, "processed");
  assert.equal(refundInputFromEvent(body("refund.processed")).status, "processed");
  assert.equal(refundInputFromEvent(body("refund.failed")).status, "failed");
  // The event name wins for a failure even if the entity status is stale.
  assert.equal(refundInputFromEvent(body("refund.failed", "pending")).status, "failed");
  // The drain passes the event name separately from the stored body.
  assert.equal(refundInputFromEvent({ payload: body("x").payload }, "refund.failed").status, "failed");
});

test("validateRefundRequest reserves headroom for in-flight (pending) refunds", () => {
  const base = {
    status: "captured",
    amountMinor: 49900,
    amountRefundedMinor: 0,
    capturedAt: "2026-10-20T00:00:00.000Z",
    now: new Date("2026-10-21T00:00:00.000Z"),
  };
  assert.equal(validateRefundRequest({ ...base, pendingRefundMinor: 10000 }).remainingMinor, 39900);
  assert.throws(
    () => validateRefundRequest({ ...base, pendingRefundMinor: 49900 }),
    (error: unknown) => error instanceof PaymentLifecycleError && error.status === 409,
  );
});

test("shouldTearDownPaidEnrollment only removes a paid_app seat with no other live paid source", () => {
  const base = { enrollmentSource: "paid_app" as const, hasOtherPaidOrder: false, hasLiveSubscription: false };
  assert.equal(shouldTearDownPaidEnrollment(base), true);
  assert.equal(shouldTearDownPaidEnrollment({ ...base, enrollmentSource: "manual" }), false);
  assert.equal(shouldTearDownPaidEnrollment({ ...base, enrollmentSource: "code" }), false);
  assert.equal(shouldTearDownPaidEnrollment({ ...base, enrollmentSource: null }), false);
  assert.equal(shouldTearDownPaidEnrollment({ ...base, hasOtherPaidOrder: true }), false);
  assert.equal(shouldTearDownPaidEnrollment({ ...base, hasLiveSubscription: true }), false);
  assert.equal(shouldTearDownPaidEnrollment({ ...base, enrollmentStatus: "left" }), false);
});

// ─── lifecycle ─────────────────────────────────────────────────────────────────

test("refund.created (pending) sets the marker and alerts, but does NOT revoke", async () => {
  const w = world();
  const result = await applyRefundInTransaction(refund("pending"), scriptedClient(w));

  assert.equal(result.phase, "pending");
  assert.equal(result.revokedGrantCount, 0);
  assert.equal(result.orderStatus, null);
  assert.equal(result.recomputeUserId, null);
  assert.equal(w.grants[0].status, "active", "access stays until Razorpay processes the refund");
  assert.equal(w.order.status, "paid");
  assert.equal(w.order.notes.refund_pending, "rfnd_1");
  assert.equal(w.payment.amount_refunded_minor, 0, "pending money is not counted as returned");
  assert.equal(outboxOfKind(w, "refund_email").length, 0);
  const alert = w.outbox.get("payment_refund_pending_rfnd_1_admin_1");
  assert.equal(alert?.kind, "notification");
  assert.equal(alert?.payload.notificationTitle, "Refund initiated");
});

test("refund.processed after created revokes, clears the marker and emails the student", async () => {
  const w = world();
  const client = scriptedClient(w);
  await applyRefundInTransaction(refund("pending"), client);
  const result = await applyRefundInTransaction(refund("processed"), client);

  assert.equal(result.phase, "processed");
  assert.equal(result.alreadyApplied, false, "pending → processed is a real transition");
  assert.equal(result.isFull, true);
  assert.equal(result.revokedGrantCount, 1);
  assert.equal(result.orderStatus, "refunded");
  assert.equal(result.recomputeUserId, "user_1");
  assert.equal(w.grants[0].status, "revoked");
  assert.equal(w.order.status, "refunded");
  assert.equal("refund_pending" in w.order.notes, false);
  assert.equal(w.payment.amount_refunded_minor, 49900);
  assert.equal(w.payment.status, "refunded");
  const email = w.outbox.get("payment_refund_full_pay_1");
  assert.equal(email?.kind, "refund_email");
  assert.equal(email?.payload.href, "/premium");

  // A redelivered processed event changes nothing.
  const again = await applyRefundInTransaction(refund("processed"), client);
  assert.equal(again.alreadyApplied, true);
  assert.equal(again.revokedGrantCount, 0);
});

test("refund.failed after created clears the marker, keeps access and raises a FAILED alert", async () => {
  const w = world();
  const client = scriptedClient(w);
  await applyRefundInTransaction(refund("pending"), client);
  const result = await applyRefundInTransaction(refund("failed"), client);

  assert.equal(result.phase, "failed");
  assert.equal(result.revokedGrantCount, 0);
  assert.equal(result.orderStatus, null);
  assert.equal(w.grants[0].status, "active");
  assert.equal(w.order.status, "paid");
  assert.equal("refund_pending" in w.order.notes, false);
  assert.equal(w.refunds.get("rfnd_1")?.status, "failed");
  assert.equal(w.payment.amount_refunded_minor, 0);
  const alert = w.outbox.get("payment_refund_failed_rfnd_1_admin_1");
  assert.equal(alert?.payload.notificationTitle, "Refund FAILED");
  assert.match(String(alert?.payload.notificationMessage), /still with Origin/);
  assert.equal(outboxOfKind(w, "refund_email").length, 0);

  // A late refund.created can never reopen the failed refund.
  const late = await applyRefundInTransaction(refund("pending"), client);
  assert.equal(late.phase, "failed");
  assert.equal("refund_pending" in w.order.notes, false);
});

test("out of order: processed before created stays processed", async () => {
  const w = world();
  const client = scriptedClient(w);
  await applyRefundInTransaction(refund("processed"), client);
  const late = await applyRefundInTransaction(refund("pending"), client);
  assert.equal(late.phase, "processed");
  assert.equal(late.alreadyApplied, true);
  assert.equal(w.refunds.get("rfnd_1")?.status, "processed");
  assert.equal(w.order.status, "refunded");
  assert.equal("refund_pending" in w.order.notes, false);
  assert.equal(w.outbox.has("payment_refund_pending_rfnd_1_admin_1"), false);
});

test("a processed refund that later reports failed stays processed and alerts for manual review", async () => {
  const w = world();
  const client = scriptedClient(w);
  await applyRefundInTransaction(refund("processed"), client);
  const reversal = await applyRefundInTransaction(refund("failed"), client);
  assert.equal(reversal.phase, "processed");
  assert.equal(reversal.reversal, true);
  assert.equal(w.grants[0].status, "revoked", "access is never auto-restored");
  assert.equal(
    w.outbox.get("payment_refund_reversal_rfnd_1_admin_1")?.payload.notificationTitle,
    "Refund reversal — manual review",
  );
});

test("an in-flight refund reserves headroom: a second refund over the remainder is refused", async () => {
  const w = world();
  const client = scriptedClient(w);
  await applyRefundInTransaction(refund("pending", { id: "rfnd_a", amount: 40000 }), client);
  await assert.rejects(
    applyRefundInTransaction(refund("pending", { id: "rfnd_b", amount: 10000 }), client),
    (error: unknown) => error instanceof PaymentLifecycleError && error.status === 409,
  );
  // Two pending refunds: the marker tracks the newest still-pending one.
  await applyRefundInTransaction(refund("pending", { id: "rfnd_c", amount: 9900 }), client);
  assert.equal(w.order.notes.refund_pending, "rfnd_c");
  await applyRefundInTransaction(refund("failed", { id: "rfnd_c", amount: 9900 }), client);
  assert.equal(w.order.notes.refund_pending, "rfnd_a", "marker falls back to the remaining pending refund");
});

test("institute offering: a FULL processed refund enqueues the enrolment teardown", async () => {
  const w = world({
    kind: "institute_offering",
    notes: { enrollment_order_id: "eo_1" },
    workspaceId: "ws_1",
  });
  const client = scriptedClient(w);
  await applyRefundInTransaction(refund("pending"), client);
  assert.equal(outboxOfKind(w, "institute_enrollment_revoke").length, 0, "nothing is torn down while pending");

  await applyRefundInTransaction(refund("processed"), client);
  const rows = outboxOfKind(w, "institute_enrollment_revoke");
  assert.equal(rows.length, 1);
  const [id, row] = rows[0];
  assert.equal(id, "institute_enrollment_refund_pay_1");
  assert.deepEqual(row.payload, {
    userId: "user_1",
    orderId: "ord_1",
    enrollmentOrderId: "eo_1",
    workspaceId: "ws_1",
    refundId: "rfnd_1",
    paymentId: "pay_1",
  });
  assert.equal(w.outbox.get("payment_refund_full_pay_1")?.payload.href, "/connect");
});

test("institute offering: refunding a DUPLICATE capture (P5) never tears down the original's enrolment", async () => {
  const w = world({
    kind: "institute_offering",
    notes: { enrollment_order_id: "eo_1", duplicate_of: "ord_original" },
    workspaceId: "ws_1",
  });
  const result = await applyRefundInTransaction(refund("processed"), scriptedClient(w));
  assert.equal(result.isFull, true);
  assert.equal(result.orderStatus, "refunded");
  assert.equal(outboxOfKind(w, "institute_enrollment_revoke").length, 0);
  assert.equal(outboxOfKind(w, "notification").filter(([id]) => id.startsWith("payment_refund_institute_unlinked")).length, 0);
  assert.equal(outboxOfKind(w, "refund_email").length, 1, "the student still gets the refund notice");
});

test("institute offering: a PARTIAL processed refund keeps the enrolment", async () => {
  const w = world({
    kind: "institute_offering",
    notes: { enrollment_order_id: "eo_1" },
    workspaceId: "ws_1",
  });
  const result = await applyRefundInTransaction(refund("processed", { amount: 10000 }), scriptedClient(w));
  assert.equal(result.isFull, false);
  assert.equal(result.orderStatus, "partially_refunded");
  assert.equal(outboxOfKind(w, "institute_enrollment_revoke").length, 0);
  assert.equal(outboxOfKind(w, "refund_email").length, 0);
  assert.equal(
    w.outbox.get("payment_refund_partial_rfnd_1_admin_1")?.payload.notificationTitle,
    "Partial payment refund",
  );
});

test("outbox: institute_enrollment_revoke is action-only and validates its ids", async () => {
  const row = (payload: Record<string, unknown>): OutboxRow => ({
    id: "institute_enrollment_refund_pay_1",
    kind: "institute_enrollment_revoke",
    payload,
    status: "processing",
    attempts: 1,
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    deliveredVia: null,
  } as unknown as OutboxRow);
  let mailed = 0;
  let notified = 0;
  const deps = {
    sendEmail: (async () => { mailed += 1; return { success: true }; }) as never,
    createNotification: (async () => { notified += 1; }) as never,
  };
  // Reaches the action (not "Unsupported kind") and refuses a row without ids.
  await assert.rejects(
    dispatchOutboxRow(row({ userId: "user_1", workspaceId: "ws_1", refundId: "rfnd_1" }), deps),
    /institute_enrollment_revoke outbox row is missing its order reference/,
  );
  assert.equal(mailed, 0);
  assert.equal(notified, 0);
  await assert.rejects(
    dispatchOutboxRow({ ...row({}), kind: "not_a_kind" } as OutboxRow, deps),
    /Unsupported payment outbox kind/,
  );
});

// ─── initiateRefund: no lock held across the Razorpay call ───────────────────

// initiateRefund's schema ensure lazily imports pricing-schema, which imports
// `server-only` (it throws outside a react-server runner). No database is
// configured here, so every ensure returns early; only the import must pass.
{
  const serverOnly = require.resolve("server-only");
  require.cache[serverOnly] = { id: serverOnly, filename: serverOnly, loaded: true, exports: {} } as NodeJS.Module;
}

/**
 * A pool over the scripted client that also models BEGIN/COMMIT, checkouts and
 * the payments.refund_intents row, so the test can assert what is held while
 * the Razorpay adapter runs.
 */
function scriptedDb(w: World) {
  const inner = scriptedClient(w);
  const state = {
    checkedOut: 0,
    openTxns: 0,
    intent: null as null | {
      intentId: string;
      amount: number;
      createdAt: number;
      state: "sending" | "unknown";
      abandonedAt?: Date;
      abandonedBy?: string;
    },
    /** Every statement, per transaction (BEGIN..COMMIT/ROLLBACK), in order. */
    txns: [] as string[][],
  };
  const connect = async () => {
    state.checkedOut += 1;
    let inTxn = false;
    let txnLog: string[] = [];
    type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number };
    const innerQuery = (inner as unknown as { query: (sql: string, params?: unknown[]) => Promise<QueryResult> }).query;
    const query = async (rawSql: string, params: unknown[] = []): Promise<QueryResult> => {
      const sql = rawSql.replace(/\s+/g, " ").trim();
      if (sql === "BEGIN") {
        inTxn = true;
        state.openTxns += 1;
        txnLog = [];
        state.txns.push(txnLog);
        return { rows: [], rowCount: 0 };
      }
      if (inTxn && sql !== "COMMIT" && sql !== "ROLLBACK") txnLog.push(sql);
      if (sql === "COMMIT" || sql === "ROLLBACK") {
        if (inTxn) state.openTxns -= 1;
        inTxn = false;
        return { rows: [], rowCount: 0 };
      }
      const open = state.intent && !state.intent.abandonedAt ? state.intent : null;
      const age = open ? Date.now() - open.createdAt : 0;
      if (/^SELECT intent_id, state\b.* FROM payments\.refund_intents/.test(sql)) {
        const live = Boolean(open && age < Number(params[1]) * 1000);
        // step 1 asks for an unknown or LIVE intent; the resolver for an unknown or EXPIRED one
        const wantExpired = /created_at <= NOW\(\)/.test(sql);
        const i = open && (open.state === "unknown" || (wantExpired ? !live : live)) ? open : null;
        return {
          rows: i
            ? [{
                intent_id: i.intentId, state: i.state, amount_minor: i.amount, initiated_by: "admin_1",
                created_at: new Date(i.createdAt), past_settle: params[2] != null && age >= Number(params[2]) * 1000,
              }]
            : [],
          rowCount: i ? 1 : 0,
        };
      }
      if (/^SELECT razorpay_payment_id FROM payments\.refund_intents/.test(sql)) {
        const due = open && (open.state === "unknown" || age >= Number(params[0]) * 1000);
        return { rows: due ? [{ razorpay_payment_id: "pay_1" }] : [], rowCount: due ? 1 : 0 };
      }
      if (/^UPDATE payments\.refund_intents SET abandoned_at/.test(sql)) {
        if (!open || open.intentId !== params[1]) return { rows: [], rowCount: 0 };
        open.abandonedAt = new Date();
        open.abandonedBy = String(params[2]);
        return { rows: [{ abandoned_at: open.abandonedAt }], rowCount: 1 };
      }
      if (/^INSERT INTO payments\.refund_intents/.test(sql)) {
        state.intent = { intentId: String(params[1]), amount: Number(params[2]), createdAt: Date.now(), state: "sending" };
        return { rows: [], rowCount: 1 };
      }
      if (/^UPDATE payments\.refund_intents SET state = 'unknown'/.test(sql)) {
        if (state.intent && state.intent.intentId === params[1]) state.intent.state = "unknown";
        return { rows: [], rowCount: 1 };
      }
      if (/^DELETE FROM payments\.refund_intents/.test(sql)) {
        if (state.intent?.intentId === params[1]) state.intent = null;
        return { rows: [], rowCount: 1 };
      }
      if (/^SELECT p\.\*/.test(sql)) {
        const pending = [...w.refunds.values()]
          .filter((r) => r.paymentId === w.payment.razorpay_payment_id && r.status === "pending")
          .reduce((t, r) => t + r.amount, 0);
        return { rows: [{ ...w.payment, captured_at: new Date(), pending_refund_minor: pending }], rowCount: 1 };
      }
      return innerQuery(rawSql, params);
    };
    return { query, release: () => { state.checkedOut -= 1; } } as unknown as PoolClient;
  };
  return { db: { connect }, state };
}

test("initiateRefund holds no transaction or connection during the Razorpay call", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  let sawDuringCall: { checkedOut: number; openTxns: number; intent: boolean } | null = null;
  const result = await initiateRefund({
    razorpayPaymentId: "pay_1",
    initiatedBy: "admin_1",
    db,
    razorpayClient: {
      payments: {
        async refund(_id, body) {
          sawDuringCall = { checkedOut: state.checkedOut, openTxns: state.openTxns, intent: state.intent !== null };
          return { id: "rfnd_live", amount: body.amount, status: "pending" };
        },
      },
    },
  });
  assert.deepEqual(sawDuringCall, { checkedOut: 0, openTxns: 0, intent: true });
  assert.equal(result.razorpayRefundId, "rfnd_live");
  assert.equal(w.refunds.get("rfnd_live")?.status, "pending");
  assert.equal(state.intent, null, "the intent is cleared once the refund is recorded");
  assert.equal(state.checkedOut, 0);
});

test("initiateRefund: both short transactions take the user payments lock before any row lock", async () => {
  // refund-lifecycle F12 x coupon-and-double-charge F5: the per-user lock is
  // held in step 1 (validate + intent) and step 3 (record), in canonical order,
  // and never across the Razorpay call.
  const w = world();
  const { db, state } = scriptedDb(w);
  let txnsBeforeCall = -1;
  await initiateRefund({
    razorpayPaymentId: "pay_1",
    initiatedBy: "admin_1",
    db,
    razorpayClient: {
      payments: {
        async refund(_id, body) {
          txnsBeforeCall = state.txns.length;
          return { id: "rfnd_lock", amount: body.amount, status: "pending" };
        },
      },
    },
  });
  assert.equal(txnsBeforeCall, 1, "step 1 committed before Razorpay; step 3 had not begun");
  assert.equal(state.txns.length, 2);
  for (const [i, txn] of state.txns.entries()) {
    const lock = txn.findIndex((sql) => /pg_advisory_xact_lock\(hashtext\(user_id\)\)/.test(sql));
    const firstRowLock = txn.findIndex((sql) => /FOR UPDATE/.test(sql));
    assert.ok(lock >= 0, `transaction ${i + 1} takes the user payments lock`);
    assert.ok(firstRowLock > lock, `transaction ${i + 1}: user lock before the first row lock`);
  }
});

test("initiateRefund: a second initiation while one is in flight is refused; a Razorpay error frees it", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  let second: Promise<unknown> | null = null;
  await assert.rejects(
    initiateRefund({
      razorpayPaymentId: "pay_1",
      initiatedBy: "admin_1",
      db,
      razorpayClient: {
        payments: {
          async refund() {
            second = initiateRefund({
              razorpayPaymentId: "pay_1",
              initiatedBy: "admin_2",
              db,
              razorpayClient: { payments: { refund: async () => assert.fail("second call must not reach Razorpay") } },
            });
            await assert.rejects(second, (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409);
            throw Object.assign(new Error("razorpay 400"), { statusCode: 400 });
          },
        },
      },
    }),
    /razorpay 400/,
  );
  assert.ok(second, "the concurrent initiation ran");
  assert.equal(state.intent, null, "a definite (4xx) Razorpay rejection clears its intent so the admin can retry");
  assert.equal(w.refunds.size, 0);
  assert.equal(state.checkedOut, 0);
});

// ─── ambiguous Razorpay answers keep the intent (round-3 R3-14) ──────────────

test("isDefiniteRefundRejection: only an HTTP 4xx (not 408) from Razorpay is definite", () => {
  for (const statusCode of [400, 401, 404, 409, 422, 429]) {
    assert.equal(isDefiniteRefundRejection({ statusCode, error: { code: "BAD_REQUEST_ERROR" } }), true, String(statusCode));
  }
  for (const error of [
    { statusCode: 408 },
    { statusCode: 500 },
    { statusCode: 502 },
    { statusCode: 504 },
    new Error("socket hang up"),
    Object.assign(new Error("timeout of 30000ms exceeded"), { code: "ECONNABORTED" }),
    new PaymentLifecycleError(502, "Razorpay did not return a refund id."),
    null,
  ]) {
    assert.equal(isDefiniteRefundRejection(error), false, JSON.stringify(error));
  }
});

type FakeRefund = { id: string; payment_id: string; amount: number; status: string; notes?: Record<string, string>; created_at: number };

function gateway(opts: {
  refund: (id: string, body: { amount: number; notes?: Record<string, string> }) => Promise<Record<string, unknown>>;
  existing?: () => Promise<FakeRefund[]>;
}) {
  const calls = { refund: 0, fetch: 0 };
  return {
    calls,
    client: {
      payments: {
        async refund(id: string, body: { amount: number; notes?: Record<string, string> }) {
          calls.refund += 1;
          return opts.refund(id, body);
        },
        async fetchMultipleRefund() {
          calls.fetch += 1;
          return { items: opts.existing ? await opts.existing() : [] };
        },
      },
    },
  };
}

for (const [label, failure] of [
  ["a timeout", () => Object.assign(new Error("timeout of 30000ms exceeded"), { code: "ECONNABORTED" })],
  ["a 5xx", () => Object.assign(new Error("Razorpay 503"), { statusCode: 503 })],
  ["a network error", () => new Error("socket hang up")],
] as const) {
  test(`an ambiguous Razorpay answer (${label}) keeps the intent as unknown instead of clearing it`, async () => {
    const w = world();
    const { db, state } = scriptedDb(w);
    const g = gateway({ refund: async () => { throw failure(); } });
    await assert.rejects(
      initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: g.client }),
      (e: unknown) => e instanceof PaymentLifecycleError && e.status === 502 && /may or may not/.test(e.message),
    );
    assert.equal(state.intent?.state, "unknown");
    assert.equal(state.checkedOut, 0);
  });
}

test("a 2xx answer that fails our checks (no refund id) is ambiguous too", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  const g = gateway({ refund: async () => ({ amount: 10000, status: "pending" }) });
  await assert.rejects(
    initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: g.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 502,
  );
  assert.equal(state.intent?.state, "unknown");
});

test("retry after an ambiguous answer: Razorpay DID create the refund -> recorded, retry refused, no second refund", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  const ghost: { refund: FakeRefund | null } = { refund: null };
  // First click: Razorpay accepts the refund, but the answer never arrives.
  const first = gateway({
    refund: async (id, body) => {
      ghost.refund = { id: "rfnd_ghost", payment_id: id, amount: body.amount, status: "pending", notes: body.notes, created_at: Math.floor(Date.now() / 1000) };
      throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
    },
  });
  await assert.rejects(
    initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: first.client }),
  );
  const created = ghost.refund;
  assert.ok(created, "Razorpay created the refund");
  assert.equal(created.notes?.origin_intent_id, state.intent?.intentId, "the refund carries the intent id");

  // Second click, before any webhook: resolved against Razorpay first.
  const retry = gateway({ refund: async () => assert.fail("must not create a second refund"), existing: async () => [created] });
  await assert.rejects(
    initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: retry.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409 && /rfnd_ghost/.test(e.message),
  );
  assert.equal(retry.calls.fetch, 1);
  assert.equal(retry.calls.refund, 0);
  assert.equal(w.refunds.get("rfnd_ghost")?.status, "pending", "the ghost refund is now in the ledger");
  assert.equal(state.intent, null, "resolved");

  // A third click now sees the pending refund's reserved headroom like any other.
  const third = gateway({ refund: async (_id, body) => ({ id: "rfnd_more", amount: body.amount, status: "pending" }) });
  const result = await initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: third.client });
  assert.equal(result.razorpayRefundId, "rfnd_more");
  assert.equal(state.checkedOut, 0);
});

/** Leaves an `unknown` intent behind (Razorpay answered 500), as the first admin click would. */
async function leaveUnknownIntent(db: { connect(): Promise<PoolClient> }) {
  await assert.rejects(
    initiateRefund({
      razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db,
      razorpayClient: gateway({ refund: async () => { throw Object.assign(new Error("Razorpay 500"), { statusCode: 500 }); } }).client,
    }),
  );
}

/** Ages the intent past the settle window. */
function pastSettleWindow(state: { intent: { createdAt: number } | null }) {
  assert.ok(state.intent);
  state.intent.createdAt -= REFUND_INTENT_SETTLE_MS + 1000;
}

test("retry seconds after an ambiguous answer: Razorpay lists no refund YET -> 409, intent kept, nothing sent", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  await leaveUnknownIntent(db);
  const retry = gateway({ refund: async () => assert.fail("must not send while the outcome is settling"), existing: async () => [] });
  await assert.rejects(
    initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: retry.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409 && /still being confirmed/.test(e.message) && /few minutes/.test(e.message),
  );
  assert.equal(retry.calls.fetch, 1);
  assert.equal(retry.calls.refund, 0);
  assert.equal(state.intent?.state, "unknown", "kept until the settle window has passed");
  assert.equal(state.checkedOut, 0);
});

test("retry after the settle window: Razorpay has NO such refund -> intent dropped and the refund is sent", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  await leaveUnknownIntent(db);
  assert.equal(state.intent?.state, "unknown");
  pastSettleWindow(state);
  const retry = gateway({ refund: async (_id, body) => ({ id: "rfnd_ok", amount: body.amount, status: "pending" }), existing: async () => [] });
  const result = await initiateRefund({ razorpayPaymentId: "pay_1", initiatedBy: "admin_1", db, razorpayClient: retry.client });
  assert.equal(retry.calls.fetch, 1);
  assert.equal(result.razorpayRefundId, "rfnd_ok");
  assert.equal(state.intent, null);
});

test("refund lookup matches by origin_intent_id first; another intent's same-amount refund is not ours", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  await leaveUnknownIntent(db);
  const ours = state.intent!.intentId;
  const now = Math.floor(Date.now() / 1000);
  const retry = gateway({
    refund: async () => assert.fail("our refund exists"),
    existing: async () => [
      { id: "rfnd_other", payment_id: "pay_1", amount: 10000, status: "processed", notes: { origin_intent_id: "rfi_someone_else" }, created_at: now },
      { id: "rfnd_ours", payment_id: "pay_1", amount: 10000, status: "pending", notes: { origin_intent_id: ours }, created_at: now },
    ],
  });
  await assert.rejects(
    initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: retry.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409 && /rfnd_ours/.test(e.message),
  );
  assert.equal(w.refunds.get("rfnd_ours")?.status, "pending", "recorded");
  assert.ok(w.refunds.has("rfnd_other"), "every listed refund is recorded");
  assert.equal(state.intent, null);
});

test("refund lookup falls back to amount + time only for refunds without an origin_intent_id note", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  await leaveUnknownIntent(db);
  const now = Math.floor(Date.now() / 1000);
  // A note-less refund of a different amount is not ours: still settling.
  const differentAmount = gateway({
    refund: async () => assert.fail("settling"),
    existing: async () => [{ id: "rfnd_manual", payment_id: "pay_1", amount: 5000, status: "pending", created_at: now }],
  });
  await assert.rejects(
    initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: differentAmount.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409 && /still being confirmed/.test(e.message),
  );
  assert.equal(state.intent?.state, "unknown");
  // Same amount, created after the intent, no note: ours.
  const sameAmount = gateway({
    refund: async () => assert.fail("found"),
    existing: async () => [
      { id: "rfnd_manual", payment_id: "pay_1", amount: 5000, status: "pending", created_at: now },
      { id: "rfnd_legacy", payment_id: "pay_1", amount: 10000, status: "pending", created_at: now },
    ],
  });
  await assert.rejects(
    initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_1", db, razorpayClient: sameAmount.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409 && /rfnd_legacy/.test(e.message),
  );
  assert.equal(state.intent, null);
});

test("reconcile keeps re-checking an unknown intent and drops it only after the settle window", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  await leaveUnknownIntent(db);
  const g = gateway({ refund: async () => assert.fail("reconcile never sends"), existing: async () => [] });
  assert.deepEqual(
    await settleRefundIntents({ limit: 10, db, razorpayClient: g.client }),
    { inspected: 1, refundFound: 0, dropped: 0, settling: 1, unresolved: 0 },
  );
  assert.equal(state.intent?.state, "unknown");
  pastSettleWindow(state);
  assert.deepEqual(
    await settleRefundIntents({ limit: 10, db, razorpayClient: g.client }),
    { inspected: 1, refundFound: 0, dropped: 1, settling: 0, unresolved: 0 },
  );
  assert.equal(state.intent, null);
  assert.equal(g.calls.refund, 0);
  assert.equal(state.checkedOut, 0);
});

test("admin abandon: refused inside the settle window, then abandoned with an audit event and no longer blocking", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  await leaveUnknownIntent(db);
  const intentId = state.intent!.intentId;
  const audits: Array<Record<string, unknown>> = [];
  const auditClients: unknown[] = [];
  const audit = async (event: Record<string, unknown>, tx: { client: PoolClient }) => {
    // Written through the abandon transaction's own client, before COMMIT.
    assert.equal(state.openTxns, 1, "the audit runs inside the abandon transaction");
    auditClients.push(tx.client);
    audits.push(event);
  };
  const lookup = gateway({ refund: async () => assert.fail("abandon never sends"), existing: async () => [] });

  await assert.rejects(
    abandonRefundIntent({ razorpayPaymentId: "pay_1", actorUserId: "admin_2", audit, db, razorpayClient: lookup.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409 && /settling/.test(e.message),
  );
  assert.equal(audits.length, 0);
  assert.equal(state.intent?.abandonedAt, undefined);

  pastSettleWindow(state);
  const result = await abandonRefundIntent({
    razorpayPaymentId: "pay_1", actorUserId: "admin_2", requestId: "req_1", audit, db, razorpayClient: lookup.client,
  });
  assert.equal(result.outcome, "abandoned");
  assert.equal(lookup.calls.fetch, 2, "the lookup is re-run before abandoning");
  assert.equal(state.intent?.abandonedBy, "admin_2", "kept, marked abandoned");
  assert.equal(audits.length, 1);
  assert.ok(auditClients[0] && typeof (auditClients[0] as PoolClient).query === "function");
  assert.equal(audits[0].action, "payment.refund_intent_abandoned");
  assert.equal(audits[0].actorUserId, "admin_2");
  assert.equal(audits[0].entityType, "payment");
  assert.equal(audits[0].entityId, "pay_1");
  assert.equal(audits[0].requestId, "req_1");
  assert.equal((audits[0].before as { intentId: string }).intentId, intentId);
  assert.equal((audits[0].after as { state: string }).state, "abandoned");

  // Nothing left to abandon; and a new refund is no longer blocked.
  await assert.rejects(
    abandonRefundIntent({ razorpayPaymentId: "pay_1", actorUserId: "admin_2", audit, db, razorpayClient: lookup.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 404,
  );
  const next = gateway({ refund: async (_id, body) => ({ id: "rfnd_new", amount: body.amount, status: "pending" }) });
  const sent = await initiateRefund({ razorpayPaymentId: "pay_1", amountMinor: 10000, initiatedBy: "admin_2", db, razorpayClient: next.client });
  assert.equal(sent.razorpayRefundId, "rfnd_new");
  assert.equal(next.calls.fetch, 0, "an abandoned intent needs no lookup");
  assert.equal(audits.length, 1);
  assert.equal(state.checkedOut, 0);
});

test("recordAuditEvent with a transaction client inserts through that client", async () => {
  const seen: Array<{ sql: string; params: unknown[] }> = [];
  const client = { query: async (sql: string, params: unknown[] = []) => { seen.push({ sql, params }); return { rows: [] }; } };
  await recordAuditEvent(
    {
      actorUserId: "admin_2",
      workspaceId: null,
      entityType: "payment",
      entityId: "pay_1",
      action: "payment.refund_intent_abandoned",
      after: { state: "abandoned" },
      requestId: "req_1",
    },
    { client },
  );
  const insert = seen.find((q) => /INSERT INTO app\.audit_events/.test(q.sql));
  assert.ok(insert, "the audit row goes through the given client");
  assert.equal(insert!.params[5], "payment.refund_intent_abandoned");
});

test("admin abandon: a refund that did go out is recorded instead, without abandoning", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  await leaveUnknownIntent(db);
  pastSettleWindow(state);
  const audits: unknown[] = [];
  const lookup = gateway({
    refund: async () => assert.fail("never sends"),
    existing: async () => [{
      id: "rfnd_late", payment_id: "pay_1", amount: 10000, status: "pending",
      notes: { origin_intent_id: state.intent!.intentId }, created_at: Math.floor(Date.now() / 1000),
    }],
  });
  const result = await abandonRefundIntent({
    razorpayPaymentId: "pay_1", actorUserId: "admin_2", audit: async (e) => { audits.push(e); }, db, razorpayClient: lookup.client,
  });
  assert.deepEqual(result, { outcome: "refund_found", intentId: result.intentId, razorpayRefundId: "rfnd_late" });
  assert.equal(w.refunds.get("rfnd_late")?.status, "pending");
  assert.equal(state.intent, null);
  assert.equal(audits.length, 0);
});

test("an unknown intent keeps blocking when Razorpay cannot be checked", async () => {
  const w = world();
  const { db, state } = scriptedDb(w);
  await assert.rejects(
    initiateRefund({
      razorpayPaymentId: "pay_1", initiatedBy: "admin_1", db,
      razorpayClient: gateway({ refund: async () => { throw new Error("socket hang up"); } }).client,
    }),
  );
  const retry = gateway({
    refund: async () => assert.fail("must not create a refund while the earlier one is unresolved"),
    existing: async () => { throw new Error("razorpay down"); },
  });
  await assert.rejects(
    initiateRefund({ razorpayPaymentId: "pay_1", initiatedBy: "admin_1", db, razorpayClient: retry.client }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409 && /unknown outcome/.test(e.message),
  );
  assert.equal(retry.calls.refund, 0);
  assert.equal(state.intent?.state, "unknown", "still blocking");
  // Without a refund lookup at all (an older adapter), it also stays blocked.
  await assert.rejects(
    initiateRefund({
      razorpayPaymentId: "pay_1", initiatedBy: "admin_1", db,
      razorpayClient: { payments: { refund: async () => assert.fail("blocked") } },
    }),
    (e: unknown) => e instanceof PaymentLifecycleError && e.status === 409,
  );
  assert.equal(state.checkedOut, 0);
});

test("refund_intents DDL: state column in the migration and the runtime ensure", () => {
  const migration = readFileSync(new URL("../../src/db/migrations/20261022_payments_refund_intents.sql", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../../src/server/payments/payments-schema.ts", import.meta.url), "utf8");
  for (const src of [migration, runtime]) {
    assert.match(src, /state\s+TEXT NOT NULL DEFAULT 'sending' CHECK \(state IN \('sending', 'unknown'\)\)/);
    assert.match(src, /ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'sending'/);
    assert.match(src, /ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;/);
    assert.match(src, /ADD COLUMN IF NOT EXISTS abandoned_by TEXT;/);
  }
});
