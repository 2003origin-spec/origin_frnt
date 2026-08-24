/**
 * Phase 8 pure-logic tests: reporting windows on IST day boundaries, the
 * derived rates, revenue bucketing, and CSV serialisation.
 *
 * These need no database — everything asserted here is the part of the
 * dashboard that decides what a number *means*, and it must hold before any
 * SQL runs.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  istDateKey,
  istDayStartMs,
  istDayStartMsFromKey,
  istEpochDay,
} from "@/lib/ist-day";
import {
  conversionRate,
  DEFAULT_RANGE_DAYS,
  fillDaySeries,
  foldSlices,
  istDaysInRange,
  MAX_RANGE_DAYS,
  reattributeSubscriptionSlices,
  refundRate,
  resolveRange,
  revenueBucket,
} from "@/server/payments/financials";
import {
  clampLimit,
  csvCell,
  LEDGER_CSV_COLUMNS,
  LEDGER_KINDS,
  LEDGER_MAX_LIMIT,
  LEDGER_PAGE_LIMIT,
  LEDGER_STATUSES,
  ledgerToCsv,
  pickEnum,
  type LedgerRow,
} from "@/server/payments/ledger-query";
import { assessPaymentsHealth } from "@/server/payments/health-report";
import type { RazorpayConfigStatus } from "@/server/payments/razorpay-client";

test("an IST day starts at 18:30 UTC the previous day, and round-trips", () => {
  assert.equal(istDayStartMsFromKey("2026-08-23"), Date.parse("2026-08-22T18:30:00.000Z"));
  assert.equal(istDateKey(istDayStartMsFromKey("2026-08-23")), "2026-08-23");
  // The last instant of the IST day is still that day; one millisecond later is not.
  assert.equal(istDateKey(istDayStartMsFromKey("2026-08-23") + 86_400_000 - 1), "2026-08-23");
  assert.equal(istDateKey(istDayStartMsFromKey("2026-08-23") + 86_400_000), "2026-08-24");
  assert.equal(istDayStartMs(istEpochDay(Date.parse("2026-08-23T12:00:00Z"))), Date.parse("2026-08-22T18:30:00.000Z"));

  for (const bad of ["2026-02-31", "2026-13-01", "not-a-day", "20260823", "2026-8-23"]) {
    assert.throws(() => istDayStartMsFromKey(bad), /Not an IST date key/, bad);
  }
});

test("22:00 UTC belongs to the NEXT IST day — the 5½-hour bug this replaces", () => {
  const lateUtc = Date.parse("2026-08-23T22:00:00.000Z");
  assert.equal(new Date(lateUtc).toISOString().slice(0, 10), "2026-08-23");
  assert.equal(istDateKey(lateUtc), "2026-08-24");
  const range = resolveRange({ days: 1, now: lateUtc });
  assert.equal(range.fromDay, "2026-08-24");
  assert.equal(range.toDay, "2026-08-24");
  // A charge at 22:00 UTC must fall inside the window it is reported in.
  assert.ok(Date.parse(range.fromIso) <= lateUtc && lateUtc < Date.parse(range.toIso));
});

test("resolveRange is a half-open interval of whole IST days", () => {
  const range = resolveRange({ days: 7, now: Date.parse("2026-08-23T06:00:00Z") });
  assert.equal(range.fromDay, "2026-08-17");
  assert.equal(range.toDay, "2026-08-23");
  assert.equal(range.days, 7);
  assert.equal(range.fromIso, "2026-08-16T18:30:00.000Z");
  assert.equal(range.toIso, "2026-08-23T18:30:00.000Z");
  assert.equal(
    Date.parse(range.toIso) - Date.parse(range.fromIso),
    7 * 86_400_000,
    "seven whole IST days, no gap and no overlap",
  );

  const explicit = resolveRange({ from: "2026-01-01", to: "2026-01-31" });
  assert.equal(explicit.days, 31);
  assert.equal(explicit.fromIso, "2025-12-31T18:30:00.000Z");
  assert.equal(explicit.toIso, "2026-01-31T18:30:00.000Z");

  const single = resolveRange({ from: "2026-03-05", to: "2026-03-05" });
  assert.equal(single.days, 1);

  assert.equal(resolveRange({ now: Date.parse("2026-08-23T06:00:00Z") }).days, DEFAULT_RANGE_DAYS);
  assert.equal(resolveRange({ days: 0, now: Date.parse("2026-08-23T06:00:00Z") }).days, DEFAULT_RANGE_DAYS);
  assert.equal(resolveRange({ days: 5000, now: Date.parse("2026-08-23T06:00:00Z") }).days, MAX_RANGE_DAYS);
  assert.throws(() => resolveRange({ from: "2026-03-05", to: "2026-03-04" }), /must not be after/);
  assert.throws(() => resolveRange({ from: "2020-01-01", to: "2026-01-01" }), /at most/);
});

test("resolveRange spans a DST-free month boundary without losing a day", () => {
  const feb = resolveRange({ from: "2028-02-01", to: "2028-02-29" });
  assert.equal(feb.days, 29, "2028 is a leap year");
  assert.equal(istDaysInRange(feb).length, 29);
  assert.equal(istDaysInRange(feb).at(-1), "2028-02-29");
});

test("fillDaySeries pads every silent day and never invents revenue", () => {
  const range = resolveRange({ from: "2026-08-20", to: "2026-08-23" });
  const series = fillDaySeries(
    range,
    new Map([["2026-08-21", { grossMinor: 99_800, payments: 2 }]]),
    new Map([["2026-08-23", { refundedMinor: 49_900, refunds: 1 }]]),
  );
  assert.deepEqual(series.map((point) => point.date), [
    "2026-08-20",
    "2026-08-21",
    "2026-08-22",
    "2026-08-23",
  ]);
  assert.deepEqual(series[0], { date: "2026-08-20", grossMinor: 0, refundedMinor: 0, netMinor: 0, payments: 0, refunds: 0 });
  assert.equal(series[1].netMinor, 99_800);
  // A refund on a day with no charge makes that day negative — that is the
  // honest reading, not a floor at zero.
  assert.equal(series[3].netMinor, -49_900);
});

test("refund and conversion rates are bounded, rounded, and safe at zero", () => {
  assert.equal(refundRate(0, 0), 0);
  assert.equal(refundRate(0, 5000), 0, "no gross ⇒ no rate, never Infinity");
  assert.equal(refundRate(100_000, 10_000), 0.1);
  assert.equal(refundRate(30_000, 10_000), 0.3333);
  assert.equal(refundRate(10_000, 40_000), 1, "older charges refunded in-window clamp at 100%");
  assert.equal(conversionRate(0, 0), 0);
  assert.equal(conversionRate(3, 1), 0.3333);
  assert.equal(conversionRate(3, 9), 1);
});

test("revenueBucket keeps a bundle whole instead of inventing per-subject prices", () => {
  assert.deepEqual(revenueBucket({ kind: "subject_term", subject: "physics" }), { key: "physics", label: "Physics" });
  assert.deepEqual(revenueBucket({ kind: "bundle_term", subject: null }), { key: "bundle", label: "All-subjects bundle" });
  assert.deepEqual(revenueBucket({ kind: "institute_offering", subject: null }), { key: "institute", label: "Institute / batch" });
  assert.deepEqual(revenueBucket({ kind: "batch_subscription", subject: null }), { key: "institute", label: "Institute / batch" });
  assert.deepEqual(
    revenueBucket({ kind: "subject_subscription", subject: null, subscriptionSubject: "biology" }),
    { key: "biology", label: "Biology" },
  );
  assert.deepEqual(revenueBucket({ kind: null, subject: null }), { key: "unattributed", label: "Unattributed" });
  assert.deepEqual(revenueBucket({ kind: "subject_term", subject: "  PHYSICS " }), { key: "physics", label: "Physics" });
});

test("foldSlices merges duplicate buckets and orders by gross", () => {
  const folded = foldSlices([
    { key: "physics", label: "Physics", grossMinor: 1000, payments: 1 },
    { key: "biology", label: "Biology", grossMinor: 5000, payments: 2 },
    { key: "physics", label: "Physics", grossMinor: 4000, payments: 3 },
  ]);
  // Equal gross ties break alphabetically so the chart order is stable between
  // reloads rather than following whatever order Postgres returned the groups in.
  assert.deepEqual(folded, [
    { key: "biology", label: "Biology", grossMinor: 5000, payments: 2 },
    { key: "physics", label: "Physics", grossMinor: 5000, payments: 4 },
  ]);
  assert.deepEqual(foldSlices([]), []);
});

test("mandate re-attribution never double-counts and never loses an orphan", () => {
  const orderSlices = [
    { key: "physics", label: "Physics", grossMinor: 100_000, payments: 2 },
    { key: "unattributed", label: "Unattributed", grossMinor: 90_000, payments: 3 },
  ];

  // With no mandate rows, `unattributed` is genuinely orphaned money and stays.
  assert.deepEqual(reattributeSubscriptionSlices(orderSlices, []), [
    { key: "physics", label: "Physics", grossMinor: 100_000, payments: 2 },
    { key: "unattributed", label: "Unattributed", grossMinor: 90_000, payments: 3 },
  ]);

  // Two of the three orderless charges are mandate charges we can name. The
  // third is a real orphan and must survive with exactly its own money.
  const mixed = reattributeSubscriptionSlices(orderSlices, [
    { key: "biology", label: "Biology", grossMinor: 60_000, payments: 2 },
  ]);
  assert.equal(
    mixed.reduce((sum, slice) => sum + slice.grossMinor, 0),
    190_000,
    "the slices still sum to the same gross",
  );
  assert.deepEqual(mixed.find((slice) => slice.key === "unattributed"), {
    key: "unattributed",
    label: "Unattributed",
    grossMinor: 30_000,
    payments: 1,
  });
  assert.equal(mixed.find((slice) => slice.key === "biology")?.grossMinor, 60_000);

  // Every orderless charge is a mandate charge: the bucket disappears entirely.
  const fully = reattributeSubscriptionSlices(orderSlices, [
    { key: "biology", label: "Biology", grossMinor: 90_000, payments: 3 },
  ]);
  assert.equal(fully.find((slice) => slice.key === "unattributed"), undefined);
  assert.equal(fully.reduce((sum, slice) => sum + slice.grossMinor, 0), 190_000);
});

test("ledger filters accept only known enum values", () => {
  assert.deepEqual(pickEnum(["paid", "PAID", "nonsense", "'; DROP TABLE"], LEDGER_STATUSES), ["paid"]);
  assert.deepEqual(pickEnum(["subject_term", "bundle_term"], LEDGER_KINDS), ["subject_term", "bundle_term"]);
  assert.deepEqual(pickEnum([], LEDGER_STATUSES), []);
  assert.deepEqual(pickEnum(null, LEDGER_STATUSES), []);

  assert.equal(clampLimit(undefined), LEDGER_PAGE_LIMIT);
  assert.equal(clampLimit("25"), 25);
  assert.equal(clampLimit(-4), LEDGER_PAGE_LIMIT);
  assert.equal(clampLimit(10_000), LEDGER_MAX_LIMIT);
  assert.equal(clampLimit("abc"), LEDGER_PAGE_LIMIT);
});

test("CSV cells are quoted, escaped, and neutralised against formula injection", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell("plain"), '"plain"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("a,b\nc"), '"a,b\nc"');
  assert.equal(csvCell(true), '"true"');
  assert.equal(csvCell(4900), '"4900"');
  // A buyer-controlled name must never execute in a spreadsheet.
  for (const attack of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) {
    assert.equal(csvCell(attack), `"'${attack}"`, attack);
  }
});

test("ledgerToCsv emits an RFC-4180 sheet with one line per order", () => {
  const row: LedgerRow = {
    orderId: "ord_1",
    createdAt: "2026-08-23T05:00:00.000Z",
    paidAt: "2026-08-23T05:01:00.000Z",
    status: "paid",
    kind: "subject_term",
    subject: "physics",
    bundleId: null,
    workspaceId: null,
    offeringId: null,
    termMonths: 3,
    baseAmountMinor: 149_700,
    discountMinor: 14_970,
    amountMinor: 134_730,
    currency: "INR",
    couponCode: "SAVE10",
    razorpayOrderId: "order_abc",
    razorpayPaymentId: "pay_abc",
    method: "upi",
    capturedAt: "2026-08-23T05:01:00.000Z",
    amountRefundedMinor: 0,
    disputedAt: null,
    failureReason: null,
    livemode: false,
    userId: "user_1",
    userEmail: "student@example.com",
    userName: "=cmd|' /c calc'!A1",
  };
  const csv = ledgerToCsv([row]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], LEDGER_CSV_COLUMNS.map((column) => `"${column}"`).join(","));
  assert.equal(lines.length, 3, "header, one row, trailing newline");
  assert.equal(lines[2], "");
  assert.ok(lines[1].includes('"ord_1"'));
  assert.ok(lines[1].includes('"134730"'));
  assert.ok(lines[1].includes('"false"'));
  assert.ok(lines[1].endsWith(`"'${row.userName}"`), "the injected formula is defused");
  assert.equal(ledgerToCsv([]).split("\r\n").length, 2, "an empty export still carries its header");
});

function razorpayStatus(overrides: Partial<RazorpayConfigStatus> = {}): RazorpayConfigStatus {
  return {
    mode: "test",
    livemode: false,
    keyIdConfigured: true,
    keySecretConfigured: true,
    webhookSecretConfigured: true,
    modeMismatch: null,
    source: { KEY_ID: "scoped", KEY_SECRET: "scoped", WEBHOOK_SECRET: "scoped" },
    subscriptionsEnabled: false,
    ...overrides,
  };
}

const healthyBacklog = {
  pendingEvents: 0,
  failedEvents: 0,
  pendingOutbox: 0,
  failedOutbox: 0,
  stuckOrders: 0,
  lastWebhookAt: null,
  lastPaidAt: null,
};

test("health assessment names every problem and stays ok only when there are none", () => {
  const healthy = assessPaymentsHealth({
    featureEnabled: true,
    razorpay: razorpayStatus(),
    qstashConfigured: true,
    redisConfigured: true,
    databaseConfigured: true,
    backlog: healthyBacklog,
    backlogError: null,
  });
  assert.equal(healthy.ok, true);
  assert.deepEqual(healthy.problems, []);

  const broken = assessPaymentsHealth({
    featureEnabled: false,
    razorpay: razorpayStatus({
      keySecretConfigured: false,
      webhookSecretConfigured: false,
      modeMismatch: "Live key id used while RAZORPAY_MODE=test",
    }),
    qstashConfigured: false,
    redisConfigured: false,
    databaseConfigured: true,
    backlog: { ...healthyBacklog, failedEvents: 2, failedOutbox: 1, stuckOrders: 3 },
    backlogError: null,
  });
  assert.equal(broken.ok, false);
  assert.equal(broken.problems.length, 6);
  assert.ok(broken.problems.some((p) => p.includes("key secret")));
  assert.ok(broken.problems.some((p) => p.includes("webhook secret")));
  assert.ok(broken.problems.some((p) => p.includes("RAZORPAY_MODE")));
  assert.ok(broken.problems.some((p) => p.includes("2 webhook event")));
  assert.ok(broken.problems.some((p) => p.includes("1 outbox row")));
  assert.ok(broken.problems.some((p) => p.includes("3 order(s) stuck")));

  // Neither QStash nor Redis being absent is an outage — both degrade to cron
  // and to Postgres, so they must not raise a problem on their own.
  assert.equal(
    assessPaymentsHealth({
      featureEnabled: true,
      razorpay: razorpayStatus(),
      qstashConfigured: false,
      redisConfigured: false,
      databaseConfigured: true,
      backlog: healthyBacklog,
      backlogError: null,
    }).ok,
    true,
  );

  const noDb = assessPaymentsHealth({
    featureEnabled: true,
    razorpay: razorpayStatus(),
    qstashConfigured: true,
    redisConfigured: true,
    databaseConfigured: false,
    backlog: null,
    backlogError: null,
  });
  assert.equal(noDb.ok, false);
  assert.ok(noDb.problems.some((p) => p.includes("USER_DATABASE_URL")));
});
