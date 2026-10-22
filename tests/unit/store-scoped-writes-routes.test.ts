/**
 * Bug-hunt 10 / N3 — the origin-ai route, the task Server Actions' store
 * fallbacks and the assessments ogcode-location handler persist ONLY the acting
 * user's mutated collections (fake pool; no database needed). Every one of these
 * used withStoreAsync, which issued `DELETE FROM app.<every table>` per call —
 * resolveProxyUser alone did so on every Ori request.
 */

import test, { before } from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import {
  appTablesWritten,
  assertNoUnscopedDelete,
  authedRequest,
  installFakeUserPool,
  userRow,
  usersOnly,
  writesOf,
} from "./_scoped-store-fakes";

// The in-app fallbacks run only without the Ori microservice; the premium gate
// would otherwise refuse a student with no subscription rows in the fake pool.
process.env.ORIGIN_AI_SERVICE_URL = "";
process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "0";

const USER = "user_scoped_routes_a";

type Handler = (request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) => Promise<Response>;

async function originAi() {
  return (await import("../../src/app/api/origin-ai/[...slug]/route")) as unknown as Record<
    "GET" | "POST" | "PATCH" | "DELETE",
    Handler
  >;
}

async function call(handler: Handler, slug: string[], init: RequestInit = {}): Promise<Response> {
  const url = `http://localhost/api/origin-ai/${slug.join("/")}`;
  const request = await authedRequest(USER, url, init);
  return handler(new NextRequest(request), { params: Promise.resolve({ slug }) });
}

function threadSessionRow(id: string, threadId: string, userId = USER) {
  const now = "2026-10-01T00:00:00.000Z";
  return {
    data: {
      id, userId, browserSessionId: "b", title: "T", summary: null, lastPathname: "/doubt-solver",
      lastPageKind: "doubt_solver", createdAt: now, updatedAt: now, messages: [], threadId,
      subject: "physics", activeConcept: null,
    },
  };
}

function setup(sessions: Array<{ data: unknown }> = []) {
  const users = usersOnly([userRow(USER)]);
  return installFakeUserPool({
    rowsFor: (sql) =>
      sql.startsWith("SELECT data FROM app.origin_ai_sessions") ? sessions : users(sql),
  });
}

// One warm-up request runs the idempotent schema-ensure seeding (app.migrations,
// the global ai_access_rules row) so the tests below see only handler writes.
before(async () => {
  setup();
  await call((await originAi()).GET, ["threads"]);
});

test("origin-ai GET /threads (read) writes nothing", async () => {
  const sql = setup([threadSessionRow("origin_ai_t1", "thread_1")]);
  const response = await call((await originAi()).GET, ["threads"]);
  assert.equal(response.status, 200);
  assert.deepEqual(writesOf(sql), []);
});

test("origin-ai POST /threads: only app.origin_ai_sessions", async () => {
  const sql = setup();
  const response = await call((await originAi()).POST, ["threads"], {
    method: "POST",
    body: JSON.stringify({ title: "Kinematics", subject: "physics" }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(response.status, 201);
  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), ["app.origin_ai_sessions"]);
});

test("origin-ai PATCH /threads/:id: only app.origin_ai_sessions; unknown thread writes nothing", async () => {
  let sql = setup([threadSessionRow("origin_ai_t1", "thread_1")]);
  const { PATCH } = await originAi();
  let response = await call(PATCH, ["threads", "thread_1"], {
    method: "PATCH",
    body: JSON.stringify({ title: "Renamed" }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(response.status, 200);
  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), ["app.origin_ai_sessions"]);

  sql = setup();
  response = await call(PATCH, ["threads", "thread_missing"], {
    method: "PATCH",
    body: JSON.stringify({ title: "Renamed" }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(response.status, 404);
  assert.deepEqual(writesOf(sql), []);
});

test("origin-ai DELETE /threads/:id: one targeted user-scoped delete by session id", async () => {
  const sql = setup([threadSessionRow("origin_ai_t1", "thread_1")]);
  const response = await call((await originAi()).DELETE, ["threads", "thread_1"], { method: "DELETE" });
  assert.equal(response.status, 204);
  assertNoUnscopedDelete(sql);
  assert.deepEqual(writesOf(sql), ["DELETE FROM app.origin_ai_sessions WHERE user_id = $1 AND id = $2"]);
});

test("origin-ai GET /session (runtime snapshot): profile + session + user-scoped reminder replace only", async () => {
  const sql = setup();
  const response = await call((await originAi()).GET, ["session"]);
  assert.equal(response.status, 200);
  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), [
    "app.origin_ai_profiles",
    "app.origin_ai_reminders",
    "app.origin_ai_sessions",
  ]);
  assert.ok(sql.includes("DELETE FROM app.origin_ai_reminders WHERE user_id = $1"));
});

test("origin-ai unauthenticated request writes nothing", async () => {
  const sql = setup();
  const { GET } = await originAi();
  const response = await GET(new NextRequest("http://localhost/api/origin-ai/session"), {
    params: Promise.resolve({ slug: ["session"] }),
  });
  assert.ok(response.status === 401 || response.status === 403);
  assert.deepEqual(writesOf(sql), []);
});

test("assessments ogcode location: only app.subject_ranks", async () => {
  const sql = setup();
  const { POST } = (await import("../../src/app/api/assessments/[...slug]/route")) as unknown as Record<"POST", Handler>;
  const request = await authedRequest(USER, "http://localhost/api/assessments/ogcode/location", {
    method: "POST",
    body: JSON.stringify({ subject: "physics", share: false }),
    headers: { "content-type": "application/json" },
  });
  // The handler's revalidateTag() needs the Next runtime and throws here (→ 400)
  // AFTER the scoped write committed, so assert on the SQL, not the status.
  await POST(new NextRequest(request), { params: Promise.resolve({ slug: ["ogcode", "location"] }) });
  assertNoUnscopedDelete(sql);
  assert.deepEqual(appTablesWritten(sql), ["app.subject_ranks"]);
});
