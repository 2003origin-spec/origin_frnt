/**
 * T4 — public access and the 2-a-day limit (V1/percentile-predictor/TEST_CASES.md
 * §T4), through the real GET/POST handlers of /api/public/rank-predictor.
 *
 * Fake clock (public-limit `nowMs`) and a fake Redis (an in-memory SADD/SCARD
 * map that can be switched to "down"). The flag is stubbed on. Auth: a request
 * carrying the token "valid-token" (cookie or bearer) resolves to a user; every
 * other token goes through the REAL resolveTokenToUser / JWT check, so forged
 * and expired tokens are proven to be treated as visitors.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SignJWT } from "jose";

import { stubModules } from "../_module-stubs";

const SECRET = randomBytes(32).toString("base64url");
process.env.AUTH_JWT_SECRET_CURRENT = SECRET;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

// ─── Captured logs (T4.16) ──────────────────────────────────────────────────
const logLines: string[] = [];
for (const level of ["log", "info", "warn", "error", "debug"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    logLines.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    void original;
  };
}

// ─── Fake Redis + fake clock ────────────────────────────────────────────────
class FakeRedis {
  sets = new Map<string, Set<string>>();
  /** SADD calls seen (to prove a refused request did no counter work). */
  writes = 0;
  ttl = new Map<string, number>();
  down = false;
  private check() {
    if (this.down) throw new Error("fake redis is down");
  }
  async sadd(key: string, member: string) {
    this.check();
    this.writes += 1;
    const set = this.sets.get(key) ?? new Set<string>();
    this.sets.set(key, set);
    if (set.has(member)) return 0;
    set.add(member);
    return 1;
  }
  async scard(key: string) {
    this.check();
    return this.sets.get(key)?.size ?? 0;
  }
  async srem(key: string, member: string) {
    this.check();
    return this.sets.get(key)?.delete(member) ? 1 : 0;
  }
  async expire(key: string, seconds: number) {
    this.check();
    this.ttl.set(key, seconds);
    return 1;
  }
  /** Upstash-style pipeline: queue calls, run them in order on exec(). */
  pipeline() {
    const ops: (() => Promise<unknown>)[] = [];
    const p = {
      sadd: (k: string, m: string) => (ops.push(() => this.sadd(k, m)), p),
      scard: (k: string) => (ops.push(() => this.scard(k)), p),
      expire: (k: string, s: number) => (ops.push(() => this.expire(k, s)), p),
      exec: async () => {
        this.check();
        const out: unknown[] = [];
        for (const op of ops) out.push(await op());
        return out;
      },
    };
    return p;
  }
}

const redis = new FakeRedis();
let fakeNow = Date.parse("2026-11-11T06:00:00Z"); // 11:30 IST
let flagOn = true;

type FakeUser = { id: string; role: "student" };
const SIGNED_IN_USER: FakeUser = { id: "u_signed_in", role: "student" };

stubModules({
  "server-only": {},
  "@/server/feature-flags-runtime": (real: object) => ({ ...real, isFeatureEnabledRuntime: async () => flagOn }),
  "@/server/auth": (real: { resolveTokenToUser: (r: Request) => Promise<unknown> }) => ({
    ...real,
    resolveTokenToUser: async (request: Request) => {
      const cookie = request.headers.get("cookie") ?? "";
      const auth = request.headers.get("authorization") ?? "";
      if (cookie.includes("origin_access_token=valid-token") || auth === "Bearer valid-token") return SIGNED_IN_USER;
      return real.resolveTokenToUser(request);
    },
  }),
  // The per-IP "new devices" limiter on the fake clock, so tests can move a minute on.
  "@/lib/rate-limit": (real: typeof import("@/lib/rate-limit")) => ({
    ...real,
    rankPredictorNewDeviceLimiter: real.createMemoryLimiter(20, 60_000, {}, () => fakeNow),
  }),
  "@/server/rank-predictor/public-limit": (real: typeof import("@/server/rank-predictor/public-limit")) => {
    const store = real.createFailOpenStore(real.createRedisCheckStore(redis), real.createMemoryCheckStore(() => fakeNow));
    return { ...real, nowMs: () => fakeNow, freeCheckStore: () => store };
  },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST, GET } = require("@/app/api/public/rank-predictor/route") as typeof import("@/app/api/public/rank-predictor/route");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const limit = require("@/server/rank-predictor/public-limit") as typeof import("@/server/rank-predictor/public-limit");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getApiRoutePolicy, getAppRoutePolicy } = require("@/server/route-policy") as typeof import("@/server/route-policy");

// ─── Helpers ────────────────────────────────────────────────────────────────

// Response JSON, read loosely by the assertions below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

let ipCounter = 0;
/** A fresh documentation-range IP per test, so the burst limiter never leaks across tests. */
function freshIp() {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

type Client = { ip: string; cookie: string | null; headers?: Record<string, string> };

function client(ip = freshIp()): Client {
  return { ip, cookie: null };
}

function neet(physics: number, extra: Record<string, unknown> = {}) {
  return { exam: "neet", marks: { physics: physics % 181, chemistry: 134, biology: 301 }, category: "obc-ncl", pwd: false, homeState: "Karnataka", ...extra };
}

async function post(c: Client, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": c.ip, ...(c.headers ?? {}) };
  if (c.cookie) headers.cookie = c.cookie;
  const res = await POST(new Request("http://localhost/api/public/rank-predictor", { method: "POST", headers, body: JSON.stringify(body) }) as never);
  const set = res.headers.get("set-cookie");
  if (set) c.cookie = set.split(";")[0];
  return { res, status: res.status, body: (await res.json()) as Json };
}

async function status(c: Client) {
  const headers: Record<string, string> = { "x-forwarded-for": c.ip, ...(c.headers ?? {}) };
  if (c.cookie) headers.cookie = c.cookie;
  const res = await GET(new Request("http://localhost/api/public/rank-predictor", { headers }) as never);
  return { status: res.status, body: (await res.json()) as Json };
}

// ─── T4 cases ───────────────────────────────────────────────────────────────

test("T4.1 new device, 1st prediction → 200, remainingToday 1, sets rp_did (HttpOnly, SameSite=Lax, path-scoped)", async () => {
  const c = client();
  const { res, status: code, body } = await post(c, neet(121));
  assert.equal(code, 200);
  assert.deepEqual(body.access, { signedIn: false, remainingToday: 1, limit: 2 });
  const set = res.headers.get("set-cookie") ?? "";
  assert.match(set, /^rp_did=[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}; /, "cookie holds only a random id + signature");
  assert.match(set, /; HttpOnly/);
  assert.match(set, /; SameSite=Lax/);
  assert.match(set, /; Path=\/api\/public\/rank-predictor/);
  assert.match(set, /; Max-Age=31536000/);
  assert.doesNotMatch(set, /Secure/, "Secure only in production (see the next test)");
  assert.ok(body.prediction.air, "a real prediction for a visitor");
  assert.equal(body.whatIf.length, 2, "+10 / +20 come in the same response");
});

test("T4.1 rp_did is Secure in production", () => {
  assert.match(limit.deviceCookieHeader("abc.def", { secure: true }), /; Secure$/);
});

test("T4.2 / T4.3 / T4.4 2nd input → 0 left; 3rd different input → 429 login_required; same input again → 200", async () => {
  const c = client();
  assert.equal((await post(c, neet(121))).body.access.remainingToday, 1);
  const second = await post(c, neet(122));
  assert.equal(second.status, 200);
  assert.equal(second.body.access.remainingToday, 0);
  const third = await post(c, neet(123));
  assert.equal(third.status, 429);
  assert.equal(third.body.code, "login_required");
  assert.deepEqual(third.body.access, { signedIn: false, remainingToday: 0, limit: 2 });
  const repeat = await post(c, neet(122));
  assert.equal(repeat.status, 200, "re-submitting an input already checked today is free");
  assert.equal(repeat.body.access.remainingToday, 0);
  // Display-only differences (wrong answers, gender) are the same input.
  const sameAnswer = await post(c, neet(121, { gender: "female", wrong: { physics: 3 } }));
  assert.equal(sameAnswer.status, 200);
});

test("T4.5 23:59 IST → 00:01 IST resets the counter (2 more)", async () => {
  fakeNow = Date.parse("2026-11-11T18:29:00Z"); // 23:59 IST
  const c = client();
  await post(c, neet(101));
  await post(c, neet(102));
  assert.equal((await post(c, neet(103))).status, 429);
  fakeNow = Date.parse("2026-11-11T18:31:00Z"); // 00:01 IST on 12/11
  assert.equal((await post(c, neet(103))).body.access.remainingToday, 1);
  assert.equal((await post(c, neet(104))).body.access.remainingToday, 0);
  assert.equal((await post(c, neet(105))).status, 429);
  fakeNow = Date.parse("2026-11-11T06:00:00Z");
});

test("T4.6 UTC midnight (05:30 IST) → no reset", async () => {
  fakeNow = Date.parse("2026-11-11T23:50:00Z"); // 05:20 IST on 12/11
  const c = client();
  await post(c, neet(111));
  await post(c, neet(112));
  fakeNow = Date.parse("2026-11-12T00:10:00Z"); // UTC day changed; still 12/11 in IST (05:40)
  const after = await post(c, neet(113));
  assert.equal(after.status, 429);
  assert.equal(limit.istDay(Date.parse("2026-11-11T23:50:00Z")), limit.istDay(Date.parse("2026-11-12T00:10:00Z")));
  fakeNow = Date.parse("2026-11-11T06:00:00Z");
});

test("T4.7 valid access JWT (cookie) → unlimited, signedIn true, remainingToday null, no device cookie", async () => {
  const c = client();
  c.headers = { cookie: "origin_access_token=valid-token" };
  for (let i = 0; i < 5; i += 1) {
    const r = await post(c, neet(130 + i));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.access, { signedIn: true, remainingToday: null, limit: null });
    assert.equal(r.res.headers.get("set-cookie"), null);
  }
  assert.deepEqual((await status(c)).body.access, { signedIn: true, remainingToday: null, limit: null });
});

test("T4.8 valid bearer (app) → unlimited", async () => {
  const c = client();
  c.headers = { authorization: "Bearer valid-token" };
  for (let i = 0; i < 4; i += 1) assert.equal((await post(c, neet(140 + i))).body.access.signedIn, true);
});

test("T4.9 expired or forged JWT → treated as a visitor (counted), no 500", async () => {
  const key = Buffer.from(SECRET, "base64url");
  const expired = await new SignJWT({ sid: "s1", role: "student", tokenVersion: 0, fgpHash: "x" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u_x")
    .setIssuer("origin-v1")
    .setAudience("origin-web")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setNotBefore(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .setJti("j1")
    .sign(key);
  const forged = await new SignJWT({ sid: "s1", role: "admin", tokenVersion: 0, fgpHash: "x" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u_admin")
    .setExpirationTime("1h")
    .sign(randomBytes(32));
  for (const token of [expired, forged, "not-a-jwt"]) {
    const variants: Record<string, string>[] = [{ cookie: `origin_access_token=${token}` }, { authorization: `Bearer ${token}` }];
    for (const headers of variants) {
      const c = client();
      c.headers = headers;
      const r = await post(c, neet(150));
      assert.equal(r.status, 200, `${token.slice(0, 10)} ${Object.keys(headers)[0]}`);
      assert.deepEqual(r.body.access, { signedIn: false, remainingToday: 1, limit: 2 });
    }
  }
});

test("T4.10 x-origin-user-id header without a JWT → ignored (counted as a visitor)", async () => {
  const c = client();
  c.headers = { "x-origin-user-id": "u_signed_in", "x-origin-user-role": "admin" };
  await post(c, neet(161));
  await post(c, neet(162));
  const third = await post(c, neet(163));
  assert.equal(third.status, 429);
  assert.equal(third.body.code, "login_required");
});

/** Move the fake clock on by a minute (same IST day), so the per-IP new-device budget refills. */
function nextMinute() {
  fakeNow += 61_000;
}

test("T4.11 cookie cleared every time, same IP → 31st check of the day is 429 (IP backstop 30)", async () => {
  const ip = freshIp();
  for (let i = 0; i < 30; i += 1) {
    if (i > 0 && i % 20 === 0) nextMinute();
    const r = await post(client(ip), neet(10 + i));
    assert.equal(r.status, 200, `check ${i + 1}`);
  }
  const r31 = await post(client(ip), neet(80));
  assert.equal(r31.status, 429);
  assert.equal(r31.body.code, "login_required");
});

test("T4.12 40 devices behind one IP (CGNAT / college Wi-Fi): first 30 checks succeed, not 2", async () => {
  const ip = freshIp();
  const devices = Array.from({ length: 40 }, () => client(ip));
  const results: number[] = [];
  for (const [i, d] of devices.entries()) {
    if (i > 0 && i % 20 === 0) nextMinute(); // devices arrive over a few minutes
    results.push((await post(d, neet(60))).status);
  }
  assert.equal(results.filter((s) => s === 200).length, 30);
  assert.ok(results.slice(0, 30).every((s) => s === 200), "the first 30 go through");
  // A device that already checked keeps seeing its own answer (repeat is free).
  assert.equal((await post(devices[0], neet(60))).status, 200);
});

test("cookie-less flood: 25 POSTs in a minute from one IP → 21st on is 429 slow_down, no counter work, no new cookie", async () => {
  nextMinute();
  const ip = freshIp();
  const statuses: number[] = [];
  let writesBefore = 0;
  for (let i = 0; i < 25; i += 1) {
    if (i === 20) writesBefore = redis.writes;
    const r = await post(client(ip), neet(90 + i));
    statuses.push(r.status);
    if (i >= 20) {
      assert.equal(r.status, 429, `request ${i + 1}`);
      assert.equal(r.body.code, "slow_down");
      assert.equal(r.res.headers.get("retry-after"), "60");
      assert.equal(r.res.headers.get("set-cookie"), null, "no cookie minted for a refused request");
    }
  }
  assert.ok(statuses.slice(0, 20).every((st) => st === 200));
  assert.equal(redis.writes, writesBefore, "the free-check store saw no writes for the refused requests");
});

test("cookie-less limit exhausted on an IP → a device with a valid cookie on the same IP is still served", async () => {
  nextMinute();
  const ip = freshIp();
  const phone = client(ip);
  assert.equal((await post(phone, neet(30))).status, 200); // gets its cookie (1 of 20)
  for (let i = 0; i < 19; i += 1) await post(client(ip), neet(31 + i));
  assert.equal((await post(client(ip), neet(70))).status, 429, "cookie-less budget is spent");
  const again = await post(phone, neet(71));
  assert.equal(again.status, 200, "the phone with a cookie is limited per device, not per IP");
  assert.equal(again.body.access.remainingToday, 0);
});

test("T4.13 burst: 11 requests in 60 s from one device → the 11th is 429 slow_down", async () => {
  const c = client();
  assert.equal((await post(c, neet(170))).status, 200); // first visit: cookie-less, counted per IP
  for (let i = 0; i < 10; i += 1) assert.equal((await post(c, neet(170))).status, 200, `request ${i + 1}`);
  const eleventh = await post(c, neet(170));
  assert.equal(eleventh.status, 429);
  assert.equal(eleventh.body.code, "slow_down");
  assert.equal(eleventh.res.headers.get("retry-after"), "60");
});

test("T4.14 honeypot filled → 200 with a useless body, and the check is counted", async () => {
  const c = client();
  const r = await post(c, { ...neet(180), hp: "https://spam.example" });
  assert.equal(r.status, 200);
  assert.equal(r.body.prediction.air, null);
  assert.equal(r.body.prediction.percentile, null);
  assert.equal(r.body.prediction.categoryRank, null);
  assert.deepEqual(r.body.whatIf, []);
  assert.deepEqual(r.body.prediction.spread, [], "no per-year ranks in the spread text either");
  assert.doesNotMatch(JSON.stringify(r.body), /AIR \d/);
  assert.equal(r.body.access.remainingToday, 1, "counted");
});

test("T4.15 Redis down → fails open on the memory fallback, still predicts and still limits", async () => {
  redis.down = true;
  try {
    const c = client();
    const first = await post(c, neet(190));
    assert.equal(first.status, 200);
    assert.ok(first.body.prediction.air);
    assert.equal(first.body.access.remainingToday, 1);
    await post(c, neet(191));
    assert.equal((await post(c, neet(192))).status, 429, "the per-instance fallback still counts");
    assert.ok(logLines.some((l) => l.includes("free-check store failed; using the in-memory fallback")));
  } finally {
    redis.down = false;
  }
});

test("T4.17 route policy: /rank-predictor public, /rank-predictor/colleges authenticated, API public", () => {
  assert.equal(getAppRoutePolicy("/rank-predictor").kind, "public");
  assert.equal(getAppRoutePolicy("/rank-predictor/").kind, "public");
  assert.equal(getAppRoutePolicy("/rank-predictor/colleges").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/public/rank-predictor").kind, "public");
});

// ─── Extra behaviour ────────────────────────────────────────────────────────

test("GET reports checks left without using one", async () => {
  const c = client();
  assert.deepEqual((await status(c)).body.access, { signedIn: false, remainingToday: 2, limit: 2 });
  await post(c, neet(200));
  assert.equal((await status(c)).body.access.remainingToday, 1);
  assert.equal((await status(c)).body.access.remainingToday, 1, "reading twice changes nothing");
});

test("an invalid body never uses up a check", async () => {
  const c = client();
  const bad = await post(c, { ...neet(210), category: "OBC" });
  assert.equal(bad.status, 400);
  assert.equal((await status(c)).body.access.remainingToday, 2);
});

test("a tampered rp_did is replaced by a new device id", async () => {
  const c = client();
  await post(c, neet(220));
  const [name, value] = (c.cookie ?? "").split("=");
  const tampered = `${name}=${value.slice(0, -2)}xx`;
  c.cookie = tampered;
  const r = await post(c, neet(221));
  assert.notEqual(c.cookie, tampered, "a fresh, correctly signed cookie is set");
  assert.equal(r.status, 200);
});

test("a malformed rp_did cookie is treated as no cookie (fresh id), never a 500", async () => {
  const c = client();
  c.cookie = "rp_did=%E0%A4%A";
  const r = await post(c, neet(25));
  assert.equal(r.status, 200);
  assert.match(c.cookie ?? "", /^rp_did=[A-Za-z0-9_-]{22}\./);
  const bad = client();
  bad.cookie = "rp_did=%E0%A4%A";
  assert.equal((await status(bad)).status, 200);
});

test("an invalid first request still sets the new device cookie", async () => {
  const c = client();
  const r = await post(c, { ...neet(26), category: "OBC" });
  assert.equal(r.status, 400);
  assert.match(r.res.headers.get("set-cookie") ?? "", /^rp_did=/);
});

test("spread text is rounded like the bands (no near-raw per-year anchors)", async () => {
  const r = await post(client(), neet(150, { category: "general", homeState: null }));
  const year = r.body.prediction.spread.find((l: { label: string }) => l.label === "Year spread");
  assert.ok(year, "has a year spread line");
  for (const n of year.text.match(/\d{1,3}(?:,\d{2,3})+|\d{3,}/g) ?? []) {
    const v = Number(n.replace(/,/g, ""));
    if (v >= 2000 && v < 2100) continue; // a year
    assert.equal(v % 10, 0, `${n} is rounded`);
  }
});

test("expired access token + refresh cookie → 401 session_refresh (no check used); with x-rp-anonymous → visitor", async () => {
  const c = client();
  c.headers = { cookie: "origin_refresh_token=r.some-refresh" };
  const r = await post(c, neet(230));
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "session_refresh");
  c.headers = { cookie: "origin_refresh_token=r.some-refresh", "x-rp-anonymous": "1" };
  const anon = await post(c, neet(230));
  assert.equal(anon.status, 200);
  assert.equal(anon.body.access.remainingToday, 1);
});

test("flag off → POST and GET answer 404 feature_off", async () => {
  flagOn = false;
  try {
    const c = client();
    for (const r of [await post(c, neet(240)), await status(c)]) {
      assert.equal(r.status, 404);
      assert.equal(r.body.code, "feature_off");
    }
  } finally {
    flagOn = true;
  }
});

test("parallel different inputs on a fresh device → exactly 2 allowed (add-then-check)", async () => {
  const s = limit.createMemoryCheckStore(() => fakeNow);
  const keys = (inputHash: string) => ({ day: "2026-11-11", deviceId: "d1", ipHash: "ip1", inputHash });
  const decisions = await Promise.all(["a", "b", "c", "d"].map((h) => limit.chargeFreeCheck(s, keys(h))));
  assert.equal(decisions.filter((d) => d.allowed).length, 2);
});

test("hashes: keyed, stable, and blind to display-only fields", () => {
  const key = limit.limitKey({ AUTH_JWT_SECRET_CURRENT: SECRET });
  const base = { exam: "neet" as const, marks: { physics: 1, chemistry: 2, biology: 3 }, category: "general" as const, pwd: false, homeState: null, jeeMainShift: null };
  assert.equal(limit.hashInput(base, key), limit.hashInput({ ...base, wrong: { physics: 2 }, gender: "female" } as never, key));
  assert.notEqual(limit.hashInput(base, key), limit.hashInput({ ...base, category: "sc" }, key));
  assert.notEqual(limit.hashInput(base, key), limit.hashInput(base, limit.limitKey({ AUTH_JWT_SECRET_CURRENT: "another-secret" })));
  assert.doesNotMatch(limit.hashIp("203.0.113.77", key), /203|113|77\b/);
  assert.equal(limit.verifyDeviceCookie(limit.signDeviceId("A".repeat(22), key), key), "A".repeat(22));
  assert.equal(limit.verifyDeviceCookie(limit.signDeviceId("A".repeat(22), key), limit.limitKey({ AUTH_JWT_SECRET_CURRENT: "x" })), null);
});

test("Redis keys carry the IST day and a 36 h TTL; members are hashes only", async () => {
  const c = client("203.0.113.77");
  await post(c, neet(250));
  const keys = [...redis.sets.keys()].filter((k) => k.startsWith("rp:anon:"));
  assert.ok(keys.length > 0);
  for (const k of keys) {
    assert.match(k, /^rp:anon:\d{4}-\d{2}-\d{2}:(dev|ip):[A-Za-z0-9_:-]+$/);
    assert.equal(redis.ttl.get(k), 36 * 60 * 60);
    assert.ok(!k.includes("203.0.113.77"));
  }
  const everything = JSON.stringify([...redis.sets.entries()].map(([k, v]) => [k, [...v]]));
  for (const secret of ["203.0.113.77", "Karnataka", "obc-ncl", "301", "134"]) assert.ok(!everything.includes(secret), secret);
});

// T4.16 last: every log line written during this file.
test("T4.16 logs: no marks, category, PwD, state or raw IP in any captured log line", async () => {
  // One more full pass with distinctive values, Redis down so the degraded path logs too.
  redis.down = true;
  try {
    const c = client("203.0.113.77");
    await post(c, { exam: "neet", marks: { physics: 177, chemistry: 166, biology: 355 }, category: "sc", pwd: true, homeState: "Tamil Nadu" });
  } finally {
    redis.down = false;
  }
  assert.ok(logLines.length > 0, "logs were captured");
  const all = logLines.join("\n");
  for (const needle of ["203.0.113.77", "198.51.100.", "Karnataka", "Tamil Nadu", "obc-ncl", '"sc"', "pwd", "177", "355", "301"]) {
    assert.ok(!all.includes(needle), `log contains ${needle}`);
  }
});

test("privacy grep: the route uses the raw IP only inside hashIp(...)", () => {
  const src = readFileSync(join(__dirname, "../../../src/app/api/public/rank-predictor/route.ts"), "utf8");
  const uses = src.match(/clientIp\(request\)/g) ?? [];
  const hashed = src.match(/hashIp\(clientIp\(request\), key\)/g) ?? [];
  assert.equal(uses.length, hashed.length);
  assert.doesNotMatch(src, /console\.(log|info|warn|error|debug)/, "the route logs nothing itself");
});
