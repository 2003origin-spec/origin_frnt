/**
 * Admin announcements API (`/api/admin/announcements/*`) through the real
 * route file, with a fake pg pool (an in-memory app.announcements) and stubbed
 * admin auth / audit / notifications / FCM: admin-only, preview reach, send
 * (validation, notifications, pushes, counts, audit), the test send, the
 * double-send and hourly refusals, history paging, and the audience SQL.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createFakePool, stubModules, userPostgresStub, type FakeResult } from "./_module-stubs";

const pool = createFakePool();
const notifications: { userId: string; type?: string; title: string; message?: string; href?: string | null }[] = [];
const pushes: { userId: string; title: string; body: string; route?: string; data?: Record<string, string> }[] = [];
const audits: { action: string; entityId: string; after: Record<string, unknown>; inTransaction: boolean }[] = [];
let role: "admin" | "student" = "admin";
let pushConfigured = true;
let failPushFor = new Set<string>();

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
    createNotification: async (userId: string, input: { type?: string; title: string; message?: string; href?: string | null }) => {
      notifications.push({ userId, ...input });
    },
  }),
  "@/server/push/fcm": (real: object) => ({
    ...real,
    isPushConfigured: () => pushConfigured,
    sendPushToUser: async (userId: string, message: { title: string; body: string; route?: string; data?: Record<string, string> }) => {
      pushes.push({ userId, ...message });
      if (failPushFor.has(userId)) throw new Error("FCM down");
      return { attempted: 1, delivered: 1, pruned: 0 };
    },
  }),
  "@/server/push/device-tokens": (real: object) => ({ ...real, ensureDeviceTokensSchema: async () => undefined }),
  "@/server/subscriptions/subscriptions-schema": (real: object) => ({ ...real, ensureSubscriptionsSchema: async () => undefined }),
  "@/server/connect/subject-grants-schema": (real: object) => ({ ...real, ensureSubjectGrantsSchema: async () => undefined }),
});

(globalThis as { __originAnnouncementsSchemaEnsured?: boolean }).__originAnnouncementsSchemaEnsured = true;

async function call(method: "GET" | "POST", path: string, body?: unknown) {
  const { NextRequest } = await import("next/server");
  const route = await import("../../src/app/api/admin/announcements/[[...slug]]/route");
  const req = new NextRequest(new URL(`/api/admin/announcements${path}`, "https://www.o3origin.com"), {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const context = { params: Promise.resolve(segments.length ? { slug: segments } : {}) };
  return method === "GET" ? route.GET(req, context) : route.POST(req, context);
}

type Row = Record<string, unknown>;
let table: Row[] = [];
let students: { id: string; has_push: boolean }[] = [];

/** An in-memory app.announcements plus a fixed student list. */
function fakeDb() {
  pool.handler = (sql, params): FakeResult | undefined => {
    if (sql.includes("FROM origin_users u WHERE") && sql.includes("COUNT(*)")) {
      return { rows: [{ students: students.length, with_push: students.filter((s) => s.has_push).length }] };
    }
    if (sql.includes("SELECT u.id,")) {
      return { rows: sql.includes("u.id = $1") ? [{ id: params[0], has_push: true }] : students };
    }
    if (sql.includes("FROM app.announcements") && sql.includes("WHERE sent_by = $1")) {
      return { rows: table.filter((r) => r.sent_by === params[0] && Date.parse(String(r.created_at)) > Date.parse(String(params[1]))) };
    }
    if (sql.includes("INSERT INTO app.announcements")) {
      const [id, title, body, link, audience, sentBy, test, recipients, createdAt] = params;
      table.push({
        id, title, body, link, audience: JSON.parse(String(audience)), sent_by: sentBy, test, recipients,
        push_attempted: 0, push_delivered: 0, created_at: createdAt, finished_at: null, sender_name: "Dipraj",
      });
      return { rows: [] };
    }
    if (sql.includes("UPDATE app.announcements")) {
      const row = table.find((r) => r.id === params[0]);
      if (row) Object.assign(row, { push_attempted: params[1], push_delivered: params[2], finished_at: new Date() });
      return { rows: [] };
    }
    if (sql.includes("WHERE a.id = $1")) return { rows: table.filter((r) => r.id === params[0]) };
    if (sql.includes("ORDER BY a.created_at DESC")) {
      const [limit, offset] = params as number[];
      return { rows: [...table].reverse().slice(offset, offset + limit) };
    }
    if (sql.includes("COUNT(*)::int AS n FROM app.announcements")) return { rows: [{ n: table.length }] };
    return undefined;
  };
}

function reset() {
  pool.reset();
  notifications.length = 0;
  pushes.length = 0;
  audits.length = 0;
  role = "admin";
  pushConfigured = true;
  failPushFor = new Set();
  table = [];
  students = [
    { id: "s1", has_push: true },
    { id: "s2", has_push: false },
    { id: "s3", has_push: true },
  ];
  fakeDb();
}

const GOOD = { title: "Mock test on Sunday", body: "A full JEE mock opens at 10 am IST.", link: "/tests", audience: { kind: "students" } };

test("admins only", async () => {
  reset();
  role = "student";
  for (const [method, path, body] of [["GET", ""], ["POST", "/preview", { audience: { kind: "students" } }], ["POST", "/send", GOOD]] as const) {
    const res = await call(method, path, body);
    assert.equal(res.status, 403, `${method} ${path}`);
  }
  assert.equal(pool.queries.length, 0);
});

test("preview: students and how many have the app, plus whether push is configured", async () => {
  reset();
  let res = await call("POST", "/preview", { audience: { kind: "students", studentClass: "12" } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { reach: { students: 3, withPush: 2 }, pushConfigured: true });
  const query = pool.matching("COUNT(*) FILTER")[0];
  assert.match(query.sql, /u\.role = 'student'/u);
  assert.match(query.sql, /COALESCE\(u\.account_status, 'active'\) = 'active'/u);
  assert.match(query.sql, /notif\.device_tokens t WHERE t\.user_id = u\.id AND t\.revoked_at IS NULL/u);
  assert.deepEqual(query.params, ["12"]);

  pushConfigured = false;
  res = await call("POST", "/preview", { audience: { kind: "students" } });
  assert.equal((await res.json()).pushConfigured, false);

  for (const audience of [undefined, "all", { kind: "students", exam: "upsc" }]) {
    res = await call("POST", "/preview", { audience });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { detail: "Choose who gets this announcement.", code: "invalid_audience" });
  }
});

test("send: in-app notification for everyone, a push for students with the app, counts, audit", async () => {
  reset();
  const res = await call("POST", "/send", GOOD);
  assert.equal(res.status, 200);
  const { announcement } = await res.json();
  assert.match(announcement.id, /^ann_/u);
  assert.equal(announcement.title, GOOD.title);
  assert.equal(announcement.body, GOOD.body);
  assert.equal(announcement.link, "/tests");
  assert.equal(announcement.audienceLabel, "All students");
  assert.deepEqual(announcement.audience, { kind: "students", studentClass: null, exam: null, premiumOnly: false });
  assert.equal(announcement.test, false);
  assert.deepEqual(announcement.sentBy, { id: "u_admin", name: "Dipraj" });
  assert.equal(announcement.recipients, 3);
  assert.equal(announcement.pushAttempted, 2);
  assert.equal(announcement.pushDelivered, 2);
  assert.ok(announcement.finishedAt);

  assert.deepEqual(
    notifications.map((n) => [n.userId, n.type, n.title, n.message, n.href]).sort(),
    ["s1", "s2", "s3"].map((id) => [id, "info", GOOD.title, GOOD.body, "/tests"]),
  );
  assert.deepEqual(pushes.map((p) => p.userId).sort(), ["s1", "s3"]);
  for (const p of pushes) {
    assert.equal(p.route, "/tests");
    assert.deepEqual(p.data, { type: "announcement", announcementId: announcement.id });
    assert.equal(p.title, GOOD.title);
  }

  // The checks, the lock and the row are one transaction; the counts + audit another.
  assert.ok(pool.ran("pg_advisory_xact_lock(hashtext($1))"));
  assert.deepEqual(pool.matching("pg_advisory_xact_lock(hashtext")[0].params, ["announcements:u_admin"]);
  assert.equal(pool.matching("COMMIT").length, 2);
  assert.deepEqual(pool.matching("UPDATE app.announcements")[0].params, [announcement.id, 2, 2]);
  assert.deepEqual(audits.map((a) => [a.action, a.entityId, a.inTransaction]), [["announcement.sent", announcement.id, true]]);
  assert.equal(audits[0].after.recipients, 3);
  assert.equal(audits[0].after.pushAttempted, 2);
  assert.equal(audits[0].after.pushDelivered, 2);
});

test("send: one failing push doesn't stop the rest; no pushes when push isn't configured", async () => {
  reset();
  failPushFor = new Set(["s1"]);
  let { announcement } = await (await call("POST", "/send", GOOD)).json();
  assert.equal(announcement.pushAttempted, 2);
  assert.equal(announcement.pushDelivered, 1);
  assert.equal(notifications.length, 3);

  reset();
  pushConfigured = false;
  ({ announcement } = await (await call("POST", "/send", GOOD)).json());
  assert.deepEqual([announcement.recipients, announcement.pushAttempted, announcement.pushDelivered], [3, 0, 0]);
  assert.equal(pushes.length, 0);
  assert.equal(notifications.length, 3);
});

test("send test to me: only the admin's own account, audited as a test", async () => {
  reset();
  const res = await call("POST", "/send", { ...GOOD, audience: { kind: "me" } });
  assert.equal(res.status, 200);
  const { announcement } = await res.json();
  assert.equal(announcement.test, true);
  assert.equal(announcement.audienceLabel, "Test: only me");
  assert.equal(announcement.recipients, 1);
  const recipientsQuery = pool.matching("SELECT u.id,")[0];
  assert.match(recipientsQuery.sql, /WHERE u\.id = \$1/u);
  assert.doesNotMatch(recipientsQuery.sql, /u\.role = 'student'/u, "the admin is not a student");
  assert.deepEqual(recipientsQuery.params, ["u_admin"]);
  assert.deepEqual(notifications.map((n) => n.userId), ["u_admin"]);
  assert.deepEqual(pushes.map((p) => p.userId), ["u_admin"]);
  assert.equal(audits[0].action, "announcement.test");
});

test("send validation: bad title, text, link or audience is a 400 and nothing is sent", async () => {
  reset();
  const cases: [Record<string, unknown>, string][] = [
    [{ ...GOOD, title: "" }, "Write a title."],
    [{ ...GOOD, title: "x".repeat(66) }, "Keep the title to 65 characters."],
    [{ ...GOOD, body: "y".repeat(241) }, "Keep the text to 240 characters."],
    [{ ...GOOD, link: "https://evil.example" }, 'The link must be a page on this site, starting with "/" (for example /dashboard).'],
    [{ ...GOOD, link: "//evil.example" }, 'The link must be a page on this site, starting with "/" (for example /dashboard).'],
    [{ ...GOOD, link: "javascript:alert(1)" }, 'The link must be a page on this site, starting with "/" (for example /dashboard).'],
    [{ ...GOOD, audience: { kind: "teachers" } }, "Choose who gets this announcement."],
  ];
  for (const [body, detail] of cases) {
    const res = await call("POST", "/send", body);
    assert.equal(res.status, 400, detail);
    assert.equal((await res.json()).detail, detail);
  }
  assert.equal(pool.ran("INSERT INTO app.announcements"), false);
  assert.equal(notifications.length + pushes.length, 0);

  // A missing link becomes "/".
  const res = await call("POST", "/send", { ...GOOD, link: undefined });
  assert.equal((await res.json()).announcement.link, "/");
});

test("send: nobody matching the audience is a 400", async () => {
  reset();
  students = [];
  const res = await call("POST", "/send", GOOD);
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { detail: "No students match this audience.", code: "no_recipients" });
  assert.equal(pool.ran("INSERT INTO app.announcements"), false);
});

test("double send: the same announcement to the same students again within 2 minutes is a 409", async () => {
  reset();
  assert.equal((await call("POST", "/send", GOOD)).status, 200);
  notifications.length = 0;
  pushes.length = 0;
  audits.length = 0;
  const res = await call("POST", "/send", GOOD);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, "duplicate");
  assert.match(body.detail, /You sent this same announcement to the same students less than a minute ago/u);
  assert.ok(pool.ran("ROLLBACK"));
  assert.equal(table.length, 1);
  assert.deepEqual([notifications.length, pushes.length, audits.length], [0, 0, 0]);

  // A different audience is fine.
  assert.equal((await call("POST", "/send", { ...GOOD, audience: { kind: "students", exam: "jee" } })).status, 200);
});

test("hourly limit: an 11th real send within the hour is a 429; a test send still goes", async () => {
  reset();
  const now = Date.now();
  for (let i = 0; i < 10; i += 1) {
    table.push({
      id: `ann_old${i}`, title: `Old ${i}`, body: "x", link: "/", audience: { kind: "students" }, sent_by: "u_admin", test: false,
      recipients: 3, push_attempted: 0, push_delivered: 0, created_at: new Date(now - (50 - i) * 60_000).toISOString(), finished_at: new Date(),
    });
  }
  const res = await call("POST", "/send", GOOD);
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.code, "hourly_limit");
  assert.match(body.detail, /^You can send 10 announcements an hour\. Try again in \d+ minutes?\.$/u);
  assert.equal(notifications.length, 0);

  assert.equal((await call("POST", "/send", { ...GOOD, audience: { kind: "me" } })).status, 200);
});

test("history: newest first, 20 a page, with a total", async () => {
  reset();
  for (let i = 0; i < 25; i += 1) {
    table.push({
      id: `ann_${i}`, title: `T${i}`, body: "x", link: "/", audience: JSON.stringify({ kind: "students", studentClass: "11", premiumOnly: true }),
      sent_by: i === 0 ? null : "u_admin", sender_name: "Dipraj", test: false, recipients: 5, push_attempted: 2, push_delivered: 1,
      created_at: new Date(Date.UTC(2026, 10, 1, 0, i)), finished_at: new Date(Date.UTC(2026, 10, 1, 0, i, 30)),
    });
  }
  let res = await call("GET", "");
  assert.equal(res.status, 200);
  let body = await res.json();
  assert.equal(body.total, 25);
  assert.equal(body.pageSize, 20);
  assert.equal(body.announcements.length, 20);
  assert.equal(body.announcements[0].id, "ann_24");
  assert.equal(body.announcements[0].audienceLabel, "Students: Class 11 · Premium");
  assert.equal(body.announcements[0].createdAt, "2026-11-01T00:24:00.000Z");
  assert.deepEqual(pool.matching("LIMIT $1 OFFSET $2")[0].params, [20, 0]);

  res = await call("GET", "?page=2");
  body = await res.json();
  assert.equal(body.announcements.length, 5);
  assert.equal(body.announcements[4].sentBy, null, "a deleted sender shows as nobody");
  assert.deepEqual(pool.matching("LIMIT $1 OFFSET $2")[1].params, [20, 20]);

  await call("GET", "?page=-4");
  assert.deepEqual(pool.matching("LIMIT $1 OFFSET $2")[2].params, [20, 0]);
});

test("unknown paths are a 404", async () => {
  reset();
  assert.equal((await call("GET", "/preview")).status, 404);
  assert.equal((await call("POST", "", GOOD)).status, 404);
  assert.equal((await call("POST", "/send/now", GOOD)).status, 404);
});

test("audience SQL: class, exam and Premium filters combine; values are bound, never spliced", async () => {
  const { audienceWhere } = await import("../../src/server/announcements/admin");
  const { ENTITLED_CLAUSE } = await import("../../src/server/entitlements");

  const all = audienceWhere({ kind: "students", studentClass: null, exam: null, premiumOnly: false }, "u_admin");
  assert.equal(all.sql, `u.role = 'student' AND COALESCE(u.account_status, 'active') = 'active'`);
  assert.deepEqual(all.params, []);

  const eleven = audienceWhere({ kind: "students", studentClass: "11", exam: "jee", premiumOnly: false }, "u_admin");
  assert.match(eleven.sql, /regexp_replace\(lower\(COALESCE\(u\.student_class, ''\)\), '\(class\|th\|\[\^a-z0-9\]\)', '', 'g'\) = \$1/u);
  assert.doesNotMatch(eleven.sql, /is_dropper/u);
  assert.match(eleven.sql, /\(u\.study_mode = 'jee' OR u\.selected_course ~\* '\(jee\|engineering\)'\)/u);
  assert.deepEqual(eleven.params, ["11"]);

  const dropper = audienceWhere({ kind: "students", studentClass: "dropper", exam: "neet", premiumOnly: false }, "u_admin");
  assert.match(dropper.sql, /= \$1 OR u\.is_dropper\)/u);
  assert.match(dropper.sql, /u\.study_mode = 'neet' OR u\.selected_course ~\* '\(neet\|aipmt\|medical\)'/u);

  const premium = audienceWhere({ kind: "students", studentClass: null, exam: null, premiumOnly: true }, "u_admin");
  assert.ok(premium.sql.includes(`FROM subscriptions.user_subscriptions s WHERE s.user_id = u.id AND ${ENTITLED_CLAUSE}`));
  assert.match(premium.sql, /entitlements\.subject_grants g\s+WHERE g\.user_id = u\.id AND g\.status = 'active' AND \(g\.expires_at IS NULL OR g\.expires_at > NOW\(\)\)/u);
  assert.doesNotMatch(premium.sql, /is_premium/u, "is_premium is only a mirror");

  assert.deepEqual(audienceWhere({ kind: "me" }, "u_admin"), { sql: "u.id = $1", params: ["u_admin"] });
});
