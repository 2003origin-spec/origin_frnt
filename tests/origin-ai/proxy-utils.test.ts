/**
 * Ori proxy helpers — bug-fix doc 12, findings 4 (usage must be recorded on
 * cancel() too) and 5 (a timeout is a 504, not a silent fallback).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DAILY_AI_LIMIT_MESSAGE,
  ORI_TIMEOUT_MESSAGE,
  classifyProxyError,
  createUsageRecordingTransform,
  dailyBudgetRefusalResponse,
  extractSseFinalPayload,
  isUpstreamDailyBudgetRefusal,
  proxyFailureResponse,
  proxyTimeoutResponse,
} from "../../src/server/origin-ai-proxy-utils";

const encoder = new TextEncoder();

function sse(payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function upstream(chunks: Uint8Array[], options: { hang?: boolean } = {}): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]!);
        index += 1;
        return;
      }
      if (!options.hang) {
        controller.close();
      }
      // With hang=true the stream never closes: mimics an upstream that has
      // sent its final frame but whose socket is still open.
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const reader = stream.getReader();
  const out: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("extractSseFinalPayload returns the last final frame and ignores junk", () => {
  const buffer =
    'data: {"type":"text","delta":"hi"}\n\n' +
    "data: not-json\n\n" +
    'data: {"type":"final","tokens_used":42}\n\n' +
    'data: {"type":"done"}\n\n';
  assert.deepEqual(extractSseFinalPayload(buffer), { type: "final", tokens_used: 42 });
  assert.equal(extractSseFinalPayload('data: {"type":"text","delta":"x"}\n\n'), null);
});

test("usage is recorded once on a clean flush, with the bytes passed through untouched", async () => {
  const finals: unknown[] = [];
  let settled = 0;
  const chunks = [sse({ type: "text", delta: "F = " }), sse({ type: "text", delta: "ma" }), sse({ type: "final", tokens_used: 120 })];

  const out = await readAll(
    upstream(chunks).pipeThrough(
      createUsageRecordingTransform({
        onSettle: () => {
          settled += 1;
        },
        onFinal: (payload) => {
          finals.push(payload);
        },
      }),
    ),
  );

  assert.equal(out.length, 3);
  assert.deepEqual(finals, [{ type: "final", tokens_used: 120 }]);
  assert.equal(settled, 1);
});

test("usage is recorded when the client cancels after the final frame (N16)", async () => {
  const finals: unknown[] = [];
  let settled = 0;
  const chunks = [sse({ type: "text", delta: "answer" }), sse({ type: "final", tokens_used: 999 })];

  const stream = upstream(chunks, { hang: true }).pipeThrough(
    createUsageRecordingTransform({
      onSettle: () => {
        settled += 1;
      },
      onFinal: (payload) => {
        finals.push(payload);
      },
    }),
  );
  const reader = stream.getReader();
  await reader.read();
  await reader.read();
  // Client disconnects before the upstream closes — flush() never runs.
  await reader.cancel("client disconnected");
  await settle();

  assert.deepEqual(finals, [{ type: "final", tokens_used: 999 }]);
  assert.equal(settled, 1);
});

test("a cancel before any final frame records nothing but still settles", async () => {
  const finals: unknown[] = [];
  let settled = 0;
  const stream = upstream([sse({ type: "text", delta: "partial" })], { hang: true }).pipeThrough(
    createUsageRecordingTransform({
      onSettle: () => {
        settled += 1;
      },
      onFinal: (payload) => {
        finals.push(payload);
      },
    }),
  );
  const reader = stream.getReader();
  await reader.read();
  await reader.cancel("client disconnected");
  await settle();

  assert.deepEqual(finals, []);
  assert.equal(settled, 1);
});

test("a final frame split across chunks is still found (decoder keeps partial UTF-8)", async () => {
  const finals: unknown[] = [];
  const whole = sse({ type: "final", tokens_used: 7, answer: "नमस्ते" });
  const split = Math.floor(whole.length / 2);

  await readAll(
    upstream([whole.slice(0, split), whole.slice(split)]).pipeThrough(
      createUsageRecordingTransform({ onFinal: (payload) => void finals.push(payload) }),
    ),
  );

  assert.equal(finals.length, 1);
  assert.equal((finals[0] as { tokens_used: number }).tokens_used, 7);
});

test("AbortError is a timeout → 504 JSON, never a fallback (N17)", async () => {
  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.equal(classifyProxyError(abort), "timeout");

  const res = proxyTimeoutResponse("req_1");
  assert.equal(res.status, 504);
  assert.equal(res.headers.get("Content-Type"), "application/json");
  assert.deepEqual(await res.json(), { detail: ORI_TIMEOUT_MESSAGE, requestId: "req_1" });
  assert.equal(ORI_TIMEOUT_MESSAGE, "Ori timed out, please retry.");
});

test("only connection-level errors are classified as 'connection'", () => {
  const refused = new TypeError("fetch failed");
  (refused as Error & { cause?: unknown }).cause = { code: "ECONNREFUSED" };
  assert.equal(classifyProxyError(refused), "connection");

  const dns = new TypeError("fetch failed");
  (dns as Error & { cause?: unknown }).cause = { code: "ENOTFOUND" };
  assert.equal(classifyProxyError(dns), "connection");

  assert.equal(classifyProxyError(Object.assign(new Error("x"), { code: "ECONNREFUSED" })), "connection");

  const reset = new TypeError("fetch failed");
  (reset as Error & { cause?: unknown }).cause = { code: "ECONNRESET" };
  assert.equal(classifyProxyError(reset), "other");
  assert.equal(classifyProxyError(new Error("boom")), "other");
  assert.equal(classifyProxyError("string error"), "other");
});

test("non-connection transport failures surface as 502, not a fabricated reply", async () => {
  const res = proxyFailureResponse("req_2");
  assert.equal(res.status, 502);
  const body = (await res.json()) as { detail: string; requestId: string };
  assert.equal(body.requestId, "req_2");
  assert.match(body.detail, /retry/i);
});

test("the Python 429 daily budget refusal maps onto the in-app quota shape", async () => {
  assert.equal(isUpstreamDailyBudgetRefusal(429, { detail: "Daily AI budget exhausted (200,000 of 200,000 tokens used today)." }), true);
  assert.equal(isUpstreamDailyBudgetRefusal(429, { detail: "Too many requests" }), false);
  assert.equal(isUpstreamDailyBudgetRefusal(403, { detail: "Daily AI budget exhausted" }), false);
  assert.equal(isUpstreamDailyBudgetRefusal(429, null), false);

  const res = dailyBudgetRefusalResponse();
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { detail: DAILY_AI_LIMIT_MESSAGE });
  assert.match(DAILY_AI_LIMIT_MESSAGE, /daily AI usage limit/);
});
