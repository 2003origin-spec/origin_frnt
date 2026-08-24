#!/usr/bin/env node
/**
 * Cutover preflight for the Razorpay payments rollout.
 *
 * Runbook steps 2 and 12 (V1/RAZORPAY_PAYMENTS_PLAN.md §12) say "call the health
 * endpoint and eyeball the JSON". Eyeballing is how a live-key-in-test-mode
 * deploy (E24) ships: `modeMismatch` is one field among a dozen and every HMAC
 * fails silently afterwards. This turns those steps into a pass/fail checklist
 * with a non-zero exit code.
 *
 * It reads NOTHING it should not: the endpoint reports credential *presence and
 * provenance only*, never a secret or any part of one. This script never asks
 * for, prints, or stores a Razorpay key.
 *
 * Usage
 * -----
 *   PAYMENTS_CHECK_URL=https://www.o3origin.com \
 *   PAYMENTS_CHECK_TOKEN="$INTERNAL_CRON_TOKEN" \
 *   node scripts/payments-cutover-check.mjs [--expect-mode live] [--json]
 *
 * The token is the same INTERNAL_CRON_TOKEN (or CRON_SECRET) the crons use.
 * Pass it through the environment, never as an argv (argv lands in shell
 * history and in `ps`).
 *
 * Exit codes: 0 all checks passed · 1 a check failed · 2 could not reach the
 * endpoint or was not authorised.
 */

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const expectIndex = args.indexOf("--expect-mode");
const expectedMode = expectIndex >= 0 ? args[expectIndex + 1] : null;

const baseUrl = (process.env.PAYMENTS_CHECK_URL ?? "").trim().replace(/\/+$/, "");
const token = (process.env.PAYMENTS_CHECK_TOKEN ?? "").trim();

function die(code, message) {
  console.error(message);
  process.exit(code);
}

if (!baseUrl) die(2, "PAYMENTS_CHECK_URL is required (e.g. https://www.o3origin.com).");
if (!token) die(2, "PAYMENTS_CHECK_TOKEN is required — the INTERNAL_CRON_TOKEN or CRON_SECRET value.");
if (expectedMode && expectedMode !== "test" && expectedMode !== "live") {
  die(2, `--expect-mode must be "test" or "live", got ${expectedMode}`);
}

const url = `${baseUrl}/api/internal/payments/health`;

let health;
try {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    // The endpoint always answers 200 with an `ok` field; a non-200 means auth,
    // routing or the deployment itself — a different class of problem.
    redirect: "manual",
  });
  if (res.status === 401 || res.status === 403) {
    die(2, `${res.status} from ${url} — the token does not match INTERNAL_CRON_TOKEN or CRON_SECRET on that deployment.`);
  }
  if (res.status === 404) {
    die(2, `404 from ${url} — either this deployment predates the payments phases, or the route was not built.`);
  }
  if (!res.ok) die(2, `${res.status} from ${url}`);
  health = await res.json();
} catch (error) {
  die(2, `Could not reach ${url}: ${error instanceof Error ? error.message : error}`);
}

const checks = [];
const check = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });

const rzp = health.razorpay ?? {};
const backlog = health.backlog ?? null;

// ── Credentials: all three, same mode ──────────────────────────────────────
check("Razorpay mode resolved", Boolean(rzp.mode), `mode=${rzp.mode ?? "?"}`);
if (expectedMode) {
  check(`mode is "${expectedMode}"`, rzp.mode === expectedMode, `RAZORPAY_MODE resolves to ${rzp.mode}`);
}
check("key id configured", rzp.keyIdConfigured, `source=${rzp.source?.KEY_ID ?? "none"}`);
check("key secret configured", rzp.keySecretConfigured, `source=${rzp.source?.KEY_SECRET ?? "none"}`);
check(
  "webhook secret configured",
  rzp.webhookSecretConfigured,
  rzp.webhookSecretConfigured
    ? `source=${rzp.source?.WEBHOOK_SECRET ?? "none"}`
    : "without it NO webhook can be verified — every payment would silently fail to grant",
);
// E24: the failure mode that looks like nothing at all.
check("no mode/key mismatch", !rzp.modeMismatch, rzp.modeMismatch ?? "key id matches RAZORPAY_MODE");
// All three from the same place: a scoped/legacy mix survives a mode flip with
// the OLD secret still in play.
const sources = new Set(Object.values(rzp.source ?? {}).filter(Boolean));
check(
  "all three credentials come from one naming scheme",
  sources.size <= 1,
  sources.size <= 1 ? `source=${[...sources][0] ?? "none"}` : `mixed: ${JSON.stringify(rzp.source)}`,
);

// ── Platform wiring ────────────────────────────────────────────────────────
check("checkout feature flag on", health.featureEnabled, "TEACHER_LAUNCH_PAYMENTS");
check("database configured", health.databaseConfigured, "USER_DATABASE_URL");
// Neither of these is fatal: Redis degrades to Postgres, QStash degrades to the
// one-minute cron. Reported so the operator knows which path is live.
checks.push({ name: "Redis (fast idempotency path)", passed: true, detail: health.redisConfigured ? "configured" : "absent — falls back to Postgres", info: true });
checks.push({ name: "QStash (instant receipts)", passed: true, detail: health.qstashConfigured ? "configured" : "absent — receipts ride the 1-minute drain", info: true });

// ── Backlog: is the webhook actually arriving? ─────────────────────────────
if (backlog) {
  check("no webhook events parked as failed", backlog.failedEvents === 0, `failedEvents=${backlog.failedEvents}`);
  check("no outbox rows parked as failed", backlog.failedOutbox === 0, `failedOutbox=${backlog.failedOutbox}`);
  check(
    "no orders stuck unpaid over 15m",
    backlog.stuckOrders === 0,
    backlog.stuckOrders === 0
      ? "none"
      : `${backlog.stuckOrders} stuck — the usual cause is the webhook URL never being registered in the Razorpay dashboard`,
  );
  checks.push({
    name: "last webhook received",
    passed: true,
    detail: backlog.lastWebhookAt ?? "never — expected before the first test payment, alarming after one",
    info: true,
  });
} else {
  check("backlog readable", false, health.backlogError ?? "no backlog returned");
}

const failures = checks.filter((c) => !c.info && !c.passed);

if (wantJson) {
  console.log(JSON.stringify({ url, ok: failures.length === 0, mode: rzp.mode, checks }, null, 2));
} else {
  console.log(`\nPayments cutover check — ${url}\n`);
  for (const c of checks) {
    const mark = c.info ? "·" : c.passed ? "✓" : "✗";
    console.log(`  ${mark} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(
    failures.length === 0
      ? `\nAll checks passed. Endpoint reports ok=${health.ok}.\n`
      : `\n${failures.length} check(s) failed.\n`,
  );
  if (health.problems?.length) {
    console.log("Endpoint-reported problems:");
    for (const problem of health.problems) console.log(`  - ${problem}`);
    console.log("");
  }
}

process.exit(failures.length === 0 ? 0 : 1);
