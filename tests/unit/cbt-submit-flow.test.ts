/**
 * CBT submit must never grade a server draft that is behind the device:
 * every attempt flushes first, and a failed flush blocks /submit.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyCbtSaveFailure,
  runCbtSubmitFlow,
  type CbtFlushOutcome,
  type CbtSubmitRequestOutcome,
} from "@/lib/cbt/submit-flow";

function harness(flushes: CbtFlushOutcome[], submits: CbtSubmitRequestOutcome[]) {
  let dirty = true;
  const calls: string[] = [];
  const sleeps: number[] = [];
  const retries: string[] = [];
  return {
    calls,
    sleeps,
    retries,
    deps: {
      isDirty: () => dirty,
      flush: async () => {
        calls.push("flush");
        const r = flushes.shift() ?? "retry";
        dirty = r !== "ok";
        return r;
      },
      submit: async () => {
        calls.push("submit");
        return submits.shift() ?? "retry";
      },
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      backoffs: [1, 2, 3],
      onRetry: (stage: "save" | "submit") => {
        retries.push(stage);
      },
    },
  };
}

test("a failed final flush blocks /submit until the answers land", async () => {
  const h = harness(["retry", "ok"], ["ok"]);
  assert.equal(await runCbtSubmitFlow(h.deps), "submitted");
  assert.deepEqual(h.calls, ["flush", "flush", "submit"]);
  assert.deepEqual(h.retries, ["save"]);
});

test("offline for the whole window never submits and reports failure", async () => {
  const h = harness([], []);
  assert.equal(await runCbtSubmitFlow(h.deps), "failed");
  assert.ok(!h.calls.includes("submit"));
  assert.equal(h.calls.length, 4);
  assert.deepEqual(h.sleeps, [1, 2, 3]);
});

test("a submit failure after a good flush does not re-flush clean answers", async () => {
  const h = harness(["ok"], ["retry", "ok"]);
  assert.equal(await runCbtSubmitFlow(h.deps), "submitted");
  assert.deepEqual(h.calls, ["flush", "submit", "submit"]);
  assert.deepEqual(h.retries, ["submit"]);
});

test("terminal flush outcomes stop the loop", async () => {
  assert.equal(await runCbtSubmitFlow(harness(["finalized"], []).deps), "finalized");
  assert.equal(await runCbtSubmitFlow(harness(["unauthorized"], []).deps), "unauthorized");
  assert.equal(await runCbtSubmitFlow(harness(["ok"], ["unauthorized"]).deps), "unauthorized");
});

test("a throwing flush or submit is treated as retryable", async () => {
  const h = harness(["ok"], ["ok"]);
  let threw = false;
  const flush = h.deps.flush;
  h.deps.flush = async () => {
    if (!threw) {
      threw = true;
      throw new Error("boom");
    }
    return flush();
  };
  assert.equal(await runCbtSubmitFlow(h.deps), "submitted");
});

test("a permanently rejected save (4xx) does not block the submit; the local draft is kept", async () => {
  const h = harness(["rejected"], ["ok"]);
  assert.equal(await runCbtSubmitFlow(h.deps), "submitted_unsaved");
  assert.deepEqual(h.calls, ["flush", "submit"]);
});

test("after a rejected save, retries only re-submit (the draft is never re-sent)", async () => {
  const h = harness(["rejected"], ["retry", "ok"]);
  assert.equal(await runCbtSubmitFlow(h.deps), "submitted_unsaved");
  assert.deepEqual(h.calls, ["flush", "submit", "submit"]);
  assert.deepEqual(h.retries, ["submit"]);
});

test("save failures: only explicit validation/size refusals are permanent", () => {
  assert.equal(classifyCbtSaveFailure(400, "invalid_body"), "rejected");
  assert.equal(classifyCbtSaveFailure(413, "payload_too_large"), "rejected");
  assert.equal(classifyCbtSaveFailure(413), "rejected", "a platform body-size 413 has no code");
  // A bare 400 (e.g. an unclassified server error from before the fix, or a
  // proxy) must retry: giving up at the bell grades a stale draft.
  for (const status of [400, 403, 404, 422]) assert.equal(classifyCbtSaveFailure(status), "retry", String(status));
  assert.equal(classifyCbtSaveFailure(400, "server_error"), "retry");
  assert.equal(classifyCbtSaveFailure(500, "invalid_body"), "retry", "a validation code only counts on a 4xx");
  for (const status of [408, 409, 425, 429, 500, 502, 503]) assert.equal(classifyCbtSaveFailure(status), "retry", String(status));
});
