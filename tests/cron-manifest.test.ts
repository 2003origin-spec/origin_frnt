/**
 * The scheduled-work contract.
 *
 * Gap G9 (V1/RAZORPAY_PAYMENTS_PLAN.md §2) was a route that existed, was
 * correct, was documented as a cron — and was never listed in `vercel.json`, so
 * it never ran in production. Nothing failed; the work simply did not happen.
 * The same class of bug has three other shapes, and every one of them is silent:
 *
 *   1. scheduled path with no route file        → 404 forever
 *   2. scheduled route that exports only POST   → 405 forever (Vercel Cron GETs)
 *   3. scheduled route behind `requireInternal` → 401 wherever only Vercel's
 *      own CRON_SECRET is configured, because that helper accepts
 *      INTERNAL_CRON_TOKEN and nothing else
 *
 * This file asserts against all four. It also forces every internal worker to be
 * either scheduled or explicitly declared unscheduled with a reason, so the next
 * drain someone adds cannot quietly go unrun.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { getApiRoutePolicy } from "../src/server/route-policy";

const root = new URL("..", import.meta.url).pathname;

type CronEntry = { path: string; schedule: string };

const crons: CronEntry[] = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")).crons ?? [];

function routeFileFor(apiPath: string): string {
  return join(root, "src/app", `${apiPath.replace(/^\//, "")}`, "route.ts");
}

function sourceOf(apiPath: string): string {
  return readFileSync(routeFileFor(apiPath), "utf8");
}

/** A five-field cron expression, which is all Vercel accepts. */
const CRON_FIELD = String.raw`(\*|\d+)(\/\d+)?(-\d+)?(,\d+(-\d+)?)*`;
const CRON_EXPRESSION = new RegExp(`^${CRON_FIELD}( ${CRON_FIELD}){4}$`);

/**
 * Internal routes that are deliberately NOT on a schedule, each with the reason.
 * Anything under /api/internal that is not here and not in vercel.json fails the
 * sweep below — which is precisely the check G9 slipped past.
 */
const NOT_SCHEDULED: Record<string, string> = {
  "/api/internal/payments/dispatch":
    "QStash-triggered per outbox row; the 1-minute payments/drain is its cron backstop.",
  "/api/internal/payments/health":
    "On-demand diagnostic (plan D15). Nothing to drain.",
  "/api/internal/observability/drain":
    "Receiver, not a worker: authenticated by an HMAC body signature and called by the client SDK.",
  "/api/internal/analysis-worker":
    "Invoked by the analytics service after it enqueues, not on a clock.",
  "/api/internal/refresh-catalog":
    "Manual/ops cache refresh, run after a catalog import.",
  // Honest status, not an endorsement: this one's own docstring says "Schedule
  // it like the other internal drains", and it is not scheduled. It belongs to
  // Teacher Live Rooms, not to the payments plan, so Phase 9 records it here
  // and leaves the decision (and the GET handler it would also need) to that
  // feature's owner rather than changing an unrelated surface.
  "/api/internal/rooms/drain":
    "KNOWN GAP, owned by Teacher Live Rooms: a lazy read-path sweep already handles the common case, so the missing schedule only affects fully-disconnected rooms.",
};

test("every scheduled path resolves to a real route handler", () => {
  assert.ok(crons.length > 0, "vercel.json must declare crons");
  const missing = crons.filter((cron) => !existsSync(routeFileFor(cron.path)));
  assert.deepEqual(missing.map((cron) => cron.path), []);
});

test("every scheduled route exports GET — Vercel Cron issues GET, not POST", () => {
  const getless = crons.filter((cron) => {
    const source = sourceOf(cron.path);
    return !/export\s+(const\s+GET\b|async\s+function\s+GET\b)/.test(source);
  });
  assert.deepEqual(
    getless.map((cron) => cron.path),
    [],
    "a POST-only handler answers 405 to every cron invocation, silently",
  );
});

test("every scheduled route accepts Vercel's own CRON_SECRET", () => {
  // requireCronCaller accepts INTERNAL_CRON_TOKEN *or* CRON_SECRET;
  // requireInternal accepts only the former, so a route using it runs only
  // where the two secrets happen to be set to the same value.
  const narrow = crons.filter((cron) => !sourceOf(cron.path).includes("requireCronCaller"));
  assert.deepEqual(
    narrow.map((cron) => cron.path),
    [
      // Pre-existing and out of this plan's scope; called out rather than
      // silently tolerated. Both work today because INTERNAL_CRON_TOKEN is set.
      "/api/internal/cron/prerequisites-refresh",
      "/api/internal/cron/crystallize",
    ],
  );
});

test("every scheduled path is internal in the route policy", () => {
  for (const cron of crons) {
    assert.deepEqual(
      getApiRoutePolicy(cron.path),
      { kind: "internal", tokenName: "INTERNAL_CRON_TOKEN" },
      cron.path,
    );
  }
});

test("every schedule is a valid five-field cron expression", () => {
  for (const cron of crons) {
    assert.match(cron.schedule, CRON_EXPRESSION, `${cron.path}: ${cron.schedule}`);
  }
});

test("no path is scheduled twice", () => {
  const paths = crons.map((cron) => cron.path);
  assert.equal(new Set(paths).size, paths.length, paths.join(", "));
});

test("the payments plan's three crons are scheduled at their stated cadences", () => {
  const bySchedule = new Map(crons.map((cron) => [cron.path, cron.schedule]));
  // Plan §8 Phase 9 / §6 endpoint inventory.
  assert.equal(bySchedule.get("/api/internal/payments/drain"), "* * * * *");
  assert.equal(bySchedule.get("/api/internal/payments/reconcile"), "*/15 * * * *");
  // G9.
  assert.equal(bySchedule.get("/api/internal/connect-jobs/drain"), "*/2 * * * *");
});

test("every internal route is either scheduled or declared unscheduled with a reason", () => {
  const dir = join(root, "src/app/api/internal");
  const walk = (path: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path)) {
      const child = join(path, entry);
      if (statSync(child).isDirectory()) out.push(...walk(child));
      else if (entry === "route.ts") out.push(child);
    }
    return out;
  };
  const routes = walk(dir).map((file) =>
    file.slice(join(root, "src/app").length).replace(/\/route\.ts$/, ""),
  );
  const scheduled = new Set(crons.map((cron) => cron.path));
  const undeclared = routes.filter((route) => !scheduled.has(route) && !(route in NOT_SCHEDULED));
  assert.deepEqual(
    undeclared,
    [],
    "add it to vercel.json, or to NOT_SCHEDULED with the reason it never needs to run",
  );

  // The reverse: a stale NOT_SCHEDULED entry for a route that has since been
  // scheduled or deleted would quietly weaken the sweep above.
  const stale = Object.keys(NOT_SCHEDULED).filter(
    (route) => scheduled.has(route) || !routes.includes(route),
  );
  assert.deepEqual(stale, []);
  for (const [route, reason] of Object.entries(NOT_SCHEDULED)) {
    assert.ok(reason.length > 20, `${route} needs a real reason, not a placeholder`);
  }
});
