/**
 * Student messaging routes through handleAppApi (`/api/mobile/messages*`),
 * with a fake pg pool and stubbed auth / entitlements / notifications — the
 * flag gate, students-only, input checks, the daily cap 429 and the request
 * gate, without a database. The full SQL is exercised against a real Postgres
 * separately (see the PR notes).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createFakePool, stubModules, userPostgresStub, type FakeResult } from "./_module-stubs";

type User = { id: string; name: string; role: string };

const pool = createFakePool();
const notifications: { userId: string; title: string; href?: string | null }[] = [];
let currentUser: User | null = { id: "u_alice", name: "Alice", role: "student" };
let entitled: string[] = [];

stubModules({
  "@/server/user-postgres": userPostgresStub(pool),
  "@/lib/auth-server": (real: object) => ({ ...real, getServerUser: async () => currentUser }),
  "@/server/entitlements": (real: object) => ({ ...real, getEntitledSubjects: async () => entitled }),
  "@/server/notifications": (real: object) => ({
    ...real,
    createNotification: async (userId: string, input: { title: string; href?: string | null }) => {
      notifications.push({ userId, title: input.title, href: input.href });
    },
  }),
});

(globalThis as { __originMessagingSchemaEnsured?: boolean }).__originMessagingSchemaEnsured = true;

async function call(method: string, path: string, body?: unknown) {
  const { NextRequest } = await import("next/server");
  const { handleAppApi } = await import("../../src/server/mobile/app-api");
  const req = new NextRequest(new URL(`/api/mobile/${path}`, "https://www.o3origin.com"), {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return handleAppApi(method, req, path.split("?")[0].split("/"));
}

function reset() {
  pool.reset();
  notifications.length = 0;
  currentUser = { id: "u_alice", name: "Alice", role: "student" };
  entitled = [];
  delete process.env.TEACHER_LAUNCH_STUDENT_MESSAGING;
  delete process.env.TEACHER_LAUNCH_STUDENT_SOCIAL;
}

/** A conversation c1 between Alice and Bob, `status`, requested by `requestedBy`; `usedUnits` already spent today. */
function conversation(status: string, requestedBy: string, usedUnits: number) {
  let used = usedUnits;
  pool.handler = (sql, params): FakeResult | undefined => {
    if (sql.includes("FOR UPDATE OF c")) {
      return {
        rows: [
          { id: "c1", status, requested_by: requestedBy, other_id: "u_bob", other_name: "Bob", other_status: "active", i_blocked: false },
        ],
      };
    }
    if (sql.includes("UPDATE messaging.daily_usage")) {
      const [, , units, limit] = params as [string, string, number, number];
      if (used + units > limit) return { rows: [] };
      used += units;
      return { rows: [{ units: used }] };
    }
    if (sql.includes("SELECT units FROM messaging.daily_usage")) return { rows: [{ units: used }] };
    if (sql.includes("INSERT INTO messaging.messages")) {
      return { rows: [{ id: "msg_1", body: params[3], sender_id: params[2], created_at: new Date(String(params[6])), units: params[4] }] };
    }
    if (sql.includes("SET notice_pending = true")) return { rows: [{ user_id: "u_bob" }] };
    return undefined;
  };
}

test("flag off (or Student Social off): every messaging route is a 404", async () => {
  reset();
  process.env.TEACHER_LAUNCH_STUDENT_MESSAGING = "0";
  for (const [method, path] of [["GET", "messages"], ["GET", "messages/usage"], ["POST", "messages/start"], ["POST", "messages/c1/block"]]) {
    const res = await call(method, path, method === "POST" ? { text: "hi" } : undefined);
    assert.equal(res?.status, 404, path);
    assert.deepEqual(await res?.json(), { detail: "This feature is not available right now." });
  }
  reset();
  process.env.TEACHER_LAUNCH_STUDENT_SOCIAL = "0";
  assert.equal((await call("GET", "messages"))?.status, 404);
  assert.equal(pool.queries.length, 0, "no database work while off");
});

test("students only; signed out is a 401", async () => {
  reset();
  currentUser = { id: "t1", name: "Teacher", role: "teacher" };
  const res = await call("GET", "messages");
  assert.equal(res?.status, 403);
  assert.equal((await res?.json()).code, "not_student");
  currentUser = null;
  assert.equal((await call("GET", "messages"))?.status, 401);
});

test("empty and too-long messages are refused before any database work", async () => {
  reset();
  let res = await call("POST", "messages/c1", { text: "   " });
  assert.equal(res?.status, 400);
  assert.deepEqual(await res?.json(), { detail: "Write a message first.", code: "empty" });
  res = await call("POST", "messages/start", { username: "bob", text: "x".repeat(501) });
  assert.equal(res?.status, 400);
  assert.deepEqual(await res?.json(), { detail: "Keep a message under 500 characters.", code: "too_long" });
  res = await call("POST", "messages/start", { text: "hi" });
  assert.equal(res?.status, 400);
  assert.equal((await res?.json()).code, "no_recipient");
  assert.equal(pool.queries.length, 0);
});

test("a message in an accepted chat: saved, units counted, one notification", async () => {
  reset();
  conversation("accepted", "u_alice", 2);
  const res = await call("POST", "messages/c1", { text: "see you at the library tomorrow for the physics test prep ok" });
  assert.equal(res?.status, 200);
  const body = await res?.json();
  assert.equal(body.message.units, 2, "12 words = 2 units");
  assert.equal(body.message.fromMe, true);
  assert.equal(body.usage.used, 4);
  assert.equal(body.usage.limit, 10);
  assert.equal(body.usage.premium, false);
  assert.deepEqual(notifications, [{ userId: "u_bob", title: "New message", href: "/messages/c1" }]);
});

test("over the daily cap: 429 daily_limit with usage (premium false so the app can hint)", async () => {
  reset();
  conversation("accepted", "u_alice", 10);
  const res = await call("POST", "messages/c1", { text: "one more" });
  assert.equal(res?.status, 429);
  const body = await res?.json();
  assert.equal(body.code, "daily_limit");
  assert.equal(body.detail, "You've used today's 10 messages. More at midnight.");
  assert.equal(body.usage.used, 10);
  assert.equal(body.usage.premium, false);
  assert.equal(pool.ran("INSERT INTO messaging.messages"), false, "nothing saved");
  assert.ok(pool.ran("ROLLBACK"));
});

test("premium students get 40 units", async () => {
  reset();
  entitled = ["physics"];
  conversation("accepted", "u_alice", 10);
  const res = await call("POST", "messages/c1", { text: "still fine" });
  assert.equal(res?.status, 200);
  const body = await res?.json();
  assert.equal(body.usage.limit, 40);
  assert.equal(body.usage.premium, true);
});

test("request gate: the sender of a pending request can't send again; the recipient's reply accepts", async () => {
  reset();
  conversation("pending", "u_alice", 1);
  let res = await call("POST", "messages/c1", { text: "hello??" });
  assert.equal(res?.status, 409);
  assert.deepEqual(await res?.json(), { detail: "Wait for Bob to accept your request.", code: "request_pending" });

  reset();
  conversation("pending", "u_bob", 0);
  res = await call("POST", "messages/c1", { text: "hey!" });
  assert.equal(res?.status, 200);
  const accept = pool.matching("UPDATE messaging.conversations")[0];
  assert.equal(accept.params[2], true, "status flips to accepted in the same transaction");
  assert.deepEqual(
    notifications.map((n) => n.title),
    ["Request accepted", "New message"],
  );
});

test("declined and blocked conversations refuse sends", async () => {
  reset();
  conversation("declined", "u_alice", 0);
  let res = await call("POST", "messages/c1", { text: "please" });
  assert.equal(res?.status, 409);
  assert.deepEqual(await res?.json(), { detail: "Bob didn't accept your request.", code: "declined" });
  reset();
  conversation("blocked", "u_bob", 0);
  res = await call("POST", "messages/c1", { text: "hi" });
  assert.equal(res?.status, 403);
  assert.deepEqual(await res?.json(), { detail: "You can't message this student.", code: "blocked" });
});

test("someone else's conversation is a plain 404", async () => {
  reset();
  pool.handler = () => ({ rows: [] });
  const res = await call("POST", "messages/c9", { text: "hi" });
  assert.equal(res?.status, 404);
  assert.equal((await res?.json()).code, "not_found");
});

test("report needs a known reason", async () => {
  reset();
  const res = await call("POST", "messages/c1/report", { reason: "boring" });
  assert.equal(res?.status, 400);
  assert.equal((await res?.json()).code, "invalid_reason");
});

test("unknown messaging paths fall through to the catch-all 404", async () => {
  reset();
  assert.equal(await call("DELETE", "messages/c1"), null);
  assert.equal(await call("POST", "messages/c1/nope", {}), null);
  assert.equal(await call("GET", "messages/c1/extra"), null);
  assert.equal(await call("POST", "messages", { text: "hi" }), null);
});

test("/api/mobile/config sends the effective studentMessaging flag (needs Student Social)", async () => {
  reset();
  const { buildMobileConfig } = await import("../../src/server/mobile/config");
  assert.equal(buildMobileConfig().flags.studentMessaging, true, "dev default on");
  process.env.TEACHER_LAUNCH_STUDENT_SOCIAL = "0";
  assert.equal(buildMobileConfig().flags.studentMessaging, false);
  reset();
  process.env.TEACHER_LAUNCH_STUDENT_MESSAGING = "0";
  assert.equal(buildMobileConfig().flags.studentMessaging, false);
  reset();
});
