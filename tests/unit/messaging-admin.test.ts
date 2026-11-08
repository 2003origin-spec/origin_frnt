/**
 * Student messaging admin API (`/api/admin/messaging/*`, contract addendum
 * 02/11/2026) through the real route file with a fake pg pool and stubbed
 * admin auth / audit / notifications: list, detail (fromMe relative to the
 * reporter), and the three resolve paths with their audit events and
 * notifications.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createFakePool, stubModules, userPostgresStub, type FakeResult } from "./_module-stubs";

const pool = createFakePool();
const notifications: { userId: string; title: string; message?: string }[] = [];
const audits: { action: string; entityId: string; after: Record<string, unknown>; inTransaction: boolean }[] = [];
let role: "admin" | "student" = "admin";

stubModules({
  "@/server/user-postgres": userPostgresStub(pool),
  // A Proxy, not a spread: authz is still initialising when the route loads it
  // (circular imports), so its exports are read lazily.
  "@/server/authz": (real: { AuthzError: new (status: number, message: string) => Error }) =>
    new Proxy(real, {
      get(target, key, receiver) {
        if (key !== "requireAdmin") return Reflect.get(target, key, receiver);
        return async () => {
          if (role !== "admin") throw new target.AuthzError(403, "You do not have permission to perform this action.");
          return { userId: "u_admin", role: "admin", tokenVersion: 0 };
        };
      },
    }),
  "@/server/workspaces/audit": (real: object) => ({
    ...real,
    recordAuditEvent: async (input: { action: string; entityId: string; after: Record<string, unknown> }, opts: { client?: unknown } = {}) => {
      audits.push({ action: input.action, entityId: input.entityId, after: input.after, inTransaction: Boolean(opts.client) });
    },
  }),
  "@/server/notifications": (real: object) => ({
    ...real,
    createNotification: async (userId: string, input: { title: string; message?: string }) => {
      notifications.push({ userId, title: input.title, message: input.message });
    },
  }),
});

(globalThis as { __originMessagingSchemaEnsured?: boolean }).__originMessagingSchemaEnsured = true;

async function call(method: "GET" | "POST", path: string, body?: unknown) {
  const { NextRequest } = await import("next/server");
  const route = await import("../../src/app/api/admin/messaging/[...slug]/route");
  const req = new NextRequest(new URL(`/api/admin/messaging/${path}`, "https://www.o3origin.com"), {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const context = { params: Promise.resolve({ slug: path.split("?")[0].split("/") }) };
  return method === "GET" ? route.GET(req, context) : route.POST(req, context);
}

function reportRow(status: string, resolution: string | null = null) {
  return {
    id: "mrep_1",
    reason: "abuse",
    note: "rude",
    created_at: new Date("2026-11-02T04:00:00Z"),
    status,
    conversation_id: "c1",
    reviewed_at: status === "open" ? null : new Date("2026-11-02T06:00:00Z"),
    resolution,
    resolution_note: null,
    reporter_id: "u_alice",
    reporter_username: "alice",
    reporter_name: "Alice",
    reporter_avatar: null,
    reported_id: "u_bob",
    reported_username: "bob",
    reported_name: "Bob",
    reported_avatar: null,
  };
}

/** One report mrep_1 (Alice reported Bob) whose stored status changes when it is resolved. */
function oneReport(initial = "open") {
  let status = initial;
  let resolution: string | null = null;
  pool.handler = (sql, params): FakeResult | undefined => {
    if (sql.includes("FROM messaging.reports WHERE id = $1 FOR UPDATE")) {
      return { rows: [{ id: "mrep_1", status, reported_id: "u_bob", conversation_id: "c1" }] };
    }
    if (sql.includes("UPDATE messaging.reports")) {
      status = String(params[1]);
      resolution = String(params[2]);
      return { rows: [] };
    }
    if (sql.includes("WHERE r.id = $1")) return { rows: [reportRow(status, resolution)] };
    return undefined;
  };
}

function reset() {
  pool.reset();
  notifications.length = 0;
  audits.length = 0;
  role = "admin";
}

test("admins only", async () => {
  reset();
  role = "student";
  const res = await call("GET", "reports");
  assert.equal(res.status, 403);
  assert.equal(pool.queries.length, 0);
});

test("list: open reports with people, paged, with a total", async () => {
  reset();
  pool.handler = (sql) => {
    if (sql.includes("COUNT(*)")) return { rows: [{ n: 41 }] };
    if (sql.includes("FROM messaging.reports r")) return { rows: [reportRow("open")] };
    return undefined;
  };
  const res = await call("GET", "reports?status=open&page=3");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 41);
  assert.deepEqual(body.reports[0], {
    id: "mrep_1",
    reason: "abuse",
    note: "rude",
    createdAt: "2026-11-02T04:00:00.000Z",
    status: "open",
    reporter: { id: "u_alice", username: "alice", name: "Alice", avatar: null },
    reported: { id: "u_bob", username: "bob", name: "Bob", avatar: null },
    conversationId: "c1",
    resolvedAt: null,
    resolution: null,
    resolutionNote: null,
  });
  const list = pool.matching("LIMIT $1 OFFSET $2")[0];
  assert.match(list.sql, /r\.status = 'open'/u);
  assert.deepEqual(list.params, [20, 40], "page 3 of 20");

  reset();
  pool.handler = () => ({ rows: [] });
  await call("GET", "reports?status=resolved");
  assert.match(pool.matching("LIMIT $1 OFFSET $2")[0].sql, /r\.status <> 'open'/u);
});

test("detail: the whole conversation oldest first, fromMe relative to the reporter", async () => {
  reset();
  pool.handler = (sql) => {
    if (sql.includes("WHERE r.id = $1")) return { rows: [reportRow("open")] };
    if (sql.includes("FROM messaging.messages")) {
      return {
        rows: [
          { id: "m2", body: "go away", sender_id: "u_bob", created_at: new Date("2026-11-02T03:01:00Z"), units: 1 },
          { id: "m1", body: "hi", sender_id: "u_alice", created_at: new Date("2026-11-02T03:00:00Z"), units: 1 },
        ],
      };
    }
    if (sql.includes("FROM messaging.suspensions")) return { rows: [{ ends_at: null }] };
    return undefined;
  };
  const res = await call("GET", "reports/mrep_1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(
    body.messages.map((m: { id: string; fromMe: boolean }) => [m.id, m.fromMe]),
    [["m1", true], ["m2", false]],
  );
  assert.equal(body.suspendedUntil, null);

  reset();
  pool.handler = () => ({ rows: [] });
  assert.equal((await call("GET", "reports/nope")).status, 404);
});

test("dismiss: resolved, audited in the transaction, no notification", async () => {
  reset();
  oneReport();
  const res = await call("POST", "reports/mrep_1/resolve", { action: "dismiss", note: "not abuse" });
  assert.equal(res.status, 200);
  const { report } = await res.json();
  assert.equal(report.status, "resolved");
  assert.equal(report.resolution, "dismiss");
  const update = pool.matching("UPDATE messaging.reports")[0];
  assert.deepEqual(update.params.slice(0, 5), ["mrep_1", "dismissed", "dismiss", "not abuse", update.params[4]]);
  assert.equal(update.params[5], "u_admin");
  assert.deepEqual(audits.map((a) => [a.action, a.entityId, a.inTransaction]), [["messaging.report.dismiss", "mrep_1", true]]);
  assert.equal(pool.ran("INSERT INTO messaging.suspensions"), false);
  assert.deepEqual(notifications, []);
  assert.ok(pool.ran("COMMIT"));
});

test("warn: the reported student gets an in-app notification", async () => {
  reset();
  oneReport();
  const res = await call("POST", "reports/mrep_1/resolve", { action: "warn" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).report.resolution, "warn");
  assert.deepEqual(pool.matching("UPDATE messaging.reports")[0].params.slice(1, 4), ["reviewed", "warn", null]);
  assert.deepEqual(notifications.map((n) => [n.userId, n.title]), [["u_bob", "A warning about your messages"]]);
  assert.equal(audits[0].action, "messaging.report.warn");
});

test("suspend: N-day suspension row, audit with the end, notification with the dd/mm/yyyy date", async () => {
  reset();
  oneReport();
  const before = Date.now();
  const res = await call("POST", "reports/mrep_1/resolve", { action: "suspend", days: 7, note: "repeat abuse" });
  assert.equal(res.status, 200);
  const insert = pool.matching("INSERT INTO messaging.suspensions")[0];
  const [, userId, reportId, startsAt, endsAt, note, createdBy] = insert.params as string[];
  assert.deepEqual([userId, reportId, note, createdBy], ["u_bob", "mrep_1", "repeat abuse", "u_admin"]);
  const length = Date.parse(endsAt) - Date.parse(startsAt);
  assert.equal(length, 7 * 24 * 60 * 60 * 1000);
  assert.ok(Date.parse(startsAt) >= before - 1000);
  assert.equal(audits[0].action, "messaging.report.suspend");
  assert.equal(audits[0].after.days, 7);
  assert.equal(audits[0].after.suspendedUntil, endsAt);
  assert.equal(notifications[0].userId, "u_bob");
  assert.equal(notifications[0].title, "Messaging paused");
  const { formatISTDayDMY } = await import("../../src/lib/format-time");
  assert.equal(
    notifications[0].message,
    `Messaging is paused on your account until ${formatISTDayDMY(endsAt)}. You can still read your messages.`,
  );
});

test("resolve refusals: bad action, suspend without valid days, already resolved, unknown report", async () => {
  reset();
  oneReport();
  let res = await call("POST", "reports/mrep_1/resolve", { action: "ban" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "invalid_action");
  for (const days of [undefined, 0, 91, 1.5]) {
    res = await call("POST", "reports/mrep_1/resolve", { action: "suspend", days });
    assert.equal(res.status, 400, String(days));
    assert.equal((await res.json()).code, "invalid_days");
  }
  assert.equal(pool.ran("UPDATE messaging.reports"), false);

  reset();
  oneReport("reviewed");
  res = await call("POST", "reports/mrep_1/resolve", { action: "warn" });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "already_resolved");
  assert.ok(pool.ran("ROLLBACK"));
  assert.deepEqual(audits, []);
  assert.deepEqual(notifications, []);

  reset();
  pool.handler = () => ({ rows: [] });
  assert.equal((await call("POST", "reports/nope/resolve", { action: "dismiss" })).status, 404);
  assert.equal((await call("POST", "reports/mrep_1/other", {})).status, 404);
});
