/**
 * Cached contest window (status + schedule) for hot-path gates (bug-fix C2,
 * reused by the C4 write-deadline gate). At start_at every student hits
 * `/api/contest/paper` within seconds; resolving the contest state there must
 * not cost one Neon read per request.
 *
 * Read path: in-process (15 s) → Redis `contest:{id}:window` (60 s) → Postgres.
 * The window only changes on an admin/pipeline status or schedule write, which
 * calls `invalidateContestWindow` after its commit. LIVE/ENDED are derived from
 * the clock against these cached instants, so the cache never needs to "tick"
 * for them.
 *
 * Write-back race (review L4): a reader that loaded the OLD row just before an
 * admin write could SET it back into Redis after the admin's DEL, serving the
 * old window for another 60 s. Invalidation therefore also bumps a generation
 * counter (`contest:{id}:window:gen`); a reader notes the generation BEFORE its
 * DB read and only writes back (atomically, in Lua) if it is unchanged. Other
 * instances' in-process copies still live up to WINDOW_LOCAL_TTL_MS.
 */

import { Redis } from "@upstash/redis";

import type { ContestStatus, ContestWindow } from "@/lib/contest/contest-state";
import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

/** JSON-safe window (ISO strings) — what is cached in-process and in Redis. */
export interface CachedWindow {
  status: ContestStatus;
  startAt: string | null;
  endAt: string | null;
  regOpen: string | null;
  regClose: string | null;
}

/** The subset of the Upstash client this cache uses (lets tests inject a fake). */
export interface WindowCacheRedis {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<unknown>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

let redis: WindowCacheRedis | null =
  redisUrl && redisToken
    ? (new Redis({ url: redisUrl, token: redisToken }) as unknown as WindowCacheRedis)
    : null;

export const WINDOW_LOCAL_TTL_MS = 15_000;
export const WINDOW_REDIS_TTL_SECONDS = 60;

const localWindowCache = new Map<string, { window: CachedWindow; expiresAt: number }>();

function windowKey(contestId: string): string {
  return `contest:${contestId}:window`;
}

function windowGenKey(contestId: string): string {
  return `contest:${contestId}:window:gen`;
}

/** SET the window only if no invalidation happened since the reader noted `gen`. */
export const SET_WINDOW_IF_GEN_SCRIPT = `
local cur = redis.call('GET', KEYS[2])
if (cur or '0') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

function iso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseCached(raw: unknown): CachedWindow | null {
  if (!raw) return null;
  try {
    const obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<CachedWindow>;
    if (!obj || typeof obj.status !== "string") return null;
    return {
      status: obj.status as ContestStatus,
      startAt: obj.startAt ?? null,
      endAt: obj.endAt ?? null,
      regOpen: obj.regOpen ?? null,
      regClose: obj.regClose ?? null,
    };
  } catch {
    return null;
  }
}

async function loadWindowFromDb(contestId: string): Promise<CachedWindow | null> {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  await ensureContestSchema();
  const res = await p.query(
    `SELECT status, reg_open, reg_close, start_at, end_at FROM contest.contests WHERE id = $1`,
    [contestId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    status: row.status as ContestStatus,
    regOpen: iso(row.reg_open),
    regClose: iso(row.reg_close),
    startAt: iso(row.start_at),
    endAt: iso(row.end_at),
  };
}

/**
 * The contest's status + schedule, or `null` when the contest does not exist.
 * Redis errors degrade to the DB read; a missing contest is not negatively
 * cached (it is an unusual path, and a just-created contest must appear).
 */
export async function getContestWindow(contestId: string): Promise<CachedWindow | null> {
  const now = Date.now();
  const local = localWindowCache.get(contestId);
  if (local && local.expiresAt > now) return local.window;

  if (redis) {
    try {
      const cached = parseCached(await redis.get(windowKey(contestId)));
      if (cached) {
        localWindowCache.set(contestId, { window: cached, expiresAt: now + WINDOW_LOCAL_TTL_MS });
        return cached;
      }
    } catch {
      /* fall through to Postgres */
    }
  }

  // Note the invalidation generation BEFORE reading the row (see header).
  let gen: string | null = null;
  if (redis) {
    try {
      gen = String((await redis.get(windowGenKey(contestId))) ?? "0");
    } catch {
      gen = null; // can't prove freshness → don't write back
    }
  }

  const window = await loadWindowFromDb(contestId);
  if (!window) return null;
  localWindowCache.set(contestId, { window, expiresAt: Date.now() + WINDOW_LOCAL_TTL_MS });
  if (redis && gen !== null) {
    try {
      await redis.eval(
        SET_WINDOW_IF_GEN_SCRIPT,
        [windowKey(contestId), windowGenKey(contestId)],
        [gen, JSON.stringify(window), String(WINDOW_REDIS_TTL_SECONDS)],
      );
    } catch {
      /* advisory */
    }
  }
  return window;
}

/**
 * Other in-process caches DERIVED from the window (e.g. a write-deadline gate's
 * own copy) register here so one `invalidateContestWindow` call clears them
 * too — otherwise an admin ending or cancelling a contest early leaves that
 * copy saying "open" until its own TTL. Returns an unsubscribe function.
 */
const invalidationListeners = new Set<(contestId: string) => void>();

export function onContestWindowInvalidated(listener: (contestId: string) => void): () => void {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}

/**
 * Drop the cached window after any status/schedule write (call it AFTER the
 * commit) — EVERY admin/pipeline path that writes `status`, `start_at`,
 * `end_at`, `reg_open` or `reg_close` must call it (pinned by a unit test).
 * Clears this instance's copy, every registered derived cache, and Redis.
 * Other lambdas keep their in-process copy for at most WINDOW_LOCAL_TTL_MS.
 */
export async function invalidateContestWindow(contestId: string): Promise<void> {
  localWindowCache.delete(contestId);
  for (const listener of invalidationListeners) {
    try {
      listener(contestId);
    } catch {
      /* one bad listener must not stop the invalidation */
    }
  }
  if (!redis) return;
  try {
    // Bump the generation first so an in-flight reader holding the old row
    // can no longer write it back, then drop the cached window.
    await redis.incr(windowGenKey(contestId));
  } catch {
    /* advisory */
  }
  try {
    await redis.del(windowKey(contestId));
  } catch {
    /* advisory — expires on its own TTL */
  }
}

/** Dates for the pure state machine in `@/lib/contest/contest-state`. */
export function toContestWindow(w: CachedWindow): ContestWindow {
  const d = (v: string | null): Date | null => {
    if (!v) return null;
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  return {
    status: w.status,
    regOpen: d(w.regOpen),
    regClose: d(w.regClose),
    startAt: d(w.startAt),
    endAt: d(w.endAt),
  };
}

/** Test-only: inject a fake Redis (or `null`) and clear the in-process cache. */
export function __setWindowCacheRedisForTests(fake: WindowCacheRedis | null): void {
  redis = fake;
  localWindowCache.clear();
}

/** Test-only: clear the in-process cache. */
export function __resetWindowCacheForTests(): void {
  localWindowCache.clear();
}
