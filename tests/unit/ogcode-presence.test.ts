/**
 * §12 Live Practicing presence must degrade to 0 / no-op when Upstash env is
 * absent (local dev, CI without Redis) — it's ambient signal, never
 * load-bearing. This test runs with no UPSTASH_* env set.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  isOgcodePresenceAvailable,
  recordOgcodePresence,
  getOgcodePresenceCount,
  getOgcodePresenceCounts,
  PRESENCE_WINDOW_MS,
} from "@/server/ogcode-presence";

const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

test("presence degrades gracefully without Upstash", { skip: hasUpstash }, async () => {
  assert.equal(isOgcodePresenceAvailable(), false);
  // No throw, no-op write.
  await recordOgcodePresence("u1", "q1");
  assert.equal(await getOgcodePresenceCount("q1"), 0);
  const counts = await getOgcodePresenceCounts(["q1", "q2", "q3"]);
  assert.equal(counts.size, 0);
});

test("presence window is a sane duration", () => {
  assert.ok(PRESENCE_WINDOW_MS >= 20_000 && PRESENCE_WINDOW_MS <= 60_000);
});
