import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetQStashClientForTests,
  __setQStashClientForTests,
  isQStashConfigured,
  publishOutbox,
  verifyQStashSignature,
} from "../../src/server/payments/qstash";
import type { QStashClientLike } from "../../src/server/payments/qstash";

const ENV_KEYS = [
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_URL",
  "INTERNAL_CRON_TOKEN",
] as const;

const savedEnv = new Map<string, string | undefined>();

test.beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  __resetQStashClientForTests();
});

test.afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  __resetQStashClientForTests();
});

test("QStash config requires token, destination, and internal bearer secret", () => {
  delete process.env.QSTASH_TOKEN;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.o3origin.com";
  process.env.INTERNAL_CRON_TOKEN = "cron-secret";
  assert.equal(isQStashConfigured(), false);

  process.env.QSTASH_TOKEN = "qstash-token";
  assert.equal(isQStashConfigured(), true);
});

test("publishOutbox uses a stable deduplication id and forwarded bearer", async () => {
  const captured: { request?: Record<string, unknown> } = {};
  const fakeClient: QStashClientLike = {
    publishJSON: (async (input: unknown) => {
      captured.request = input as Record<string, unknown>;
      return { messageId: "msg_123" } as never;
    }) as QStashClientLike["publishJSON"],
  };
  __setQStashClientForTests(fakeClient);

  const result = await publishOutbox("obx_123", {
    destination: "https://www.o3origin.com/api/internal/payments/dispatch",
    internalToken: "cron-secret",
  });

  assert.deepEqual(result, { published: true, messageId: "msg_123" });
  const request = captured.request;
  assert.ok(request);
  assert.equal(request.url, "https://www.o3origin.com/api/internal/payments/dispatch");
  assert.deepEqual(request.body, { outboxId: "obx_123" });
  assert.equal(request.deduplicationId, "payment-outbox:obx_123");
  assert.equal(request.retries, 3);
  assert.deepEqual(request.headers, {
    "Upstash-Forward-Authorization": "Bearer cron-secret",
  });
});

test("publishOutbox degrades to the cron path when QStash is absent", async () => {
  const result = await publishOutbox("obx_123", {
    destination: "",
    internalToken: "",
    client: null as never,
  });
  assert.deepEqual(result, { published: false, messageId: null, reason: "not_configured" });
});

test("verifyQStashSignature passes the raw body, URL, and region to Receiver", async () => {
  process.env.QSTASH_CURRENT_SIGNING_KEY = "sig_current";
  let input: Record<string, unknown> | null = null;
  const request = new Request("https://www.o3origin.com/api/internal/payments/dispatch", {
    method: "POST",
    headers: {
      "Upstash-Signature": "signed-body",
      "Upstash-Region": "us-east-1",
    },
    body: JSON.stringify({ outboxId: "obx_123" }),
  });
  const verified = await verifyQStashSignature(request, '{"outboxId":"obx_123"}', {
    receiver: {
      verify: async (value) => {
        input = value as Record<string, unknown>;
        return true;
      },
    },
  });

  assert.equal(verified, true);
  assert.deepEqual(input, {
    signature: "signed-body",
    body: '{"outboxId":"obx_123"}',
    url: "https://www.o3origin.com/api/internal/payments/dispatch",
    upstashRegion: "us-east-1",
  });
});

test("verifyQStashSignature fails closed without signature keys or header", async () => {
  const request = new Request("https://www.o3origin.com/api/internal/payments/dispatch", {
    method: "POST",
    body: "{}",
  });
  assert.equal(await verifyQStashSignature(request, "{}"), false);

  process.env.QSTASH_CURRENT_SIGNING_KEY = "sig_current";
  assert.equal(await verifyQStashSignature(request, "{}"), false);
});
