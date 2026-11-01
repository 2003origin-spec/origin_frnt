/**
 * Room/CBT stream keys must expire: every append XADDs (MAXLEN-trimmed) and then
 * refreshes a 7-day TTL on the same key, so an abandoned room's stream is
 * reclaimed instead of living in Upstash forever.
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { Redis } from "@upstash/redis";

import { createRedisStreamNamespace, STREAM_TTL_SECONDS } from "@/server/redis-streams";

type Call = { op: string; args: unknown[] };

function fakeRedis(options: { failExpire?: boolean } = {}) {
  const calls: Call[] = [];
  let seq = 0;
  const client = {
    async xadd(...args: unknown[]) {
      calls.push({ op: "xadd", args });
      seq += 1;
      return `1700000000000-${seq}`;
    },
    async expire(...args: unknown[]) {
      calls.push({ op: "expire", args });
      if (options.failExpire) throw new Error("upstash down");
      return 1;
    },
  };
  return { calls, client: client as unknown as Redis };
}

function namespace(client: Redis) {
  return createRedisStreamNamespace<{ type: string; n?: number }>({
    label: "test",
    codeKey: (code) => `test:code:${code}`,
    activeCodeKey: (id) => `test:${id}:code`,
    streamKey: (id) => `test:${id}:stream`,
    client,
  });
}

test("the stream TTL is seven days", () => {
  assert.equal(STREAM_TTL_SECONDS, 7 * 24 * 3600);
});

test("every append trims the stream and refreshes its TTL on the same key", async () => {
  const { calls, client } = fakeRedis();
  const ns = namespace(client);

  const first = await ns.appendStreamEvent("room-1", { type: "chat", n: 1 });
  const second = await ns.appendStreamEvent("room-1", { type: "chat", n: 2 });

  assert.equal(first, "1700000000000-1");
  assert.equal(second, "1700000000000-2");
  assert.deepEqual(
    calls.map((c) => c.op),
    ["xadd", "expire", "xadd", "expire"],
  );
  const [key, id, fields, opts] = calls[0].args as [string, string, Record<string, string>, unknown];
  assert.equal(key, "test:room-1:stream");
  assert.equal(id, "*");
  assert.equal(fields.type, "chat");
  assert.deepEqual(JSON.parse(fields.payload), { type: "chat", n: 1 });
  assert.deepEqual(opts, { trim: { type: "MAXLEN", comparison: "~", threshold: 500 } });
  assert.deepEqual(calls[1].args, ["test:room-1:stream", STREAM_TTL_SECONDS]);
});

test("a failed TTL refresh does not fail an append that was already published", async () => {
  const { calls, client } = fakeRedis({ failExpire: true });
  const ns = namespace(client);
  const originalWarn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args: unknown[]) => void warnings.push(args);
  try {
    const entryId = await ns.appendStreamEvent("room-2", { type: "finish" });
    assert.equal(entryId, "1700000000000-1");
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(
    calls.map((c) => c.op),
    ["xadd", "expire"],
  );
  assert.equal(warnings.length, 1);
});
