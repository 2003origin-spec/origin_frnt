/**
 * Student messaging addendum (02/11/2026) through the real handlers, with a
 * fake pg pool and stubbed auth / entitlements / notifications / FCM:
 * unblock restores the earlier status, the blocked list, `blockedByMe`,
 * suspension enforcement (sends refused, reads allowed), push sends, and the
 * website route `/api/messages/*` (same handler, same gating).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createFakePool, stubModules, userPostgresStub, type FakeResult } from "./_module-stubs";

type User = { id: string; name: string; role: string };

const pool = createFakePool();
const notifications: { userId: string; title: string }[] = [];
const pushes: { userId: string; message: { title: string; body: string; data?: Record<string, string> } }[] = [];
let pushConfigured = true;
let pushThrows = false;
let currentUser: User | null = { id: "u_alice", name: "Alice", role: "student" };

stubModules({
  "@/server/user-postgres": userPostgresStub(pool),
  "@/lib/auth-server": (real: object) => ({ ...real, getServerUser: async () => currentUser }),
  "@/server/entitlements": (real: object) => ({ ...real, getEntitledSubjects: async () => [] }),
  "@/server/notifications": (real: object) => ({
    ...real,
    createNotification: async (userId: string, input: { title: string }) => {
      notifications.push({ userId, title: input.title });
    },
  }),
  "@/server/push/fcm": (real: object) => ({
    ...real,
    isPushConfigured: () => pushConfigured,
    sendPushToUser: async (userId: string, message: (typeof pushes)[number]["message"]) => {
      if (pushThrows) throw new Error("fcm down");
      pushes.push({ userId, message });
      return { attempted: 1, delivered: 1, pruned: 0 };
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

/** The website route file, called the way Next calls it. */
async function callWeb(method: "GET" | "POST", path: string, body?: unknown) {
  const { NextRequest } = await import("next/server");
  const route = await import("../../src/app/api/messages/[[...slug]]/route");
  const url = new URL(`/api/messages${path ? `/${path}` : ""}`, "https://www.o3origin.com");
  const req = new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const context = { params: Promise.resolve(segments.length ? { slug: segments } : {}) };
  return method === "GET" ? route.GET(req, context) : route.POST(req, context);
}

function reset() {
  pool.reset();
  notifications.length = 0;
  pushes.length = 0;
  pushConfigured = true;
  pushThrows = false;
  currentUser = { id: "u_alice", name: "Alice", role: "student" };
  delete process.env.TEACHER_LAUNCH_STUDENT_MESSAGING;
  delete process.env.TEACHER_LAUNCH_STUDENT_SOCIAL;
}

/** Unblock fixture: the pair's conversation, whether my block exists, whether Bob blocks me too. */
function blockedPair(opts: { before: string | null; myBlock?: boolean; otherBlocks?: boolean; noConversation?: boolean }) {
  pool.handler = (sql): FakeResult | undefined => {
    if (sql.includes("SELECT id, status, status_before_block FROM messaging.conversations")) {
      return opts.noConversation ? { rows: [] } : { rows: [{ id: "c1", status: "blocked", status_before_block: opts.before }] };
    }
    if (sql.includes("DELETE FROM messaging.blocks")) return { rows: opts.myBlock === false ? [] : [{ blocker_id: "u_alice" }] };
    if (sql.includes("SELECT 1 FROM messaging.blocks WHERE blocker_id = $1 AND blocked_id = $2")) {
      return { rows: opts.otherBlocks ? [{ "?column?": 1 }] : [] };
    }
    return undefined;
  };
}

test("unblock restores the status the block replaced", async () => {
  for (const before of ["accepted", "pending"]) {
    reset();
    blockedPair({ before });
    const res = await call("POST", "messages/unblock", { userId: "u_bob" });
    assert.equal(res?.status, 200);
    assert.deepEqual(await res?.json(), { ok: true });
    const update = pool.matching("SET status = $2, status_before_block = NULL")[0];
    assert.deepEqual(update.params, ["c1", before]);
    assert.deepEqual(pool.matching("DELETE FROM messaging.blocks")[0].params, ["u_alice", "u_bob"]);
    assert.ok(pool.ran("COMMIT"));
  }
});

test("unblock with nothing saved goes to declined", async () => {
  reset();
  blockedPair({ before: null });
  assert.equal((await call("POST", "messages/unblock", { userId: "u_bob" }))?.status, 200);
  assert.deepEqual(pool.matching("SET status = $2, status_before_block = NULL")[0].params, ["c1", "declined"]);
});

test("unblock while the other student still blocks: stays blocked, now by them", async () => {
  reset();
  blockedPair({ before: "accepted", otherBlocks: true });
  assert.equal((await call("POST", "messages/unblock", { userId: "u_bob" }))?.status, 200);
  assert.equal(pool.ran("SET status = $2, status_before_block = NULL"), false);
  assert.deepEqual(pool.matching("SET blocked_by = $2")[0].params, ["c1", "u_bob"]);
});

test("unblock is idempotent (nobody blocked) and needs a userId", async () => {
  reset();
  blockedPair({ before: "accepted", myBlock: false });
  assert.equal((await call("POST", "messages/unblock", { userId: "u_bob" }))?.status, 200);
  assert.equal(pool.ran("UPDATE messaging.conversations"), false, "nothing changes");
  reset();
  const res = await call("POST", "messages/unblock", {});
  assert.equal(res?.status, 400);
  assert.equal((await res?.json()).code, "no_user");
});

test("a block remembers the status it replaced", async () => {
  reset();
  pool.handler = (sql) => {
    if (sql.includes("FOR UPDATE OF c")) {
      return { rows: [{ id: "c1", status: "accepted", requested_by: "u_alice", other_id: "u_bob", other_name: "Bob", other_status: "active", i_blocked: false }] };
    }
    if (sql.includes("AND c.id = $2")) {
      return {
        rows: [
          { id: "c1", status: "blocked", requested_by: "u_alice", updated_at: new Date(), blocked_by_me: true, other_id: "u_bob", other_name: "Bob", unread: 0 },
        ],
      };
    }
    return undefined;
  };
  const res = await call("POST", "messages/c1/block");
  assert.equal(res?.status, 200);
  const body = await res?.json();
  assert.equal(body.conversation.status, "blocked");
  assert.equal(body.conversation.blockedByMe, true);
  assert.match(pool.matching("SET status_before_block")[0].sql, /CASE WHEN status = 'blocked' THEN status_before_block ELSE status END/u);
});

test("blocked list: the students I blocked, with our conversation", async () => {
  reset();
  pool.handler = (sql) =>
    sql.includes("FROM messaging.blocks b")
      ? {
          rows: [
            { blocked_at: new Date("2026-11-02T05:00:00Z"), id: "u_bob", username: "bob", name: "Bob", avatar: null, conversation_id: "c1" },
            { blocked_at: new Date("2026-11-01T05:00:00Z"), id: "u_cat", username: null, name: "Cat", avatar: "a.png", conversation_id: null },
          ],
        }
      : undefined;
  const res = await call("GET", "messages/blocked");
  assert.equal(res?.status, 200);
  assert.deepEqual(await res?.json(), {
    people: [
      { person: { id: "u_bob", username: "bob", name: "Bob", avatar: null }, blockedAt: "2026-11-02T05:00:00.000Z", conversationId: "c1" },
      { person: { id: "u_cat", username: null, name: "Cat", avatar: "a.png" }, blockedAt: "2026-11-01T05:00:00.000Z", conversationId: null },
    ],
  });
  assert.deepEqual(pool.matching("FROM messaging.blocks b")[0].params, ["u_alice"]);
});

test("blockedByMe is false for the student who was blocked", async () => {
  reset();
  pool.handler = (sql) =>
    sql.includes("ORDER BY c.updated_at DESC")
      ? { rows: [{ id: "c1", status: "blocked", requested_by: "u_bob", updated_at: new Date(), blocked_by_me: false, other_id: "u_bob", other_name: "Bob", unread: 0 }] }
      : undefined;
  const body = await (await call("GET", "messages"))?.json();
  assert.equal(body.conversations[0].status, "blocked");
  assert.equal(body.conversations[0].blockedByMe, false);
});

/** An accepted conversation c1 (Alice ↔ Bob); `suspendedUntil` = an active suspension end, or null. */
function chat(suspendedUntil: Date | null) {
  pool.handler = (sql, params) => {
    if (sql.includes("FROM messaging.suspensions")) return { rows: [{ ends_at: suspendedUntil }] };
    if (sql.includes("FOR UPDATE OF c")) {
      return { rows: [{ id: "c1", status: "accepted", requested_by: "u_alice", other_id: "u_bob", other_name: "Bob", other_status: "active", i_blocked: false }] };
    }
    if (sql.includes("UPDATE messaging.daily_usage")) return { rows: [{ units: 1 }] };
    if (sql.includes("INSERT INTO messaging.messages")) {
      return { rows: [{ id: "msg_1", body: params[3], sender_id: params[2], created_at: new Date(String(params[6])), units: params[4] }] };
    }
    if (sql.includes("SET notice_pending = true")) return { rows: [{ user_id: "u_bob" }] };
    return undefined;
  };
}

test("a suspended student can't send or start: 403 suspended with the dd/mm/yyyy IST date", async () => {
  reset();
  chat(new Date("2026-11-08T20:00:00Z")); // 09/11/2026 01:30 IST
  let res = await call("POST", "messages/c1", { text: "hi" });
  assert.equal(res?.status, 403);
  assert.deepEqual(await res?.json(), { detail: "Messaging is paused on your account until 09/11/2026.", code: "suspended" });
  assert.equal(pool.ran("INSERT INTO messaging.messages"), false);
  res = await call("POST", "messages/start", { username: "bob", text: "hi" });
  assert.equal(res?.status, 403);
  assert.equal((await res?.json()).code, "suspended");
  assert.equal(pool.ran("FROM origin_users"), false, "refused before looking anyone up");
  assert.deepEqual(pushes, []);
});

test("a suspended student can still read", async () => {
  reset();
  chat(new Date("2026-11-08T20:00:00Z"));
  assert.equal((await call("GET", "messages"))?.status, 200);
  assert.equal((await call("GET", "messages/usage"))?.status, 200);
});

test("a new message pushes with the in-app notice (once per unread notice)", async () => {
  reset();
  chat(null);
  const res = await call("POST", "messages/c1", { text: "see you at 5" });
  assert.equal(res?.status, 200);
  assert.deepEqual(notifications.map((n) => n.title), ["New message"]);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].userId, "u_bob");
  assert.equal(pushes[0].message.title, "Alice");
  assert.equal(pushes[0].message.body, "see you at 5");
  assert.deepEqual(pushes[0].message.data, { type: "message", conversationId: "c1", link: "/messages/c1" });

  // A notice is already waiting: no in-app notification and no push.
  reset();
  chat(null);
  const base = pool.handler;
  pool.handler = (sql, params) => (sql.includes("SET notice_pending = true") ? { rows: [] } : base(sql, params));
  assert.equal((await call("POST", "messages/c1", { text: "again" }))?.status, 200);
  assert.equal(pushes.length, 0);
});

test("push failures and an unconfigured FCM never block the send", async () => {
  reset();
  chat(null);
  pushThrows = true;
  assert.equal((await call("POST", "messages/c1", { text: "hello" }))?.status, 200);
  reset();
  chat(null);
  pushConfigured = false;
  assert.equal((await call("POST", "messages/c1", { text: "hello" }))?.status, 200);
  assert.equal(pushes.length, 0);
});

test("website /api/messages: same handler, same flag gate, students only", async () => {
  reset();
  process.env.TEACHER_LAUNCH_STUDENT_MESSAGING = "0";
  let res = await callWeb("GET", "");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { detail: "This feature is not available right now." });
  reset();
  process.env.TEACHER_LAUNCH_STUDENT_SOCIAL = "0";
  assert.equal((await callWeb("POST", "unblock", { userId: "u_bob" })).status, 404);
  assert.equal(pool.queries.length, 0);

  reset();
  currentUser = { id: "t1", name: "Teacher", role: "teacher" };
  res = await callWeb("GET", "");
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, "not_student");
  currentUser = null;
  assert.equal((await callWeb("GET", "usage")).status, 401);

  reset();
  res = await callWeb("GET", "?box=requests");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.conversations, []);
  assert.equal(body.usage.limit, 10);
  assert.ok(pool.ran("c.status = 'pending' AND c.requested_by <> $1"), "box=requests reached the handler");

  reset();
  chat(null);
  res = await callWeb("POST", "c1", { text: "from the website" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).message.text, "from the website");

  reset();
  assert.equal((await callWeb("POST", "c1/nope", {})).status, 404, "unknown path");
});

test("route policy + kill-switch cover /api/messages; admin messaging stays outside the kill-switch", async () => {
  const { getApiRoutePolicy } = await import("../../src/server/route-policy");
  const { FLAG_KILL_PREFIXES } = await import("../../src/server/incidents");
  assert.equal(getApiRoutePolicy("/api/messages").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/messages/c1/report").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/admin/messaging/reports").kind, "authenticated");
  const matcher = FLAG_KILL_PREFIXES.studentMessaging;
  assert.ok(Array.isArray(matcher));
  assert.deepEqual(matcher, ["/api/mobile/messages", "/api/messages"]);
});
