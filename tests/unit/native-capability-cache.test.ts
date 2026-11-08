/**
 * The native capability handshake must not cache a miss caused by racing the
 * shell's bridge injection (FLAG_SECURE, keep-awake and native Google sign-in
 * stayed off until a reload).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityCache } from "@/native/capability-cache";

type Caps = { features: string[] };
const CAPS: Caps = { features: ["secureScreen"] };

function env(opts: { native?: boolean; pluginAfterSleeps?: number; fail?: number }) {
  let sleeps = 0;
  let calls = 0;
  let failures = opts.fail ?? 0;
  const deps = {
    isNative: () => opts.native ?? true,
    getHandshake: () =>
      opts.pluginAfterSleeps === undefined || sleeps >= opts.pluginAfterSleeps
        ? async () => {
            calls += 1;
            if (failures > 0) {
              failures -= 1;
              throw new Error("bridge not ready");
            }
            return CAPS;
          }
        : null,
    sleep: async () => {
      sleeps += 1;
    },
    waitMs: 300,
    pollMs: 100,
  };
  return { deps, calls: () => calls, sleeps: () => sleeps };
}

test("browsers resolve null once and never ask again", async () => {
  const e = env({ native: false });
  const get = createCapabilityCache<Caps>(e.deps);
  assert.equal(await get(), null);
  assert.equal(await get(), null);
  assert.equal(e.calls(), 0);
});

test("waits for a late bridge within the window", async () => {
  const e = env({ pluginAfterSleeps: 2 });
  const get = createCapabilityCache<Caps>(e.deps);
  assert.deepEqual(await get(), CAPS);
  assert.equal(e.sleeps(), 2);
});

test("a bridge that appears after the window is picked up by the next call", async () => {
  let present = false;
  const e = env({});
  let calls = 0;
  const get = createCapabilityCache<Caps>({
    ...e.deps,
    getHandshake: () =>
      present
        ? async () => {
            calls += 1;
            return CAPS;
          }
        : null,
  });
  assert.equal(await get(), null, "first call gives up after 3 polls");
  assert.equal(e.sleeps(), 3);
  present = true;
  assert.deepEqual(await get(), CAPS, "miss was not cached");
  assert.deepEqual(await get(), CAPS);
  assert.equal(calls, 1, "a real answer is cached");
  assert.equal(e.sleeps(), 3, "the later call did not wait again");
});

test("a shell with no plugin pays the wait once per page load, not on every call", async () => {
  const e = env({ pluginAfterSleeps: Number.POSITIVE_INFINITY });
  const get = createCapabilityCache<Caps>(e.deps);
  assert.equal(await get(), null);
  assert.equal(e.sleeps(), 3, "the first call waits the full window");
  assert.equal(await get(), null);
  assert.equal(await get(), null);
  assert.equal(e.sleeps(), 3, "later calls return at once");
  assert.equal(e.calls(), 0);
});

test("a failed handshake is retried, concurrent callers share one call", async () => {
  const e = env({ fail: 1 });
  const get = createCapabilityCache<Caps>(e.deps);
  const [a, b] = await Promise.all([get(), get()]);
  assert.equal(a, null);
  assert.equal(b, null);
  assert.equal(e.calls(), 1);
  assert.deepEqual(await get(), CAPS);
  assert.equal(e.calls(), 2);
});
