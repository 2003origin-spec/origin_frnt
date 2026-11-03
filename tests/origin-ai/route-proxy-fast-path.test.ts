/**
 * The origin-ai route's proxy paths (ORIGIN_AI_SERVICE_URL set) must not
 * hydrate the whole app store: the caller is resolved with one PK lookup on
 * origin_users, and nothing reads `SELECT data FROM app.<table>` in full.
 * Fake user pool + stubbed fetch; no database or microservice needed.
 *
 * ORIGIN_AI_SERVICE_URL is read once when the route module loads, so it is set
 * before the dynamic import below (node:test runs each file in its own process).
 */

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { authedRequest, installFakeUserPool, userRow } from "../unit/_scoped-store-fakes";

process.env.ORIGIN_AI_SERVICE_URL = "http://origin-ai.test";
process.env.ORIGIN_AI_SERVICE_TOKEN = "test-service-token";
process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "0";

const USER = "user_ori_fast_path";

type Handler = (request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) => Promise<Response>;

async function originAi() {
  return (await import("../../src/app/api/origin-ai/[...slug]/route")) as unknown as Record<
    "GET" | "POST" | "PATCH" | "DELETE",
    Handler
  >;
}

type FetchCall = { url: string; method: string; body: unknown };

const realFetch = globalThis.fetch;
let fetchCalls: FetchCall[] = [];
let upstream: (url: string) => Response = () => Response.json({ threads: [] });

beforeEach(() => {
  fetchCalls = [];
  upstream = () => Response.json({ threads: [] });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    fetchCalls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    return upstream(url);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function setupUser(overrides: Record<string, unknown> = {}, extra: (sql: string) => unknown[] | undefined = () => undefined) {
  return installFakeUserPool({
    rowsFor: (sql) =>
      sql.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER, overrides)] : extra(sql),
  });
}

async function call(handler: Handler, slug: string[], init: RequestInit = {}, authed = true): Promise<Response> {
  const url = `http://localhost/api/origin-ai/${slug.join("/")}`;
  const request = authed ? await authedRequest(USER, url, init) : new Request(url, init);
  return handler(new NextRequest(request), { params: Promise.resolve({ slug }) });
}

function upstreamCalls(): FetchCall[] {
  return fetchCalls.filter((entry) => entry.url.startsWith("http://origin-ai.test"));
}

function fullStoreReads(sql: string[]): string[] {
  return sql.filter(
    (s) =>
      s.startsWith("SELECT * FROM origin_users ORDER BY") ||
      /^SELECT data FROM app\.[a-z_]+ ORDER BY/.test(s) ||
      s.startsWith("SELECT * FROM app.tasks"),
  );
}

test("GET /threads proxies after one user lookup and never hydrates the store", async () => {
  const sql = setupUser();
  const response = await call((await originAi()).GET, ["threads"]);
  assert.equal(response.status, 200);
  assert.equal(upstreamCalls().length, 1);
  assert.equal(upstreamCalls()[0].url, "http://origin-ai.test/api/v1/chat/threads");
  assert.deepEqual(fullStoreReads(sql), []);
  assert.equal(sql.filter((s) => s.startsWith("SELECT * FROM origin_users WHERE id = $1")).length, 1);
});

test("a stale token version is a 401 and nothing is proxied", async () => {
  setupUser({ auth_token_version: 3 });
  const response = await call((await originAi()).GET, ["threads"]);
  assert.equal(response.status, 401);
  assert.equal(upstreamCalls().length, 0);
});

test("a revoked account is a 401 and nothing is proxied", async () => {
  setupUser({ account_status: "revoked" });
  const response = await call((await originAi()).POST, ["threads"], {
    method: "POST",
    body: JSON.stringify({ title: "Kinematics" }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(response.status, 401);
  assert.equal(upstreamCalls().length, 0);
});

test("an unknown user is a 401", async () => {
  installFakeUserPool();
  const response = await call((await originAi()).GET, ["threads", "thread_1"]);
  assert.equal(response.status, 401);
  assert.equal(upstreamCalls().length, 0);
});

test("no access token is refused before anything is proxied", async () => {
  setupUser();
  const response = await call((await originAi()).GET, ["threads"], {}, false);
  // The AI-access gate answers first for an anonymous caller (as before); the
  // edge middleware normally returns 401 earlier still.
  assert.equal(response.status, 403);
  assert.equal(upstreamCalls().length, 0);
});

test("a DB failure on the user lookup is a 503 (not a 401 or a 400) and nothing is proxied", async () => {
  installFakeUserPool({ failFor: (sql) => sql.startsWith("SELECT * FROM origin_users WHERE id = $1") });
  const { GET, POST } = await originAi();

  let response = await call(GET, ["threads"]);
  assert.equal(response.status, 503);

  // The stream branch sits inside POST's catch-all; the outage still maps to 503.
  response = await call(POST, ["doubt-solver", "stream"], {
    method: "POST",
    body: JSON.stringify({ message: "why?", threadId: "thread_1" }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(response.status, 503);
  assert.equal(upstreamCalls().length, 0);
});

const THREAD_SUBJECT_PREFIX = "SELECT data->>'subject' AS subject FROM app.origin_ai_sessions";

function sseUpstream(): Response {
  return new Response("event: delta\ndata: {\"text\":\"hi\"}\n\n", {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function askDoubtSolver(body: Record<string, unknown>): Promise<Response> {
  const response = await call((await originAi()).POST, ["doubt-solver", "stream"], {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  await response.clone().text(); // drain the stream; the caller can still read the body
  return response;
}

test("select-and-ask: a locally stored thread's subject comes from one targeted query", async () => {
  const sql = setupUser({}, (s) => (s.startsWith(THREAD_SUBJECT_PREFIX) ? [{ subject: "physics" }] : undefined));
  upstream = sseUpstream;
  const response = await askDoubtSolver({
    message: "explain this",
    highlightedText: "v = u + at",
    threadId: "thread_local",
    pageContext: { pageKind: "doubt_solver" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(fullStoreReads(sql), []);
  assert.equal(sql.filter((s) => s.startsWith(THREAD_SUBJECT_PREFIX)).length, 1);
  const [proxied] = upstreamCalls();
  assert.equal(proxied.url, "http://origin-ai.test/api/v1/chat/doubt-solver/stream");
  const sent = proxied.body as { subject: string | null; pageContext: Record<string, unknown> };
  assert.equal(sent.subject, "physics");
  assert.equal(sent.pageContext.activeSubject, "physics");
  assert.equal(sent.pageContext.pageKind, "doubt_solver");
});

test("select-and-ask: a microservice-only thread falls back to the app's activeSubject", async () => {
  const sql = setupUser();
  upstream = sseUpstream;
  const response = await askDoubtSolver({
    message: "explain this",
    threadId: "thread_remote",
    pageContext: { activeSubject: "chem" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(fullStoreReads(sql), []);
  const sent = upstreamCalls()[0].body as { subject: string | null; pageContext: Record<string, unknown> };
  assert.equal(sent.subject, "chem");
  assert.equal(sent.pageContext.activeSubject, "chem");
});

test("select-and-ask: no threadId skips the subject lookup entirely", async () => {
  const sql = setupUser();
  upstream = sseUpstream;
  const response = await askDoubtSolver({ message: "explain this", pageContext: { activeSubject: "bio" } });
  assert.equal(response.status, 200);
  assert.equal(sql.filter((s) => s.startsWith(THREAD_SUBJECT_PREFIX)).length, 0);
  assert.equal((upstreamCalls()[0].body as { subject: string | null }).subject, "bio");
});

test("select-and-ask: a failed subject lookup still answers (it is only enrichment)", async () => {
  installFakeUserPool({
    rowsFor: (s) => (s.startsWith("SELECT * FROM origin_users WHERE id = $1") ? [userRow(USER)] : undefined),
    failFor: (s) => s.startsWith(THREAD_SUBJECT_PREFIX),
  });
  upstream = sseUpstream;
  const response = await askDoubtSolver({ message: "why?", threadId: "thread_x", pageContext: { activeSubject: "phy" } });
  assert.equal(response.status, 200);
  assert.equal((upstreamCalls()[0].body as { subject: string | null }).subject, "phy");
});

test("session/message: thread subject read is targeted too", async () => {
  const sql = setupUser({}, (s) => (s.startsWith(THREAD_SUBJECT_PREFIX) ? [{ subject: "math" }] : undefined));
  upstream = () => Response.json({ answer: "ok", tokens_used: 0 });
  const response = await call((await originAi()).POST, ["session", "message"], {
    method: "POST",
    body: JSON.stringify({ message: "hi", threadId: "thread_local" }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(fullStoreReads(sql), []);
  assert.equal((upstreamCalls()[0].body as { subject: string | null }).subject, "math");
});

test("select-and-ask writes nothing before the proxy call (quota is read from the user row)", async () => {
  const sql = setupUser({ tokens_used_today: 1500, usage_reset_at: new Date() });
  upstream = sseUpstream;
  const response = await askDoubtSolver({ message: "explain", pageContext: { activeSubject: "phy" } });
  assert.equal(response.status, 200);
  assert.deepEqual(
    sql.filter((s) => /^(INSERT|UPDATE|DELETE)/.test(s) && /origin_users|origin_user_daily_usage/.test(s)),
    [],
  );
});

test("a student over today's 200k tokens is refused before anything is proxied", async () => {
  setupUser({ tokens_used_today: 200_000, usage_reset_at: new Date() });
  upstream = sseUpstream;
  const response = await askDoubtSolver({ message: "explain" });
  assert.equal(response.status, 403);
  assert.match(JSON.stringify(await response.json()), /daily AI usage limit/);
  assert.equal(upstreamCalls().length, 0);
});

test("yesterday's exhausted budget does not block today's question", async () => {
  setupUser({ tokens_used_today: 900_000, usage_reset_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });
  upstream = sseUpstream;
  const response = await askDoubtSolver({ message: "explain" });
  assert.equal(response.status, 200);
  assert.equal(upstreamCalls().length, 1);
});

test("premium gate still refuses a free student (gates run together) and nothing is proxied", async () => {
  process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "1";
  try {
    setupUser();
    upstream = sseUpstream;
    const response = await askDoubtSolver({ message: "explain" });
    assert.equal(response.status, 403);
    assert.equal(upstreamCalls().length, 0);
  } finally {
    process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "0";
  }
});

test("premium-refused questions do not use up the student's rate limit", async () => {
  // aiLimiter allows 10 session/message calls a minute. One fixed bucket so the
  // refused calls and the real question count against the same slot.
  const ask = async () =>
    call((await originAi()).POST, ["session", "message"], {
      method: "POST",
      body: JSON.stringify({ message: "explain" }),
      headers: { "content-type": "application/json", "x-origin-user-id": "rl_probe_premium_refused" },
    });
  setupUser();
  upstream = () => Response.json({ reply: "ok" });
  process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "1";
  try {
    for (let i = 0; i < 12; i += 1) {
      assert.equal((await ask()).status, 403);
    }
  } finally {
    process.env.TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS = "0";
  }
  assert.equal(upstreamCalls().length, 0);
  // Subscribed a moment later: the first real question is answered, not 429'd.
  assert.equal((await ask()).status, 200);
  assert.equal(upstreamCalls().length, 1);
});

test("GET on an unknown Ori route is a 404 without a user lookup", async () => {
  const sql = setupUser();
  const response = await call((await originAi()).GET, ["no-such-route"]);
  assert.equal(response.status, 404);
  assert.deepEqual(sql.filter((s) => s.startsWith("SELECT * FROM origin_users WHERE id = $1")), []);
  assert.equal(upstreamCalls().length, 0);
});

// ---- GET /chapters: cache first, write after the response ------------------

const CHAPTERS_PAYLOAD = { subject: "phy", chapters: [{ id: "phy-1", name: "Units and Measurement" }] };

function installFakeCatalogPool(options: { row?: { payload: unknown; fetched_at: Date } | null; failRead?: boolean } = {}) {
  const sql: string[] = [];
  const g = globalThis as unknown as Record<string, unknown>;
  process.env.OGCODE_DATABASE_URL = "postgres://fake:fake@127.0.0.1:1/fake_catalog";
  g.__originCatalogCacheSchemaApplied = true;
  g.__originCatalogCacheSchemaReady = Promise.resolve();
  g.__originOgcodePool = {
    query: async (text: string) => {
      const normalized = text.replace(/\s+/g, " ").trim();
      sql.push(normalized);
      if (normalized.startsWith("SELECT subject, payload, fetched_at FROM app.chapters_cache")) {
        if (options.failRead) throw new Error("fake catalog pool: read failed");
        const rows = options.row ? [{ subject: "phy", ...options.row }] : [];
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  return sql;
}

async function chaptersCall(query = "?subject=phy"): Promise<Response> {
  const { GET } = await originAi();
  const request = await authedRequest(USER, `http://localhost/api/origin-ai/chapters${query}`);
  return GET(new NextRequest(request), { params: Promise.resolve({ slug: ["chapters"] }) });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("chapters: a fresh cached catalog is served without calling the microservice or writing", async () => {
  const userSql = setupUser();
  const catalogSql = installFakeCatalogPool({ row: { payload: CHAPTERS_PAYLOAD, fetched_at: new Date(Date.now() - 60_000) } });
  const response = await chaptersCall();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Origin-AI-Catalog-Cache"), "hit");
  assert.deepEqual(await response.json(), CHAPTERS_PAYLOAD);
  await settle();
  assert.equal(upstreamCalls().length, 0);
  assert.equal(catalogSql.filter((s) => s.startsWith("INSERT")).length, 0);
  assert.deepEqual(fullStoreReads(userSql), []);
});

test("chapters: a stale cache is refreshed from the microservice and rewritten after the response", async () => {
  setupUser();
  const catalogSql = installFakeCatalogPool({
    row: { payload: CHAPTERS_PAYLOAD, fetched_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
  });
  const fresher = { subject: "phy", chapters: [{ id: "phy-1" }, { id: "phy-2" }] };
  upstream = () => Response.json(fresher);
  const response = await chaptersCall();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Origin-AI-Catalog-Cache"), "refresh");
  assert.deepEqual(await response.json(), fresher);
  assert.equal(upstreamCalls()[0].url, "http://origin-ai.test/api/v1/chapters?subject=phy");
  await settle();
  assert.equal(catalogSql.filter((s) => s.startsWith("INSERT INTO app.chapters_cache")).length, 1);
});

test("chapters: an empty cache proxies; an empty/unusable upstream payload is not cached", async () => {
  setupUser();
  const catalogSql = installFakeCatalogPool({ row: null });
  upstream = () => Response.json({ subject: "phy", chapters: [] });
  const response = await chaptersCall();
  assert.equal(response.status, 200);
  await settle();
  assert.equal(upstreamCalls().length, 1);
  assert.equal(catalogSql.filter((s) => s.startsWith("INSERT")).length, 0);
});

test("chapters: upstream failure falls back to the stale cached copy", async () => {
  setupUser();
  installFakeCatalogPool({ row: { payload: CHAPTERS_PAYLOAD, fetched_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } });
  upstream = () => Response.json({ detail: "boom" }, { status: 500 });
  const response = await chaptersCall();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Origin-AI-Catalog-Cache"), "stale");
  assert.deepEqual(await response.json(), CHAPTERS_PAYLOAD);
});

test("chapters: upstream failure with no cache passes the upstream status through", async () => {
  setupUser();
  installFakeCatalogPool({ row: null });
  upstream = () => Response.json({ detail: "boom" }, { status: 502 });
  const response = await chaptersCall();
  assert.equal(response.status, 502);
});

test("chapters: a failed cache read still answers from the microservice", async () => {
  setupUser();
  installFakeCatalogPool({ failRead: true });
  upstream = () => Response.json(CHAPTERS_PAYLOAD);
  const response = await chaptersCall();
  assert.equal(response.status, 200);
  assert.equal(upstreamCalls().length, 1);
});

test("chapters: a cached catalog is never served to an unauthenticated caller", async () => {
  setupUser({ auth_token_version: 9 });
  installFakeCatalogPool({ row: { payload: CHAPTERS_PAYLOAD, fetched_at: new Date() } });
  const response = await chaptersCall();
  assert.equal(response.status, 401);
});

test("chapters: invalid subject is still a 400", async () => {
  setupUser();
  installFakeCatalogPool();
  const response = await chaptersCall("?subject=history");
  assert.equal(response.status, 400);
  assert.equal(upstreamCalls().length, 0);
});
