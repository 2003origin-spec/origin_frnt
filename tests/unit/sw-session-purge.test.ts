/**
 * Runtime page/RSC caches hold the signed-in viewer's data. The purge used on
 * logout, login, session expiry and account deletion must drop them while
 * keeping the neutral offline precache.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { purgeUserCachesForLogout } from "@/sw/client";

test("purge drops origin-rt-* runtime caches and keeps the precache", async () => {
  const names = new Set(["origin-rt-pages", "origin-rt-rsc", "origin-precache-v3", "other-lib"]);
  const g = globalThis as Record<string, unknown>;
  const hadWindow = "window" in g;
  const prevCaches = g.caches;
  g.window = g.window ?? {};
  g.caches = {
    keys: async () => [...names],
    delete: async (name: string) => names.delete(name),
  };
  try {
    await purgeUserCachesForLogout();
    assert.deepEqual([...names].sort(), ["origin-precache-v3", "other-lib"]);
  } finally {
    if (!hadWindow) delete g.window;
    g.caches = prevCaches;
  }
});
