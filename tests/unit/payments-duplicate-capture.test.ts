/**
 * Bug-fix P5 — double charge on institute offerings.
 *
 * Two clicks (or two tabs) used to mint two payable Razorpay orders for ONE
 * commerce enrolment order, and both could be captured. This pins the fix
 * against a small stateful fake of `payments.orders` / `payments.payments` /
 * `payments.outbox` (same module-interception seam as
 * tests/unit/payments-coupon-recommit.test.ts):
 *   1. A second checkout for the same enrolment order replays the open money
 *      order (same razorpayOrderId, Razorpay called once); a stale sibling is
 *      expired before a fresh order is minted, so at most one stays open.
 *   2. A second capture for the same enrolment order is kept `paid` (the
 *      refund path needs a captured ledger row) but linked `duplicate_of` the
 *      first, gets no enrolment and no receipt, and enqueues exactly one
 *      `duplicate_capture_refund` row + admin alerts — idempotent on replay.
 *   3. The outbox action refunds through `initiateRefund`, treats "nothing
 *      left to refund" as done, and parks any other failure.
 */

import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

// ── A stateful fake of the three payments tables ────────────────────────────

type Row = Record<string, unknown>;
type Result = { rows: Row[]; rowCount: number };

const state = {
  orders: [] as Row[],
  payments: new Map<string, Row>(),
  outbox: new Map<string, Row>(),
  queries: [] as { sql: string; params: unknown[] }[],
  clock: 0,
};

function resetState() {
  state.orders = [];
  state.payments = new Map();
  state.outbox = new Map();
  state.queries = [];
  state.clock = 0;
}

function tick(): string {
  state.clock += 1;
  return new Date(Date.UTC(2026, 9, 21, 10, 0, state.clock)).toISOString();
}

function out(rows: Row[]): Result {
  return { rows, rowCount: rows.length };
}

const notes = (row: Row) => row.notes as Record<string, unknown>;

function fakeQuery(sql: string, params: unknown[] = []): Promise<Result> {
  state.queries.push({ sql, params });
  return Promise.resolve(handle(sql.replace(/\s+/g, " ").trim(), params));
}

function handle(sql: string, p: unknown[]): Result {
  if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return out([]);
  if (sql.startsWith("SELECT pg_advisory_xact_lock")) return out([]);

  // ── payments.orders ──
  if (sql.startsWith("SELECT * FROM payments.orders WHERE user_id = $1 AND idempotency_key = $2")) {
    return out(state.orders.filter((o) => o.user_id === p[0] && o.idempotency_key === p[1]));
  }
  if (sql.startsWith("SELECT * FROM payments.orders WHERE user_id = $1 AND kind = 'institute_offering'") &&
      sql.includes("razorpay_order_id IS NULL")) {
    // findInFlightInstituteOrder — "now" is the fake clock.
    const cutoff = Date.UTC(2026, 9, 21, 10, 0, state.clock) - Number(p[2]) * 1000;
    const inFlight = state.orders
      .filter((o) =>
        o.user_id === p[0] && o.kind === "institute_offering" && notes(o).enrollment_order_id === p[1] &&
        o.status === "created" && o.razorpay_order_id == null &&
        new Date(String(o.created_at)).getTime() > cutoff)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return out(inFlight.slice(0, 1));
  }
  if (sql.startsWith("SELECT * FROM payments.orders WHERE user_id = $1 AND kind = 'institute_offering'")) {
    // findOpenInstituteOrder
    const now = Date.now();
    const open = state.orders
      .filter((o) =>
        o.user_id === p[0] && o.kind === "institute_offering" && notes(o).enrollment_order_id === p[1] &&
        (o.status === "created" || o.status === "attempted") && o.razorpay_order_id != null &&
        (o.expires_at == null || new Date(String(o.expires_at)).getTime() > now))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return out(open.slice(0, 1));
  }
  if (sql.startsWith("SELECT * FROM payments.orders WHERE id = $1")) {
    return out(state.orders.filter((o) => o.id === p[0]));
  }
  if (sql.startsWith("SELECT * FROM payments.orders WHERE razorpay_order_id = $1")) {
    return out(state.orders.filter((o) => o.razorpay_order_id === p[0]));
  }
  if (sql.startsWith("UPDATE payments.orders SET status = 'expired', failure_reason = COALESCE(failure_reason, 'superseded')")) {
    const hit = state.orders.filter((o) =>
      o.user_id === p[0] && o.kind === "institute_offering" && notes(o).enrollment_order_id === p[1] &&
      (o.status === "created" || o.status === "attempted"));
    for (const o of hit) {
      o.status = "expired";
      o.failure_reason = o.failure_reason ?? "superseded";
      o.idempotency_key = null;
    }
    return out([]);
  }
  if (sql.startsWith("INSERT INTO payments.orders")) {
    const row: Row = {
      id: p[0], user_id: p[1], kind: p[2], subject: p[3], bundle_id: p[4], workspace_id: p[5],
      offering_id: p[6], term_months: p[7], base_amount_minor: p[8], discount_minor: p[9],
      amount_minor: p[10], currency: p[11], coupon_code: p[12], status: "created", livemode: p[13],
      idempotency_key: p[14], notes: JSON.parse(String(p[15])), expires_at: p[16],
      razorpay_order_id: null, failure_reason: null, paid_at: null,
      created_at: tick(), updated_at: tick(),
    };
    if (row.expires_at instanceof Date) row.expires_at = row.expires_at.toISOString();
    state.orders.push(row);
    return out([row]);
  }
  if (sql.startsWith("UPDATE payments.orders SET razorpay_order_id = $2, status = 'attempted'")) {
    const o = state.orders.find((x) => x.id === p[0] && x.status === "created");
    if (!o) return out([]);
    o.razorpay_order_id = p[1];
    o.status = "attempted";
    return out([o]);
  }
  if (sql.startsWith("UPDATE payments.orders SET status = $2::payments.order_status")) {
    const o = state.orders.find((x) => x.id === p[0]);
    if (!o) return out([]);
    const from = String(o.status);
    const to = String(p[1]);
    const terminal = ["paid", "refunded", "partially_refunded"];
    if (terminal.includes(from) && !(from === "paid" && terminal.includes(to)) &&
        !(from !== "paid" && ["refunded", "partially_refunded"].includes(to))) return out([]);
    o.status = to;
    if (p[2] != null) o.failure_reason = p[2];
    if (to === "paid") o.paid_at = o.paid_at ?? (p[4] instanceof Date ? p[4].toISOString() : p[4]);
    return out([o]);
  }
  if (sql.startsWith("SELECT id FROM payments.orders WHERE id <> $1 AND user_id = $2 AND kind = 'institute_offering'")) {
    const dup = state.orders
      .filter((o) =>
        o.id !== p[0] && o.user_id === p[1] && o.kind === "institute_offering" &&
        notes(o).enrollment_order_id === p[2] && (o.status === "paid" || o.status === "partially_refunded"))
      .sort((a, b) => String(a.paid_at).localeCompare(String(b.paid_at)));
    return out(dup.slice(0, 1).map((o) => ({ id: o.id })));
  }
  if (sql.includes("jsonb_build_object('duplicate_of', $2::text)")) {
    const o = state.orders.find((x) => x.id === p[0]);
    if (o) o.notes = { ...notes(o), duplicate_of: p[1] };
    return out([]);
  }

  // ── payments.payments ──
  if (sql.startsWith("SELECT pg_advisory_xact_lock(hashtext(user_id)) FROM payments.payments")) return out([]);
  if (sql.startsWith("SELECT * FROM payments.payments WHERE razorpay_payment_id = $1")) {
    const row = state.payments.get(String(p[0]));
    return out(row ? [row] : []);
  }
  if (sql.startsWith("SELECT razorpay_payment_id FROM payments.payments WHERE order_id = $1")) {
    return out([...state.payments.values()].filter((x) => x.order_id === p[0] && x.status === "captured"));
  }
  if (sql.startsWith("INSERT INTO payments.payments")) {
    const row: Row = {
      razorpay_payment_id: p[0], order_id: p[1], user_id: p[4], amount_minor: p[5],
      amount_refunded_minor: 0, currency: "INR", method: p[7], status: "captured", livemode: false,
      captured_at: p[12], raw: {}, created_at: tick(),
    };
    state.payments.set(String(p[0]), row);
    return out([row]);
  }

  // ── payments.outbox ──
  if (sql.startsWith("INSERT INTO payments.outbox")) {
    if (!state.outbox.has(String(p[0]))) {
      state.outbox.set(String(p[0]), { id: p[0], kind: p[1], payload: JSON.parse(String(p[2])) });
    }
    return out([]);
  }

  if (sql.includes("FROM origin_users WHERE role = 'admin'")) return out([{ id: "admin_1" }]);
  if (sql.includes("SELECT email, name FROM origin_users")) return out([{ email: "s@example.test", name: "S" }]);
  return out([]);
}

const fakePool = {
  query: fakeQuery,
  connect: () => Promise.resolve({ query: fakeQuery, release: () => undefined }),
};

// ── Module interception ─────────────────────────────────────────────────────

const enrollmentOrder = { id: "eo_1", status: "pending" as string };
const metrics: string[] = [];

const ORIGINAL_LOAD = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patched(
  ...args: unknown[]
) {
  const request = args[0] as string;
  if (request === "server-only") return {};
  if (request === "@/server/user-postgres" || request.endsWith("/user-postgres")) {
    return {
      getUserPostgresPool: () => fakePool,
      getUserPostgresReplicaPool: () => fakePool,
      isUserPostgresConfigured: () => true,
    };
  }
  if (request === "@/lib/metrics") return { metric: (name: string) => metrics.push(name) };
  if (request === "@/server/entitlements") return { recomputeUserPremiumFlags: async () => undefined };
  if (request === "./institute-orders") {
    return {
      resolveInstituteOffering: async (input: { workspaceId: string; offeringId: string }) => ({
        ...input,
        title: "JEE crash course",
        amountMinor: 150000,
        currency: "INR",
        offering: {},
      }),
      openInstituteEnrollmentOrder: async () => ({ ...enrollmentOrder }),
      applyInstituteEnrollment: async () => undefined,
    };
  }
  return ORIGINAL_LOAD.apply(this, args);
};

globalThis.__originPaymentsSchemaEnsured = true;
globalThis.__originPricingSchemaEnsured = true;
globalThis.__originSubjectGrantsSchemaEnsured = true;
globalThis.__originUserSchemaEnsured = true;
globalThis.__originNowSchemaEnsured = true;

/* eslint-disable @typescript-eslint/no-require-imports */
const orders = require("@/server/payments/orders-service") as typeof import("@/server/payments/orders-service");
const outbox = require("@/server/payments/outbox") as typeof import("@/server/payments/outbox");
const { INSTITUTE_CHECKOUT_IN_FLIGHT_SECONDS } = require("@/server/payments/payments-store") as typeof import("@/server/payments/payments-store");
/* eslint-enable @typescript-eslint/no-require-imports */

const { createCheckoutOrder, applyPaymentSuccess } = orders;
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const refunds = require("@/server/payments/refunds-service") as typeof import("@/server/payments/refunds-service");

// ── Helpers ─────────────────────────────────────────────────────────────────

let razorpayCreates = 0;
const razorpayClient = {
  orders: {
    create: async () => {
      razorpayCreates += 1;
      return { id: `order_rzp_${razorpayCreates}` };
    },
  },
};

function checkout(idempotencyKey: string) {
  return createCheckoutOrder({
    userId: "user_1",
    kind: "institute_offering",
    subject: "",
    termMonths: 1,
    workspaceId: "ws_1",
    offeringId: "off_1",
    idempotencyKey,
    razorpayClient: razorpayClient as never,
    keyId: "rzp_test_key",
  });
}

function capture(orderId: string, razorpayPaymentId: string) {
  return applyPaymentSuccess({ orderId, razorpayPaymentId, amountMinor: 150000, currency: "INR" });
}

function outboxKinds(): string[] {
  return [...state.outbox.values()].map((row) => String(row.kind));
}

function setup() {
  resetState();
  metrics.length = 0;
  razorpayCreates = 0;
  enrollmentOrder.status = "pending";
}

// ── 1. Checkout reuses the open order ───────────────────────────────────────

test("a second checkout (different idempotency key) replays the open order for the same enrolment", async () => {
  setup();
  const first = await checkout("idem_tab_1");
  const second = await checkout("idem_tab_2");

  assert.equal(razorpayCreates, 1, "Razorpay is asked for ONE order, not two");
  assert.equal(second.orderId, first.orderId);
  assert.equal(second.razorpayOrderId, first.razorpayOrderId);
  assert.equal(second.razorpayOrderId, "order_rzp_1");
  assert.equal(second.keyId, "rzp_test_key", "the second sheet can open on the same Razorpay order");
  assert.equal(second.paidWithoutGateway, false);
  assert.equal(state.orders.length, 1);
  // The lookup ran under the user's advisory lock, inside one transaction.
  const sqls = state.queries.map((q) => q.sql.replace(/\s+/g, " ").trim());
  const lastBegin = sqls.lastIndexOf("BEGIN");
  assert.match(sqls[lastBegin + 1], /^SELECT pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
  assert.ok(sqls.slice(lastBegin).some((s) => s.includes("notes->>'enrollment_order_id' = $2") && s.includes("FOR UPDATE")));
});

test("a stale sibling is expired before a fresh order is minted, so one open order remains", async () => {
  setup();
  const first = await checkout("idem_a");
  // The first Razorpay order's local TTL lapsed.
  state.orders[0].expires_at = "2020-01-01T00:00:00.000Z";

  const second = await checkout("idem_b");
  assert.notEqual(second.orderId, first.orderId);
  assert.equal(second.razorpayOrderId, "order_rzp_2");
  const firstRow = state.orders.find((o) => o.id === first.orderId) as Row;
  assert.equal(firstRow.status, "expired");
  assert.equal(firstRow.failure_reason, "superseded");
  assert.equal(firstRow.idempotency_key, null);
  const open = state.orders.filter((o) => o.status === "created" || o.status === "attempted");
  assert.deepEqual(open.map((o) => o.id), [second.orderId]);
  assert.equal(notes(open[0]).enrollment_order_id, "eo_1");
});

test("an already-paid enrolment order is a 409 and opens no money order", async () => {
  setup();
  enrollmentOrder.status = "paid";
  await assert.rejects(checkout("idem_paid"), (error: Error & { status?: number }) => {
    assert.equal(error.status, 409);
    return true;
  });
  assert.equal(state.orders.length, 0);
  assert.equal(razorpayCreates, 0);
  assert.ok(state.queries.some((q) => q.sql === "ROLLBACK"));
});

// ── 2. A second capture is flagged and refunded, never enrolled twice ───────

async function twoPayableOrders(): Promise<{ a: string; b: string }> {
  // Two money orders for one enrolment order — the pre-fix state (or a stale
  // first order the student still had open in another tab).
  const a = await checkout("idem_a");
  state.orders[0].expires_at = "2020-01-01T00:00:00.000Z";
  const b = await checkout("idem_b");
  return { a: a.orderId, b: b.orderId };
}

test("capture A then capture B: B is paid but duplicate_of A, no second enrolment, one refund queued", async () => {
  setup();
  const { a, b } = await twoPayableOrders();

  const first = await capture(a, "pay_A");
  assert.equal(first.order.status, "paid");
  assert.equal(first.order.notes.duplicate_of, undefined);

  const second = await capture(b, "pay_B");
  assert.equal(second.alreadyApplied, false);
  assert.equal(second.order.status, "paid", "kept paid: the refund path needs a captured ledger row");
  assert.equal(second.order.notes.duplicate_of, a);
  assert.equal(second.order.amountMinor, 150000, "money that landed is never rewritten");

  // Exactly one enrolment and one receipt (both for A); one refund for B.
  const kinds = outboxKinds();
  assert.equal(kinds.filter((k) => k === "institute_enrollment").length, 1);
  assert.ok(state.outbox.has("institute_enrollment_pay_A"));
  assert.ok(!state.outbox.has("institute_enrollment_pay_B"));
  assert.equal(kinds.filter((k) => k === "receipt_email").length, 1);
  assert.ok(!state.outbox.has("payment_receipt_pay_B"));
  const refunds = [...state.outbox.values()].filter((row) => row.kind === "duplicate_capture_refund");
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].id, "duplicate_capture_refund_pay_B");
  assert.deepEqual(refunds[0].payload, {
    userId: "user_1",
    orderId: b,
    razorpayPaymentId: "pay_B",
    amountMinor: 150000,
    reason: "duplicate_institute_capture",
  });
  const alert = state.outbox.get("duplicate_capture_pay_B_admin_1") as Row;
  assert.equal(alert.kind, "notification");
  assert.equal((alert.payload as Row).notificationTitle, "Duplicate institute payment");
  assert.match(String((alert.payload as Row).notificationMessage), /pay_B paid .* twice for enrolment eo_1; auto-refund queued/);
  assert.deepEqual(metrics, ["origin.payments.duplicate_capture"]);
  // Both captures are on the ledger; nothing was deleted or reversed in place.
  assert.equal(state.payments.get("pay_A")?.status, "captured");
  assert.equal(state.payments.get("pay_B")?.status, "captured");
});

test("replaying the duplicate capture (webhook + verify) enqueues the refund once", async () => {
  setup();
  const { a, b } = await twoPayableOrders();
  await capture(a, "pay_A");
  await capture(b, "pay_B");
  const before = state.outbox.size;

  const replay = await capture(b, "pay_B");
  assert.equal(replay.alreadyApplied, true);
  assert.equal(state.outbox.size, before);
  assert.equal(outboxKinds().filter((k) => k === "duplicate_capture_refund").length, 1);
  assert.equal(outboxKinds().filter((k) => k === "institute_enrollment").length, 1);
});

test("a single capture still enrols and receipts as before", async () => {
  setup();
  const only = await checkout("idem_only");
  const result = await capture(only.orderId, "pay_only");
  assert.equal(result.order.status, "paid");
  assert.equal(result.order.notes.duplicate_of, undefined);
  assert.deepEqual(outboxKinds().sort(), ["institute_enrollment", "receipt_email"]);
  assert.deepEqual(metrics, []);
});

// ── 3. The outbox action refunds exactly that payment ───────────────────────

function refundRow(payload: Record<string, unknown> = {}) {
  return {
    id: "duplicate_capture_refund_pay_B",
    kind: "duplicate_capture_refund",
    payload: { userId: "user_1", orderId: "ord_B", razorpayPaymentId: "pay_B", amountMinor: 150000, reason: "duplicate_institute_capture", ...payload },
    status: "processing",
    attempts: 1,
    error: null,
    dispatchedVia: null,
    createdAt: "2026-10-21T10:00:00.000Z",
    nextAttemptAt: "2026-10-21T10:00:00.000Z",
    doneAt: null,
  } as Parameters<typeof outbox.dispatchOutboxRow>[0];
}

const capturedLedger = async () => ({ status: "captured", amountMinor: 150000, amountRefundedMinor: 0 });

test("duplicate_capture_refund dispatches to initiateRefund with the payment id and sends no message", async () => {
  const calls: unknown[] = [];
  let mailed = 0;
  let notified = 0;
  await outbox.dispatchOutboxRow(refundRow(), {
    getPaymentById: capturedLedger,
    initiateRefund: async (input) => {
      calls.push(input);
      return {};
    },
    sendEmail: async () => {
      mailed += 1;
      return { success: true, messageId: "x" };
    },
    createNotification: async () => {
      notified += 1;
    },
  });
  assert.deepEqual(calls, [{
    razorpayPaymentId: "pay_B",
    amountMinor: 150000,
    reason: "duplicate_institute_capture",
    initiatedBy: "system:duplicate",
  }]);
  assert.equal(mailed, 0);
  assert.equal(notified, 0);
});

test("duplicate_capture_refund treats an already-refunded payment as done", async () => {
  let called = 0;
  // Ledger already shows the refund (an admin got there first): no gateway call.
  await outbox.dispatchOutboxRow(refundRow(), {
    getPaymentById: async () => ({ status: "refunded", amountMinor: 150000, amountRefundedMinor: 150000 }),
    initiateRefund: async () => {
      called += 1;
      return {};
    },
  });
  assert.equal(called, 0);

  // A refund that raced in between: the 409 from validateRefundRequest is success.
  const conflict = Object.assign(new Error("This payment has no refundable amount remaining."), { status: 409 });
  await outbox.dispatchOutboxRow(refundRow(), {
    getPaymentById: capturedLedger,
    initiateRefund: async () => {
      throw conflict;
    },
  });
});

test("duplicate_capture_refund parks (rethrows) any other failure instead of swallowing it", async () => {
  const windowGone = Object.assign(new Error("The 7-day refund window has expired."), { status: 409 });
  await assert.rejects(
    outbox.dispatchOutboxRow(refundRow(), {
      getPaymentById: capturedLedger,
      initiateRefund: async () => {
        throw windowGone;
      },
    }),
    /refund window has expired/,
  );
  await assert.rejects(
    outbox.dispatchOutboxRow(refundRow({ razorpayPaymentId: undefined }), {
      getPaymentById: capturedLedger,
      initiateRefund: async () => ({}),
    }),
    /missing its payment id/,
  );
});

test("a refund intent still in flight defers the row without spending an attempt", async () => {
  const inFlight = Object.assign(
    new Error("A refund for this payment is already being sent to Razorpay. Check the refunds list in a minute before retrying."),
    { status: 409 },
  );
  await assert.rejects(
    outbox.dispatchOutboxRow(refundRow(), {
      getPaymentById: capturedLedger,
      initiateRefund: async () => {
        throw inFlight;
      },
    }),
    (error: unknown) => error instanceof outbox.OutboxRetryLaterError && error.retryInSeconds === outbox.REFUND_INTENT_RETRY_SECONDS,
  );

  for (const message of [
    "An earlier refund attempt for this payment has an unknown outcome and could not be checked yet. Try again in a minute.",
    "The outcome of an earlier refund attempt for this payment is still being confirmed with Razorpay. Try again later.",
  ]) {
    const deferred: unknown[][] = [];
    const failed: unknown[][] = [];
    const fresh = refundRow({}) as ReturnType<typeof refundRow>;
    fresh.createdAt = new Date(Date.now() - 60_000).toISOString();
    fresh.attempts = 6; // even on the last attempt it must not park
    const result = await outbox.drainOutbox(1, {
      claimDueOutboxRows: async () => [fresh],
      getPaymentById: capturedLedger,
      initiateRefund: async () => {
        throw Object.assign(new Error(message), { status: 409 });
      },
      deferOutboxRow: async (...args) => {
        deferred.push(args);
      },
      markOutboxFailed: async (...args) => {
        failed.push(args);
      },
      markOutboxDone: async () => {},
    });
    assert.equal(result.failed, 1);
    assert.equal(failed.length, 0, message);
    assert.deepEqual(deferred, [[fresh.id, message, outbox.REFUND_INTENT_RETRY_SECONDS]]);
  }
});

test("a row that has deferred for a day fails normally (bounded), and other 409s still fail", async () => {
  const old = refundRow({}) as ReturnType<typeof refundRow>;
  old.createdAt = new Date(Date.now() - outbox.OUTBOX_DEFER_MAX_AGE_MS - 1_000).toISOString();
  const failed: unknown[][] = [];
  const deferred: unknown[][] = [];
  const deps = {
    claimOutboxRow: async () => old,
    getPaymentById: capturedLedger,
    deferOutboxRow: async (...args: unknown[]) => {
      deferred.push(args);
    },
    markOutboxFailed: async (...args: unknown[]) => {
      failed.push(args);
    },
    markOutboxDone: async () => {},
  };
  await assert.rejects(
    outbox.dispatchOutbox(old.id, "cron", {
      ...deps,
      initiateRefund: async () => {
        throw Object.assign(new Error("A refund for this payment is already being sent to Razorpay."), { status: 409 });
      },
    }),
    /already being sent/,
  );
  assert.equal(deferred.length, 0);
  assert.equal(failed.length, 1);

  const fresh = refundRow({}) as ReturnType<typeof refundRow>;
  fresh.createdAt = new Date().toISOString();
  await assert.rejects(
    outbox.dispatchOutbox(fresh.id, "cron", {
      ...deps,
      claimOutboxRow: async () => fresh,
      initiateRefund: async () => {
        throw Object.assign(new Error("The 7-day refund window has expired."), { status: 409 });
      },
    }),
    /refund window has expired/,
  );
  assert.equal(deferred.length, 0);
  assert.equal(failed.length, 2);
});

// ── 4. F5: one lock order, and no superseded in-flight checkout ─────────────

const flat = (sql: string) => sql.replace(/\s+/g, " ").trim();
const isUserLock = (sql: string) => flat(sql).startsWith("SELECT pg_advisory_xact_lock(hashtext(");

function indexOfQuery(from: number, match: (sql: string) => boolean): number {
  const at = state.queries.slice(from).findIndex((q) => match(flat(q.sql)));
  return at < 0 ? -1 : from + at;
}

test("applyPaymentSuccess takes the user lock BEFORE the order row lock (same order as checkout)", async () => {
  setup();
  const only = await checkout("idem_lock");
  const from = state.queries.length;
  await capture(only.orderId, "pay_lock");

  const begin = indexOfQuery(from, (s) => s === "BEGIN");
  const lock = indexOfQuery(begin, isUserLock);
  const orderRow = indexOfQuery(begin, (s) => s.startsWith("SELECT * FROM payments.orders WHERE id = $1 FOR UPDATE"));
  const paymentRow = indexOfQuery(begin, (s) => s.startsWith("SELECT * FROM payments.payments WHERE razorpay_payment_id = $1 FOR UPDATE"));
  assert.ok(begin >= 0 && lock > begin, "the user lock is taken inside the capture transaction");
  assert.ok(orderRow > lock, "order row lock comes after the user lock");
  assert.ok(paymentRow > orderRow, "payment row lock comes after the order row lock");
  assert.equal(state.queries[lock].params?.[0], "user_1");
});

test("a refund takes the payment owner's user lock BEFORE the payment row lock", async () => {
  setup();
  const only = await checkout("idem_refund_lock");
  await capture(only.orderId, "pay_refund_lock");
  const from = state.queries.length;
  // Only the lock order is asserted; the fake does not model payments.refunds.
  await refunds
    .applyRefundLifecycle({ razorpayRefundId: "rfnd_1", razorpayPaymentId: "pay_refund_lock", amountMinor: 150000 })
    .catch(() => undefined);
  const lock = indexOfQuery(from, isUserLock);
  const paymentRow = indexOfQuery(from, (s) => s.startsWith("SELECT * FROM payments.payments WHERE razorpay_payment_id = $1 FOR UPDATE"));
  assert.ok(lock >= 0 && paymentRow > lock);
  assert.match(flat(state.queries[lock].sql), /hashtext\(user_id\)/);
  assert.equal(state.queries[lock].params?.[0], "pay_refund_lock");
});

/** A Razorpay client whose next create blocks until the test releases it. */
function gatedRazorpay() {
  let creates = 0;
  let release: (outcome: "ok" | "fail") => void = () => undefined;
  let entered: () => void = () => undefined;
  const inside = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<"ok" | "fail">((resolve) => {
    release = resolve;
  });
  const client = {
    orders: {
      create: async () => {
        creates += 1;
        const n = creates;
        if (n === 1) {
          entered();
          if ((await gate) === "fail") throw new Error("Razorpay timed out");
        }
        return { id: `order_rzp_gated_${n}` };
      },
    },
  };
  return { client, inside, release: (outcome: "ok" | "fail") => release(outcome), creates: () => creates };
}

function gatedCheckout(client: unknown, idempotencyKey: string, inFlightWaitMs?: number) {
  return createCheckoutOrder({
    userId: "user_1",
    kind: "institute_offering",
    subject: "",
    termMonths: 1,
    workspaceId: "ws_1",
    offeringId: "off_1",
    idempotencyKey,
    razorpayClient: client as never,
    keyId: "rzp_test_key",
    inFlightWaitMs,
  });
}

test("a second click while the first is creating its Razorpay order waits and replays it", async () => {
  setup();
  const rzp = gatedRazorpay();
  const first = gatedCheckout(rzp.client, "idem_click_1");
  await rzp.inside; // first row inserted, Razorpay create in flight
  const second = gatedCheckout(rzp.client, "idem_click_2", 5_000);
  setTimeout(() => rzp.release("ok"), 50);

  const [a, b] = await Promise.all([first, second]);
  assert.equal(rzp.creates(), 1, "no second Razorpay order is minted");
  assert.equal(b.orderId, a.orderId);
  assert.equal(b.razorpayOrderId, "order_rzp_gated_1");
  assert.equal(b.keyId, "rzp_test_key");
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].status, "attempted", "the first order was attached, not superseded");
});

test("if the first checkout is still in flight after the wait, the second gets 409 and supersedes nothing", async () => {
  setup();
  const rzp = gatedRazorpay();
  const first = gatedCheckout(rzp.client, "idem_slow_1");
  await rzp.inside;
  await assert.rejects(gatedCheckout(rzp.client, "idem_slow_2", 20), (error: Error & { status?: number }) => {
    assert.equal(error.status, 409);
    assert.match(error.message, /already in progress/);
    return true;
  });
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].status, "created", "the in-flight order was not expired");

  rzp.release("ok");
  const a = await first;
  assert.equal(a.razorpayOrderId, "order_rzp_gated_1", "the first request still attaches its order");
  assert.equal(state.orders[0].status, "attempted");
  assert.equal(rzp.creates(), 1);
});

test("if the in-flight checkout fails, the waiting one mints its own order", async () => {
  setup();
  const rzp = gatedRazorpay();
  const first = gatedCheckout(rzp.client, "idem_fail_1");
  await rzp.inside;
  const second = gatedCheckout(rzp.client, "idem_fail_2", 5_000);
  setTimeout(() => rzp.release("fail"), 50);

  await assert.rejects(first, /Razorpay timed out/);
  const b = await second;
  assert.equal(rzp.creates(), 2);
  assert.equal(b.razorpayOrderId, "order_rzp_gated_2");
  const firstRow = state.orders.find((o) => o.id !== b.orderId) as Row;
  assert.equal(firstRow.status, "failed");
  const open = state.orders.filter((o) => o.status === "created" || o.status === "attempted");
  assert.deepEqual(open.map((o) => o.id), [b.orderId]);
});

test("a waiter whose sibling is still unattached once past the in-flight window takes over", async () => {
  setup();
  const rzp = gatedRazorpay();
  void gatedCheckout(rzp.client, "idem_late_1").catch(() => undefined);
  await rzp.inside;
  // The first request dies while the second waits: by the end of the wait its
  // row is older than INSTITUTE_CHECKOUT_IN_FLIGHT_SECONDS.
  setTimeout(() => {
    state.orders[0].created_at = "2026-10-21T09:00:00.000Z";
  }, 20);

  const b = await gatedCheckout(rzp.client, "idem_late_2", 100);
  assert.equal(b.razorpayOrderId, "order_rzp_gated_2");
  assert.equal(state.orders[0].status, "expired");
  assert.equal(state.orders[0].failure_reason, "superseded");
  const open = state.orders.filter((o) => o.status === "created" || o.status === "attempted");
  assert.deepEqual(open.map((o) => o.id), [b.orderId]);
  rzp.release("fail");
});

test("the in-flight window is under a minute", () => {
  assert.ok(INSTITUTE_CHECKOUT_IN_FLIGHT_SECONDS <= 60);
});

test("a dead request's row (no Razorpay id, older than the in-flight window) is still superseded", async () => {
  setup();
  const rzp = gatedRazorpay();
  void gatedCheckout(rzp.client, "idem_dead_1").catch(() => undefined);
  await rzp.inside;
  state.orders[0].created_at = "2026-10-21T09:00:00.000Z"; // an hour before the fake clock

  const b = await gatedCheckout(rzp.client, "idem_dead_2", 5_000);
  assert.equal(b.razorpayOrderId, "order_rzp_gated_2");
  assert.equal(state.orders[0].status, "expired");
  assert.equal(state.orders[0].failure_reason, "superseded");
  rzp.release("fail"); // let the dead request's promise settle
});

// ── 5. D6: a failed institute payment links back to that offering's checkout ─

test("failed-payment emails send institute buyers to the offering checkout, not /premium", () => {
  assert.equal(
    orders.failedPaymentRetryHref({ kind: "institute_offering", workspaceId: "ws_1", offeringId: "off_1" }),
    "/connect/checkout/off_1?workspaceId=ws_1",
  );
  assert.equal(orders.failedPaymentRetryHref({ kind: "institute_offering", workspaceId: null, offeringId: null }), "/connect");
  assert.equal(orders.failedPaymentRetryHref({ kind: "subject_term", workspaceId: null, offeringId: null }), "/premium");
});
