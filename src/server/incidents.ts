/**
 * Phase 13 incident controls — runtime overrides backed by Redis.
 *
 * Provides:
 *  - kill-switch for any FeatureKey (overrides env flag, takes effect
 *    within the cache TTL — default 5 s on Node handlers, 30 s plus one
 *    Redis read in the Edge middleware);
 *  - rate-limit mode (`relaxed | normal | strict | lockdown`) that the
 *    mutation limiter middleware reads;
 *  - force-logout-user via dbIncrementAuthTokenVersionAndRevokeSessions;
 *  - workspace close via the existing admin service.
 *
 * Every mutating call here also writes one app.audit_events row so the
 * incident is reconstructable. The admin UI lives at /admin/incidents.
 *
 * Storage shape (Redis, when configured — process memory otherwise):
 *  - `incident:flag:<flagKey>` → "on" | "off" (string) — null = no override
 *  - `incident:rate-limit-mode` → one of RateLimitMode (string)
 *
 * Two readers share one per-process snapshot:
 *  - Node callers (admin pages, route handlers) use the blocking loader —
 *    Redis is a few ms away from iad1, so they keep the short TTL;
 *  - the Edge middleware (bom1, far from Upstash) uses
 *    `getIncidentStateNonBlocking`: it serves the cached snapshot right away
 *    and refreshes it in the background (stale-while-revalidate), so no
 *    student request waits on a Mumbai → US round trip for it.
 * Either way at most one refresh runs per process at a time, and it is
 * time-limited, so a hung Upstash call can never pin it.
 *
 * The read is ONE MGET of every known flag key plus the mode key — no KEYS
 * scan (which walks the whole keyspace, rate-limit keys included) and no
 * second dependent round trip when a flag is set. Every writer goes through
 * `setFlagOverride(flag: FlagKey)`, so the known keys are all there is.
 *
 * Falls back to in-memory state when Redis is not configured (dev/CI).
 * In production, missing Redis means incidents do not propagate across
 * pods — flagged on first read with a one-shot console error.
 */

import { unstable_rethrow } from "next/navigation";
import { Redis } from "@upstash/redis";

import { ALL_FLAG_KEYS, type FlagKey } from "@/lib/feature-flags";
import { metric } from "@/lib/metrics";

const FLAG_KEY_PREFIX = "incident:flag:";
const RATE_LIMIT_KEY = "incident:rate-limit-mode";

export type RateLimitMode = "relaxed" | "normal" | "strict" | "lockdown";

const RATE_LIMIT_MODES: RateLimitMode[] = ["relaxed", "normal", "strict", "lockdown"];

export const RATE_LIMIT_MODE_DESCRIPTIONS: Record<RateLimitMode, string> = {
  relaxed: "2x the normal mutation budget — incidents that need elevated capacity (post-recovery clears).",
  normal: "Default: respects ORIGIN_MUTATION_RATE_LIMIT.",
  strict: "0.5x the normal mutation budget — sustained abuse, partial degradation.",
  lockdown: "0 mutations — emergency stop. /api/teacher, /api/admin, /api/enrollments writes are refused.",
};

type Snapshot = {
  flagOverrides: Map<FlagKey, boolean>;
  rateLimitMode: RateLimitMode;
  fetchedAt: number;
};

function envMs(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Freshness window for the blocking (Node) readers: admin pages,
 * requireFeatureEnabledRuntime, the handler-side lockdown gate. Redis is a
 * few ms away from iad1, so these keep the short TTL. */
const SNAPSHOT_TTL_MS = envMs("INCIDENT_SNAPSHOT_TTL_MS", 5_000);

/** Freshness window for the Edge middleware's stale-while-revalidate read.
 * Longer, because there a refresh is a Mumbai → US round trip; a stale
 * snapshot is still served while the refresh runs in the background. */
const EDGE_SNAPSHOT_TTL_MS = envMs("INCIDENT_EDGE_SNAPSHOT_TTL_MS", 30_000);

/** Past this age the Edge reader no longer serves the stale snapshot right
 * away (an isolate that sat idle for minutes): it waits for the refresh like
 * a cold isolate, up to `coldWaitMs`, and only then falls back to it. */
const EDGE_MAX_STALE_MS = 4 * EDGE_SNAPSHOT_TTL_MS;

/** How long the Edge reader waits for a Redis read when it has no snapshot
 * (brand-new isolate) or only a too-old one. The read is one MGET, ~200 ms
 * from bom1, but a fresh isolate also opens the TLS connection first (one or
 * two more round trips), so 700 ms lets cold isolates get the real state —
 * including an active kill — while capping a slow or hung Redis. When it
 * times out the refresh keeps running in the background. */
const COLD_SNAPSHOT_WAIT_MS = 700;

/** Upper bound for one snapshot refresh. Past it the refresh counts as a
 * Redis error (last known state kept) and the shared in-flight slot clears,
 * so the next refresh can start once Redis recovers. */
const SNAPSHOT_READ_TIMEOUT_MS = 2_000;

/** Upper bound for any single Upstash command issued here, retries
 * included: @upstash/redis has no default timeout (5 retries, and fetch can
 * wait minutes on headers), so a hung call is aborted instead of lingering. */
const REDIS_REQUEST_TIMEOUT_MS = 5_000;

/** The Redis calls this module makes (structural, so tests can inject a fake). */
type IncidentRedis = {
  mget<TData extends unknown[]>(...keys: string[]): Promise<TData>;
  set(key: string, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
let redis: IncidentRedis | null =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken, signal: () => AbortSignal.timeout(REDIS_REQUEST_TIMEOUT_MS) })
    : null;
let readTimeoutMs = SNAPSHOT_READ_TIMEOUT_MS;

/** Every key the snapshot reads, in one MGET: the flag keys, then the mode. */
const SNAPSHOT_KEYS = [...ALL_FLAG_KEYS.map((flag) => `${FLAG_KEY_PREFIX}${flag}`), RATE_LIMIT_KEY];

const memory = {
  flagOverrides: new Map<FlagKey, boolean>(),
  rateLimitMode: "normal" as RateLimitMode,
};

let snapshot: Snapshot | null = null;
/** The one refresh running in this process, shared by every caller. */
let inflight: Promise<Snapshot> | null = null;
/** Bumped by every local write: a refresh that started before the write must
 * not overwrite the state the writer just invalidated. */
let generation = 0;
let warnedMissingRedis = false;

function warnRedisMissingOnce() {
  if (warnedMissingRedis) return;
  warnedMissingRedis = true;
  if (process.env.NODE_ENV === "production") {
    console.error("[incidents] UPSTASH_REDIS_REST_URL/TOKEN missing — incident controls are pod-local only.");
    metric("origin.incidents.degraded", { reason: "missing_redis" });
  }
}

function parseRateLimitMode(raw: unknown): RateLimitMode {
  if (typeof raw !== "string") return "normal";
  return RATE_LIMIT_MODES.includes(raw as RateLimitMode) ? (raw as RateLimitMode) : "normal";
}

function emptySnapshot(fetchedAt: number): Snapshot {
  return { flagOverrides: new Map(), rateLimitMode: "normal", fetchedAt };
}

function ageOf(s: Snapshot): number {
  return Date.now() - s.fetchedAt;
}

async function fetchSnapshot(): Promise<Snapshot> {
  if (!redis) {
    warnRedisMissingOnce();
    return {
      flagOverrides: new Map(memory.flagOverrides),
      rateLimitMode: memory.rateLimitMode,
      fetchedAt: Date.now(),
    };
  }
  // One round trip whether or not a flag is set (see the header comment).
  const values = await redis.mget<unknown[]>(...SNAPSHOT_KEYS);
  const overrides = new Map<FlagKey, boolean>();
  ALL_FLAG_KEYS.forEach((flag, i) => {
    const v = values?.[i];
    if (v === "on") overrides.set(flag, true);
    else if (v === "off") overrides.set(flag, false);
  });
  return {
    flagOverrides: overrides,
    rateLimitMode: parseRateLimitMode(values?.[ALL_FLAG_KEYS.length]),
    fetchedAt: Date.now(),
  };
}

/** Rejects when `promise` has not settled within `ms`. The timer is always
 * cleared, so nothing keeps the process (or the Edge isolate) alive. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`incident snapshot read timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Starts a refresh, or joins the one already running. Never leaves the old
 * snapshot half-updated: on a Redis error or timeout the last known state is
 * kept (and re-dated, so the next retry waits one TTL instead of hammering
 * Redis). Always settles within `readTimeoutMs`, so `inflight` always clears. */
function refreshSnapshot(): Promise<Snapshot> {
  if (inflight) return inflight;
  const startedAt = generation;
  const run = (async (): Promise<Snapshot> => {
    let next: Snapshot;
    try {
      next = await withTimeout(fetchSnapshot(), readTimeoutMs);
    } catch (err) {
      // Same reason as launch-settings: a DynamicServerError thrown during static
      // prerendering is Next.js control flow, not a Redis outage. Counting it as
      // one also fired a false `origin.incidents.degraded` metric on every build.
      unstable_rethrow(err);
      console.error("[incidents] failed to load snapshot from Redis; using last known state", err);
      metric("origin.incidents.degraded", { reason: "redis_error" });
      next = snapshot ? { ...snapshot, fetchedAt: Date.now() } : emptySnapshot(Date.now());
    }
    if (startedAt === generation) snapshot = next;
    return next;
  })();
  inflight = run;
  // `finally` on its own would re-reject; the callers handle the rejection.
  run.then(
    () => { if (inflight === run) inflight = null; },
    () => { if (inflight === run) inflight = null; },
  );
  return run;
}

/** Blocking read for Node callers (admin pages, route handlers). */
async function loadSnapshot(): Promise<Snapshot> {
  if (snapshot && ageOf(snapshot) < SNAPSHOT_TTL_MS) return snapshot;
  return refreshSnapshot();
}

/** What the Edge middleware needs from the snapshot. */
export type IncidentState = {
  flagOverrides: ReadonlyMap<FlagKey, boolean>;
  rateLimitMode: RateLimitMode;
};

/** Non-blocking read for the Edge middleware (stale-while-revalidate).
 *
 *  - fresh snapshot (younger than the edge TTL) → returned as is, no Redis call;
 *  - stale snapshot → returned as is; one background refresh is started (or
 *    joined) and handed to `waitUntil` so the isolate stays alive for it;
 *  - no snapshot yet (brand-new isolate), or one older than
 *    EDGE_MAX_STALE_MS (the isolate sat idle) → waits up to `coldWaitMs` for
 *    the read, then answers with what it has: the old snapshot, or for a
 *    brand-new isolate the default (no overrides, "normal") — the same
 *    fail-open default a Redis error has always produced — while the read
 *    finishes in the background.
 *
 * Never rejects. */
export async function getIncidentStateNonBlocking(
  options: { waitUntil?: (promise: Promise<unknown>) => void; coldWaitMs?: number } = {},
): Promise<IncidentState> {
  if (snapshot && ageOf(snapshot) < EDGE_SNAPSHOT_TTL_MS) return snapshot;
  const settled = refreshSnapshot().catch((err: unknown) => {
    console.error("[incidents] background snapshot refresh failed", err);
    return null;
  });
  options.waitUntil?.(settled);
  if (snapshot && ageOf(snapshot) <= EDGE_MAX_STALE_MS) return snapshot;

  const previous = snapshot;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), options.coldWaitMs ?? COLD_SNAPSHOT_WAIT_MS);
  });
  const first = await Promise.race([settled, timedOut]);
  clearTimeout(timer);
  if (first) return first;
  // Timed out. Park what we have (the old snapshot, or the default) dated as
  // stale-but-recent, so the next requests on this isolate do not wait again
  // while the read is running; the refresh replaces it as soon as Redis
  // answers, or re-dates it when the read fails or times out.
  if (snapshot === previous) {
    snapshot = { ...(previous ?? emptySnapshot(0)), fetchedAt: Date.now() - EDGE_SNAPSHOT_TTL_MS };
  }
  return snapshot ?? emptySnapshot(0);
}

/** Force-refresh the in-process snapshot — called after a mutation so
 * the actor sees their own change immediately, instead of waiting for
 * the cache TTL to expire. */
function invalidateSnapshot() {
  generation += 1;
  snapshot = null;
  inflight = null;
}

/** Test-only: inject a fake Redis (or `null` for the in-memory path) and drop
 * the cached snapshot. `readTimeoutMs` overrides the refresh time limit
 * (back to the default when omitted). */
export function __setIncidentRedisForTests(fake: IncidentRedis | null, options: { readTimeoutMs?: number } = {}): void {
  redis = fake;
  readTimeoutMs = options.readTimeoutMs ?? SNAPSHOT_READ_TIMEOUT_MS;
  invalidateSnapshot();
}

export async function getFlagOverride(flag: FlagKey): Promise<boolean | null> {
  const s = await loadSnapshot();
  if (s.flagOverrides.has(flag)) return s.flagOverrides.get(flag)!;
  return null;
}

export async function getRateLimitMode(): Promise<RateLimitMode> {
  const s = await loadSnapshot();
  return s.rateLimitMode;
}

export async function setFlagOverride(flag: FlagKey, value: "on" | "off" | "clear"): Promise<void> {
  if (redis) {
    if (value === "clear") await redis.del(`${FLAG_KEY_PREFIX}${flag}`);
    else await redis.set(`${FLAG_KEY_PREFIX}${flag}`, value);
  } else {
    if (value === "clear") memory.flagOverrides.delete(flag);
    else memory.flagOverrides.set(flag, value === "on");
  }
  invalidateSnapshot();
}

export async function setRateLimitMode(mode: RateLimitMode): Promise<void> {
  if (redis) await redis.set(RATE_LIMIT_KEY, mode);
  else memory.rateLimitMode = mode;
  invalidateSnapshot();
}

export async function getIncidentSnapshot(): Promise<{
  flagOverrides: Record<string, boolean>;
  rateLimitMode: RateLimitMode;
  redisConfigured: boolean;
  /** Freshness window of the Node (route handler) readers. */
  snapshotTtlMs: number;
  /** Freshness window of the Edge middleware's stale-while-revalidate read. */
  edgeSnapshotTtlMs: number;
}> {
  const s = await loadSnapshot();
  return {
    flagOverrides: Object.fromEntries(s.flagOverrides),
    rateLimitMode: s.rateLimitMode,
    redisConfigured: redis !== null,
    snapshotTtlMs: SNAPSHOT_TTL_MS,
    edgeSnapshotTtlMs: EDGE_SNAPSHOT_TTL_MS,
  };
}

/** Mutation-limiter multiplier in effect for the current rate-limit
 * mode. The limiter middleware divides its base cap by this multiplier:
 * relaxed=0.5 → 2x cap; strict=2 → 0.5x cap; lockdown=Infinity → 0
 * effective requests. */
export function rateLimitDivisor(mode: RateLimitMode): number {
  switch (mode) {
    case "relaxed": return 0.5;
    case "normal":  return 1;
    case "strict":  return 2;
    case "lockdown": return Number.POSITIVE_INFINITY;
  }
}

/** True when the rate-limit mode is "lockdown" — the mutation limiter
 * should reject every request before consulting Redis. */
export function isLockdown(mode: RateLimitMode): boolean {
  return mode === "lockdown";
}

/** A path matcher used by the kill-switch table.
 *
 * `string[]` — list of literal path prefixes; a path matches when it
 * `startsWith` any prefix.
 *
 * `(path: string) => boolean` — caller-supplied predicate. Used when a
 * prefix list would over-match. Audit fix R-6 (A-18): documentImport
 * used to list `/api/teacher/workspaces` as a prefix, which meant
 * killing the flag also took down questions/tests/rooms — surfaces
 * that have no relationship to document import. The function matcher
 * lets us scope it to just the `/import-jobs` segment. */
export type FlagKillMatcher = string[] | ((path: string) => boolean);

/** Map of FlagKey → matcher describing API surfaces refused (503) by the
 * middleware when the flag is killed via /admin/incidents. The middleware
 * evaluates this for EVERY /api request — all methods, public/anonymous
 * prefixes included — before any policy branch. Killing a flag without an
 * entry here only affects handlers that call requireFeatureEnabledRuntime()
 * (src/server/feature-flags-runtime.ts) or getFlagOverride() directly. */
export const FLAG_KILL_PREFIXES: Partial<Record<FlagKey, FlagKillMatcher>> = {
  workspaces: ["/api/teacher/workspaces"],
  orgCodes: ["/api/teacher/codes", "/api/teacher/workspaces"],
  enrollment: ["/api/enrollments"],
  batches: ["/api/teacher/workspaces"],
  questionBag: ["/api/teacher/workspaces"],
  teacherTests: ["/api/teacher/workspaces"],
  teacherRooms: ["/api/teacher/workspaces"],
  studyMaterials: ["/api/teacher/workspaces"],
  teacherAnalytics: ["/api/teacher/workspaces"],
  ogcodePublishing: ["/api/teacher/workspaces", "/api/admin/ogcode"],
  // Audit fix R-6 (A-18): scope to the import-jobs segment only.
  // Matches `/api/teacher/workspaces/<id>/import-jobs[/...]` and
  // `/api/admin/import-jobs[/...]` and nothing else.
  documentImport: (path) =>
    /^\/api\/teacher\/workspaces\/[^/]+\/import-jobs(?:\/|$)/.test(path) ||
    /^\/api\/admin\/import-jobs(?:\/|$)/.test(path),
  // Matches every admin API except the exempt operator surfaces
  // (KILL_SWITCH_EXEMPT_PREFIXES): /api/admin/incidents/* must survive its
  // own kill so the switch can be turned back off.
  adminControlCenter: ["/api/admin"],
  paidEnrollment: ["/api/enrollments"],
  // Killing cbtModule refuses every CBT API surface, including the anonymous
  // student one: /api/cbt-student is `public` in the route policy, which is
  // why the middleware runs this check before the public branch returns.
  // "/api/cbt" already matches "/api/cbt-student" (startsWith), but both are
  // listed for clarity; the admin allowlist routes live under "/api/admin/cbt".
  cbtModule: ["/api/cbt", "/api/cbt-student", "/api/admin/cbt"],
  // Killing `contest` refuses (503) every STUDENT contest surface, reads
  // included (register / paper / start / submit / answers / state / result /
  // leaderboard / practice / dpp).
  // Deliberately scoped so it does NOT match `/api/internal/contest/*` — the
  // drain/finalize/publish-results/reminders crons must keep running during an
  // incident so buffered answers still persist to Neon and don't expire in
  // Redis. It also leaves `/api/admin/contest/*` alive so an admin can still
  // cancel/reschedule the live contest to stop the bleeding.
  contest: ["/api/contest"],
  // Killing `originNow` refuses (503) every student/helper Origin NOW call,
  // reads included (requests, offers, joins, ratings, wallet, store). It deliberately leaves
  // /api/internal/now/* running so timers still end live sessions and release
  // coin holds, and /api/admin/now/* alive so an admin can still act. The
  // LiveKit token route is a POST (/api/now/sessions/:id/token) precisely so
  // this edge switch covers it; calls already live are ended by the timers.
  originNow: ["/api/now"],
  // Killing `studentMessaging` refuses (503) every messaging call from the app
  // and the website, reads included. Nothing else lives under these prefixes.
  // /api/admin/messaging/* stays up so admins can still work the reports.
  studentMessaging: ["/api/mobile/messages", "/api/messages"],
  // Killing `rankPredictor` refuses (503) the prediction endpoint and the
  // signed-in "fill from my tests" reads. Nothing else lives under these.
  rankPredictor: ["/api/public/rank-predictor", "/api/assessments/rank-predictor"],
  // Killing `collegeCounselling` refuses (503) the college finder's search and
  // meta reads. Nothing else lives under this prefix.
  collegeCounselling: ["/api/assessments/counselling"],
};

/**
 * API surfaces that no kill switch may ever refuse, whatever the matcher
 * says. `/api/admin/incidents/*` carries the un-kill POST itself: with
 * `adminControlCenter: ["/api/admin"]` killed, the operator's
 * `kill_switch { value: "clear" }` answered 503 and the only way back was
 * editing Redis by hand. `/api/admin/launch` is the other operator control
 * surface (login/signup/cover toggles) and stays reachable for the same reason.
 */
export const KILL_SWITCH_EXEMPT_PREFIXES: readonly string[] = ["/api/admin/incidents", "/api/admin/launch"];

export function isKillSwitchExemptPath(pathname: string): boolean {
  return KILL_SWITCH_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function matchKillSwitch(matcher: FlagKillMatcher, pathname: string): boolean {
  if (typeof matcher === "function") return matcher(pathname);
  return matcher.some((p) => pathname.startsWith(p));
}

/** Returns the first FlagKey killed by an incident override that
 * applies to the given API path, or null when none. Used by middleware
 * to refuse traffic with 503 + a structured payload. */
export async function findKillSwitchForPath(pathname: string): Promise<FlagKey | null> {
  if (isKillSwitchExemptPath(pathname)) return null;
  return killSwitchForPath(await loadSnapshot(), pathname);
}

/** `findKillSwitchForPath` against an already-read state (the middleware's
 * non-blocking snapshot). */
export function killSwitchForPath(state: IncidentState, pathname: string): FlagKey | null {
  if (isKillSwitchExemptPath(pathname)) return null;
  for (const [flag, killed] of state.flagOverrides) {
    if (killed !== false) continue;
    const matcher = FLAG_KILL_PREFIXES[flag as FlagKey];
    if (!matcher) continue;
    if (matchKillSwitch(matcher, pathname)) {
      return flag as FlagKey;
    }
  }
  return null;
}
