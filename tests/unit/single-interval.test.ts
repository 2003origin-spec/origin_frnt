/**
 * OGCode's solve stopwatch: "Try Again" must never leave a second interval
 * running (each extra one double-counted timeSpent and cut the time bonus).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createSingleInterval } from "@/lib/single-interval";

function fakeTimers() {
  let next = 1;
  const live = new Map<number, () => void>();
  return {
    live,
    api: {
      set: (fn: () => void) => {
        const id = next++;
        live.set(id, fn);
        return id;
      },
      clear: (id: number) => void live.delete(id),
    },
    tick: () => [...live.values()].forEach((fn) => fn()),
  };
}

test("starting again replaces the running interval instead of adding one", () => {
  const t = fakeTimers();
  const sw = createSingleInterval(t.api);
  let elapsed = 0;
  sw.start(() => (elapsed += 1), 1000);
  sw.start(() => (elapsed += 1), 1000); // effect re-run / Try Again
  sw.start(() => (elapsed += 1), 1000);
  assert.equal(t.live.size, 1);
  t.tick();
  t.tick();
  assert.equal(elapsed, 2, "40 s solve reads 40 s, not 120 s");
});

test("stop clears it and is idempotent", () => {
  const t = fakeTimers();
  const sw = createSingleInterval(t.api);
  sw.start(() => {}, 1000);
  assert.ok(sw.isRunning());
  sw.stop();
  sw.stop();
  assert.equal(t.live.size, 0);
  assert.ok(!sw.isRunning());
});

test("default api uses real timers", () => {
  const sw = createSingleInterval();
  sw.start(() => {}, 60_000);
  assert.ok(sw.isRunning());
  sw.stop();
  assert.ok(!sw.isRunning());
});
