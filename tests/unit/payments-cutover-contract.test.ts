/**
 * The cutover contract: what §11 and §12 of the plan promise an operator, pinned
 * against what the code actually does.
 *
 * A runbook is executed once, under time pressure, by someone holding live
 * credentials. Every drift between it and the code is paid for in that window —
 * a mistyped env name looks exactly like "the keys are wrong", and a health
 * field that no longer exists reads as `undefined`, which is falsy, which looks
 * exactly like "not configured". So the names are asserted here.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §11, §12. Phase 10.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getRazorpayConfigStatus, getRazorpayMode, isLivemode } from "@/server/payments/razorpay-client";
import { assessPaymentsHealth } from "@/server/payments/health-report";

const root = new URL("../..", import.meta.url).pathname;

/** The env names §11 tells the operator to set. */
const SCOPED = [
  "RAZORPAY_TEST_KEY_ID",
  "RAZORPAY_TEST_KEY_SECRET",
  "RAZORPAY_TEST_WEBHOOK_SECRET",
  "RAZORPAY_LIVE_KEY_ID",
  "RAZORPAY_LIVE_KEY_SECRET",
  "RAZORPAY_LIVE_WEBHOOK_SECRET",
];
const LEGACY = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map(Object.keys(patch).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** Clears every Razorpay name so a developer's own .env cannot colour a result. */
const CLEARED: Record<string, undefined> = Object.fromEntries(
  [...SCOPED, ...LEGACY, "RAZORPAY_MODE"].map((key) => [key, undefined]),
);

test("§11: the code reads exactly the env names the runbook tells you to set", () => {
  // A typo on either side is a silent cutover failure, so both directions are
  // asserted: nothing in §11 that the code ignores, nothing in the code that
  // §11 forgot to mention.
  const client = readFileSync(join(root, "src/server/payments/razorpay-client.ts"), "utf8");
  // The names are built from a mode prefix, so assert the construction itself.
  assert.match(client, /RAZORPAY_\$\{mode\}_\$\{name\}/);
  assert.match(client, /RAZORPAY_\$\{name\}/);
  assert.match(client, /process\.env\.RAZORPAY_MODE/);
  assert.match(client, /"KEY_ID" \| "KEY_SECRET" \| "WEBHOOK_SECRET"/);

  for (const mode of ["test", "live"] as const) {
    const keyId = mode === "test" ? "rzp_test_pin" : "rzp_live_pin";
    const status = withEnv(
      {
        ...CLEARED,
        RAZORPAY_MODE: mode,
        [`RAZORPAY_${mode.toUpperCase()}_KEY_ID`]: keyId,
        [`RAZORPAY_${mode.toUpperCase()}_KEY_SECRET`]: "pin",
        [`RAZORPAY_${mode.toUpperCase()}_WEBHOOK_SECRET`]: "pin",
      },
      () => getRazorpayConfigStatus(),
    );
    assert.equal(status.mode, mode);
    assert.equal(status.livemode, mode === "live");
    assert.equal(status.keyIdConfigured, true, `${mode}: key id`);
    assert.equal(status.keySecretConfigured, true, `${mode}: key secret`);
    assert.equal(status.webhookSecretConfigured, true, `${mode}: webhook secret`);
    assert.equal(status.modeMismatch, null);
    assert.deepEqual(status.source, { KEY_ID: "scoped", KEY_SECRET: "scoped", WEBHOOK_SECRET: "scoped" });
  }

  // §11 "Legacy, still honoured".
  const legacy = withEnv(
    { ...CLEARED, RAZORPAY_MODE: "test", RAZORPAY_KEY_ID: "rzp_test_pin", RAZORPAY_KEY_SECRET: "pin", RAZORPAY_WEBHOOK_SECRET: "pin" },
    () => getRazorpayConfigStatus(),
  );
  assert.equal(legacy.keyIdConfigured, true);
  assert.deepEqual(legacy.source, { KEY_ID: "legacy", KEY_SECRET: "legacy", WEBHOOK_SECRET: "legacy" });
});

test("§11: RAZORPAY_MODE is the one switch, and anything but 'live' is test", () => {
  for (const raw of [undefined, "", "test", "TEST", "prod", "production", "1", "yes", "  test  "]) {
    const mode = withEnv({ ...CLEARED, RAZORPAY_MODE: raw }, () => getRazorpayMode());
    assert.equal(mode, "test", `RAZORPAY_MODE=${JSON.stringify(raw)} must fail safe to test`);
  }
  for (const raw of ["live", "LIVE", " Live "]) {
    assert.equal(withEnv({ ...CLEARED, RAZORPAY_MODE: raw }, () => getRazorpayMode()), "live", raw);
    assert.equal(withEnv({ ...CLEARED, RAZORPAY_MODE: raw }, () => isLivemode()), true, raw);
  }
});

test("§12 step 2/12: the health fields the runbook names actually exist", () => {
  // The runbook used to say `keysConfigured` — a field that has never existed.
  // `undefined` is falsy, so an operator checking it would have read a healthy
  // deployment as unconfigured, or worse, written `!keysConfigured` and read a
  // broken one as fine.
  const status = withEnv(
    { ...CLEARED, RAZORPAY_MODE: "test", RAZORPAY_TEST_KEY_ID: "rzp_test_pin", RAZORPAY_TEST_KEY_SECRET: "pin", RAZORPAY_TEST_WEBHOOK_SECRET: "pin" },
    () => getRazorpayConfigStatus(),
  );
  const health = assessPaymentsHealth({
    featureEnabled: true,
    razorpay: status,
    qstashConfigured: true,
    redisConfigured: true,
    databaseConfigured: true,
    backlog: { pendingEvents: 0, failedEvents: 0, pendingOutbox: 0, failedOutbox: 0, stuckOrders: 0, lastWebhookAt: null, lastPaidAt: null },
    backlogError: null,
  });

  // Exactly the keys scripts/payments-cutover-check.mjs reads.
  assert.deepEqual(Object.keys(health).sort(), [
    "backlog",
    "backlogError",
    "databaseConfigured",
    "featureEnabled",
    "ok",
    "problems",
    "qstashConfigured",
    "razorpay",
    "redisConfigured",
  ]);
  for (const field of ["mode", "livemode", "keyIdConfigured", "keySecretConfigured", "webhookSecretConfigured", "modeMismatch", "source", "subscriptionsEnabled"]) {
    assert.ok(field in health.razorpay, `razorpay.${field} is named by the runbook`);
  }
  for (const field of ["pendingEvents", "failedEvents", "pendingOutbox", "failedOutbox", "stuckOrders", "lastWebhookAt", "lastPaidAt"]) {
    assert.ok(field in (health.backlog ?? {}), `backlog.${field} is named by the runbook`);
  }
  assert.equal(health.ok, true);
  assert.ok(!("keysConfigured" in health.razorpay), "the field the old runbook named must stay gone");
});

test("E24: a live-mode deploy carrying test credentials is caught, not silently used", () => {
  // The single most expensive cutover mistake: every webhook HMAC fails, so no
  // payment ever grants, and nothing anywhere returns an error.
  const mismatch = withEnv(
    { ...CLEARED, RAZORPAY_MODE: "live", RAZORPAY_LIVE_KEY_ID: "rzp_test_pin", RAZORPAY_LIVE_KEY_SECRET: "pin", RAZORPAY_LIVE_WEBHOOK_SECRET: "pin" },
    () => getRazorpayConfigStatus(),
  );
  assert.ok(mismatch.modeMismatch, "a test key under RAZORPAY_MODE=live must be reported");
  assert.match(String(mismatch.modeMismatch), /live/i);

  const health = assessPaymentsHealth({
    featureEnabled: true,
    razorpay: mismatch,
    qstashConfigured: true,
    redisConfigured: true,
    databaseConfigured: true,
    backlog: { pendingEvents: 0, failedEvents: 0, pendingOutbox: 0, failedOutbox: 0, stuckOrders: 0, lastWebhookAt: null, lastPaidAt: null },
    backlogError: null,
  });
  assert.equal(health.ok, false, "the health endpoint must refuse to call this healthy");
});

test("§12 abort: unsetting the flag removes the student-facing surface", () => {
  // The runbook's escape hatch. Every route a student can reach must gate on the
  // flag; the exceptions are deliberate and listed here so adding a new one is a
  // conscious edit rather than an oversight.
  const gated = [
    "api/pricing",
    "api/payments/checkout",
    "api/payments/verify",
    "api/payments/orders",
    "api/payments/coupon/validate",
    "api/payments/webhook",
    "api/admin/payments/refund",
    "api/internal/payments/reconcile",
  ];
  for (const route of gated) {
    const source = readFileSync(join(root, "src/app", route, "route.ts"), "utf8");
    assert.match(
      source,
      /(requireFeatureEnabled|isFeatureEnabled)\("payments"\)/,
      `${route} must disappear when TEACHER_LAUNCH_PAYMENTS is unset`,
    );
  }

  const ungatedByDesign: Record<string, string> = {
    // Phase 8: the flag is the student-checkout kill switch. Blacking out the
    // admin's revenue screen the moment they pull it is backwards.
    "api/admin/payments": "read-only admin reporting over money already taken",
    "api/admin/payments/summary": "read-only admin reporting over money already taken",
    // Operational: these must keep draining a backlog created before the abort,
    // or receipts for real payments would be stranded.
    "api/internal/payments/drain": "drains a backlog that predates the abort",
    "api/internal/payments/dispatch": "delivers one already-enqueued outbox row",
    "api/internal/payments/health": "diagnostic; reports the flag rather than obeying it",
  };
  for (const [route, reason] of Object.entries(ungatedByDesign)) {
    const source = readFileSync(join(root, "src/app", route, "route.ts"), "utf8");
    assert.ok(!/requireFeatureEnabled\("payments"\)/.test(source), `${route}: ${reason}`);
  }

  // Every payments route on disk is in exactly one of the two lists.
  const walk = (dir: string, prefix: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(join(root, "src/app", dir), { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), `${prefix}/${entry.name}`));
      else if (entry.name === "route.ts") out.push(prefix);
    }
    return out;
  };
  const found = [
    ...walk("api/payments", "api/payments"),
    ...walk("api/admin/payments", "api/admin/payments"),
    ...walk("api/internal/payments", "api/internal/payments"),
  ];
  const declared = new Set([...gated, ...Object.keys(ungatedByDesign)]);
  const undeclared = found.filter((route) => !declared.has(route));
  assert.deepEqual(undeclared, [], "a new payments route must declare whether the abort switch covers it");

  // And the flag itself ships off, so an un-set environment is the safe one.
  const off = withEnv({ TEACHER_LAUNCH_PAYMENTS: undefined }, () => isFeatureEnabled("payments"));
  assert.equal(off, false);
});
