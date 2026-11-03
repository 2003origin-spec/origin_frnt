/**
 * src/server/store-locks.ts — the shared/exclusive gate that replaced the
 * process-wide store mutex, and the per-user mutex for user-scoped writes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { KeyedMutex, SharedExclusiveGate } from "../../src/server/store-locks";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("gate: shared holders run together", async () => {
  const gate = new SharedExclusiveGate();
  const hold = deferred();
  let running = 0;
  let peak = 0;
  const run = () =>
    gate.runShared(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await hold.promise;
      running -= 1;
    });
  const all = Promise.all([run(), run(), run()]);
  await tick();
  assert.equal(peak, 3);
  hold.resolve();
  await all;
  assert.deepEqual(gate.state, { shared: 0, exclusive: false, waiting: 0 });
});

test("gate: an exclusive holder never overlaps anything", async () => {
  const gate = new SharedExclusiveGate();
  const events: string[] = [];
  const holdShared = deferred();
  const shared = gate.runShared(async () => {
    events.push("shared:start");
    await holdShared.promise;
    events.push("shared:end");
  });
  const exclusive = gate.runExclusive(async () => {
    events.push("exclusive");
  });
  await tick();
  assert.deepEqual(events, ["shared:start"], "exclusive waits for the shared holder");
  holdShared.resolve();
  await Promise.all([shared, exclusive]);
  assert.deepEqual(events, ["shared:start", "shared:end", "exclusive"]);
});

test("gate: FIFO, so a queued exclusive is not overtaken by later shared callers", async () => {
  const gate = new SharedExclusiveGate();
  const events: string[] = [];
  const holdFirst = deferred();
  const first = gate.runShared(async () => {
    await holdFirst.promise;
    events.push("shared-1");
  });
  const exclusive = gate.runExclusive(async () => {
    events.push("exclusive");
  });
  const late = gate.runShared(async () => {
    events.push("shared-2");
  });
  await tick();
  assert.deepEqual(events, [], "the late shared caller queues behind the exclusive one");
  holdFirst.resolve();
  await Promise.all([first, exclusive, late]);
  assert.deepEqual(events, ["shared-1", "exclusive", "shared-2"]);
});

test("gate: a throwing holder releases the gate", async () => {
  const gate = new SharedExclusiveGate();
  await assert.rejects(gate.runExclusive(async () => {
    throw new Error("boom");
  }), /boom/);
  await assert.rejects(gate.runShared(() => {
    throw new Error("sync boom");
  }), /sync boom/);
  assert.equal(await gate.runExclusive(() => 7), 7);
  assert.deepEqual(gate.state, { shared: 0, exclusive: false, waiting: 0 });
});

test("gate: consecutive queued shared callers are released together after an exclusive one", async () => {
  const gate = new SharedExclusiveGate();
  const holdExclusive = deferred();
  const exclusive = gate.runExclusive(() => holdExclusive.promise);
  const holdShared = deferred();
  let running = 0;
  let peak = 0;
  const run = () =>
    gate.runShared(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await holdShared.promise;
      running -= 1;
    });
  const sharedRuns = Promise.all([run(), run()]);
  await tick();
  assert.equal(peak, 0);
  holdExclusive.resolve();
  await exclusive;
  await tick();
  assert.equal(peak, 2);
  holdShared.resolve();
  await sharedRuns;
});

test("keyed mutex: same key runs in order, other keys run alongside, idle keys are dropped", async () => {
  const mutex = new KeyedMutex();
  const events: string[] = [];
  const holdA = deferred();
  const a1 = mutex.runExclusive("a", async () => {
    events.push("a1:start");
    await holdA.promise;
    events.push("a1:end");
  });
  const a2 = mutex.runExclusive("a", async () => {
    events.push("a2");
  });
  const b = mutex.runExclusive("b", async () => {
    events.push("b");
  });
  await b;
  await tick();
  assert.deepEqual(events, ["a1:start", "b"], "user b does not wait for user a");
  holdA.resolve();
  await Promise.all([a1, a2]);
  assert.deepEqual(events, ["a1:start", "b", "a1:end", "a2"]);
  assert.equal(mutex.size, 0);
});

test("keyed mutex: a throwing holder still lets the next caller of that key run", async () => {
  const mutex = new KeyedMutex();
  await assert.rejects(mutex.runExclusive("a", async () => {
    throw new Error("boom");
  }), /boom/);
  assert.equal(await mutex.runExclusive("a", () => "next"), "next");
  assert.equal(mutex.size, 0);
});
