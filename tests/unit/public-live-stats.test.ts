import test from "node:test";
import assert from "node:assert/strict";

import {
  getPublicLiveStats,
  LIVE_STATS_CACHE_KEY,
  type LiveStatsRedis,
} from "../../src/server/public-live-stats";
import { createPostgresPoolConfig } from "../../src/server/postgres-config";

type G = Record<string, unknown>;
const g = globalThis as unknown as G;

/** Installs fake user + OGCode pools via their globalThis slots; counts queries. */
function installFakePools() {
  const counts = { user: 0, ogcode: 0 };
  const userUrl = "postgres://fake:fake@127.0.0.1:1/fake_livestats";
  process.env.USER_DATABASE_URL = userUrl;
  process.env.OGCODE_DATABASE_URL = "postgres://fake:fake@127.0.0.1:1/fake_ogcode";
  g.__originUserPool = {
    query: async () => {
      counts.user += 1;
      return { rows: [{ count: "7" }] };
    },
    end: async () => undefined,
  };
  g.__originUserPoolConnectionString = createPostgresPoolConfig(userUrl, 25).connectionString;
  g.__originOgcodePool = {
    query: async () => {
      counts.ogcode += 1;
      return { rows: [{ total: "42" }] };
    },
    end: async () => undefined,
  };
  return counts;
}

function reset() {
  g.__originLiveStatsMemo = undefined;
  g.__originLiveStatsInflight = undefined;
  g.__originLiveStatsRedis = undefined;
}

test.afterEach(reset);

test("without Redis: aggregates run once per 30 s per instance (in-process memo)", async () => {
  const counts = installFakePools();
  g.__originLiveStatsRedis = null;
  const t0 = 1_000_000;
  const first = await getPublicLiveStats(t0);
  assert.deepEqual({ q: first.questionsSolved, s: first.streaksActive }, { q: 42, s: 7 });
  await getPublicLiveStats(t0 + 10_000);
  await getPublicLiveStats(t0 + 29_000);
  assert.deepEqual(counts, { user: 1, ogcode: 1 });
  await getPublicLiveStats(t0 + 31_000);
  assert.deepEqual(counts, { user: 2, ogcode: 2 }, "recomputed after the 30 s TTL");
});

test("without Redis: concurrent misses share one computation", async () => {
  const counts = installFakePools();
  g.__originLiveStatsRedis = null;
  await Promise.all(Array.from({ length: 20 }, () => getPublicLiveStats(5_000_000)));
  assert.deepEqual(counts, { user: 1, ogcode: 1 });
});

test("with Redis: a hit skips Postgres; a miss computes and stores with a 30 s TTL", async () => {
  const counts = installFakePools();
  const store = new Map<string, unknown>();
  const sets: Array<{ key: string; ex: number }> = [];
  const redis: LiveStatsRedis = {
    get: async <T,>(key: string) => (store.get(key) as T) ?? null,
    set: async (key, value, opts) => {
      store.set(key, value);
      sets.push({ key, ex: opts.ex });
      return "OK";
    },
  };
  g.__originLiveStatsRedis = redis;

  await getPublicLiveStats();
  assert.deepEqual(sets, [{ key: LIVE_STATS_CACHE_KEY, ex: 30 }]);
  assert.deepEqual(counts, { user: 1, ogcode: 1 });

  const hit = await getPublicLiveStats();
  assert.equal(hit.questionsSolved, 42);
  assert.deepEqual(counts, { user: 1, ogcode: 1 }, "Redis hit runs no aggregate");
});

test("with a failing Redis: degrades to the in-process memo instead of throwing", async () => {
  const counts = installFakePools();
  g.__originLiveStatsRedis = {
    get: async () => {
      throw new Error("redis down");
    },
    set: async () => "OK",
  } satisfies LiveStatsRedis;
  await getPublicLiveStats(9_000_000);
  await getPublicLiveStats(9_000_500);
  assert.deepEqual(counts, { user: 1, ogcode: 1 });
});
