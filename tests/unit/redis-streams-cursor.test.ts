/**
 * Regression guard for SSE streams that silently dropped events.
 *
 * The study-room and CBT SSE routes used to start reading with cursor "$" and
 * keep it until the first event arrived. With XREAD BLOCK, "$" only returns
 * entries added while that one read is blocked, so an event published between
 * two reads (after a keepalive timeout) was lost; in local dev the in-memory
 * fallback filtered everything out for "$" and never delivered anything.
 * Routes now start from `streamStartCursor()`: a concrete id taken up front.
 *
 * Runs against the in-memory fallback (no Upstash env).
 */

import test from "node:test";
import assert from "node:assert/strict";

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

type TestEvent = { type: string; n: number };

async function loadNamespace() {
  const mod = await import("../../src/server/redis-streams");
  const ns = mod.createRedisStreamNamespace<TestEvent>({
    label: "stream-cursor-test",
    codeKey: (code) => `test:code:${code}`,
    activeCodeKey: (id) => `test:active-code:${id}`,
    streamKey: (id) => `test:${id}:stream`,
  });
  return { ...mod, ns };
}

// Short blocks keep the test fast; the fallback polls every 250 ms.
const BLOCK = { blockMs: 300 };

test('"$" loses an event published between two blocking reads (the old bug)', async () => {
  const { ns } = await loadNamespace();
  const room = "dollar-cursor";

  assert.deepEqual(await ns.readStreamEvents(room, "$", BLOCK), [], "first read times out (keepalive)");
  await ns.appendStreamEvent(room, { type: "chat", n: 1 });
  const second = await ns.readStreamEvents(room, "$", BLOCK);

  assert.deepEqual(second, [], '"$" re-anchors at the newest entry, so the event in the gap is gone');
});

test("a concrete start cursor delivers the event published between two reads", async () => {
  const { ns, streamStartCursor } = await loadNamespace();
  const room = "concrete-cursor";
  const cursor = streamStartCursor(null);

  assert.deepEqual(await ns.readStreamEvents(room, cursor, BLOCK), [], "first read times out (keepalive)");
  await ns.appendStreamEvent(room, { type: "chat", n: 1 });
  const second = await ns.readStreamEvents(room, cursor, BLOCK);

  assert.deepEqual(
    second.map((entry) => entry.event),
    [{ type: "chat", n: 1 }],
  );
});

test("the start cursor also covers events published just before the connection", async () => {
  const { ns, streamStartCursor } = await loadNamespace();
  const room = "pre-connect";

  await ns.appendStreamEvent(room, { type: "test_started", n: 1 });
  const events = await ns.readStreamEvents(room, streamStartCursor(null), BLOCK);

  assert.deepEqual(
    events.map((entry) => entry.event.n),
    [1],
  );
});

test("a blocking read with the start cursor wakes up for a live event", async () => {
  const { ns, streamStartCursor } = await loadNamespace();
  const room = "live";
  const cursor = streamStartCursor(null);

  const pending = ns.readStreamEvents(room, cursor, { blockMs: 2_000 });
  setTimeout(() => void ns.appendStreamEvent(room, { type: "presence", n: 7 }), 50);
  const events = await pending;

  assert.deepEqual(
    events.map((entry) => entry.event.n),
    [7],
  );
});

test("resuming from an entry id returns only later entries, in order", async () => {
  const { ns } = await loadNamespace();
  const room = "resume";

  const first = await ns.appendStreamEvent(room, { type: "chat", n: 1 });
  await ns.appendStreamEvent(room, { type: "chat", n: 2 });
  await ns.appendStreamEvent(room, { type: "chat", n: 3 });
  assert.ok(first);

  const events = await ns.readStreamEvents(room, first, BLOCK);
  assert.deepEqual(
    events.map((entry) => entry.event.n),
    [2, 3],
  );
});

test("advancing the cursor to the last delivered id never replays those entries", async () => {
  const { ns, streamStartCursor } = await loadNamespace();
  const room = "advance";

  await ns.appendStreamEvent(room, { type: "chat", n: 1 });
  await ns.appendStreamEvent(room, { type: "chat", n: 2 });
  const first = await ns.readStreamEvents(room, streamStartCursor(null), BLOCK);
  assert.deepEqual(first.map((entry) => entry.event.n), [1, 2]);

  // What every route does after a read: move the cursor to the last id it sent.
  const cursor = first.at(-1)!.id;
  assert.deepEqual(await ns.readStreamEvents(room, cursor, BLOCK), [], "no replay of delivered entries");

  await ns.appendStreamEvent(room, { type: "chat", n: 3 });
  const third = await ns.readStreamEvents(room, cursor, BLOCK);
  assert.deepEqual(third.map((entry) => entry.event.n), [3]);
});

test("streamStartCursor prefers Last-Event-ID, else now minus the skew margin", async () => {
  const { streamStartCursor, STREAM_START_SKEW_MS } = await loadNamespace();
  const now = 1_760_000_000_000;

  assert.equal(streamStartCursor("1759999999000-4", now), "1759999999000-4");
  assert.equal(streamStartCursor(null, now), `${now - STREAM_START_SKEW_MS}-0`);
  assert.equal(streamStartCursor("", now), `${now - STREAM_START_SKEW_MS}-0`);
  assert.equal(streamStartCursor("   ", now), `${now - STREAM_START_SKEW_MS}-0`);
  assert.notEqual(streamStartCursor(null), "$");
});

test("the shared-helper SSE routes start from streamStartCursor, never \"$\"", async () => {
  const { readFile } = await import("node:fs/promises");
  const routes = [
    "src/app/api/study-rooms/[id]/stream/route.ts",
    "src/app/api/cbt/rooms/[roomId]/stream/route.ts",
    "src/app/api/cbt-student/stream/route.ts",
  ];
  for (const route of routes) {
    const source = await readFile(new URL(`../../${route}`, import.meta.url), "utf8");
    assert.match(source, /streamStartCursor\(request\.headers\.get\("last-event-id"\)\)/, route);
    assert.doesNotMatch(source, /"\$"/, `${route} must not read from "$"`);
  }
});
