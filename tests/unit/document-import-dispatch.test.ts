/**
 * Next.js → document-import worker hand-off.
 * Plan: V1/IMPORT_PIPELINE_RELIABILITY_PLAN.md (Phase 1).
 *
 * No database or network: fetch and the job-failing store call are injected.
 * The SQL of the sweep is covered by tests/integration/import-job-sweep.test.ts.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyWorkerResponse,
  dispatchImportJob,
  dispatchTimeoutMs,
  DISPATCH_TIMEOUT_CEILING_MS,
  IMPORT_ERROR_CODES,
  importServiceConfig,
  scheduleImportJobDispatch,
} from "@/server/workspaces/document-import-dispatch";
import { importJobNotice, QUEUED_WAITING_AFTER_MS } from "@/lib/cbt/import-job-notice";

const JOB = { id: "dijob_test1", requestedBy: "user_1", workspaceId: "ws_1" };
const CONFIGURED = {
  NODE_ENV: "production",
  DOCUMENT_IMPORT_SERVICE_URL: "https://worker.example/",
  DOCUMENT_IMPORT_SERVICE_TOKEN: "secret-token",
} as unknown as NodeJS.ProcessEnv;

type FailCall = { jobId: string; code: string; message: string };

function recorder() {
  const failed: FailCall[] = [];
  const failJob = async (jobId: string, error: { code: string; message: string }) => {
    failed.push({ jobId, ...error });
    return null;
  };
  return { failed, failJob };
}

function respond(status: number): typeof fetch {
  return (async () => new Response("{}", { status })) as typeof fetch;
}

test("classifyWorkerResponse maps the worker's statuses", () => {
  assert.equal(classifyWorkerResponse(200), "accepted");
  assert.equal(classifyWorkerResponse(201), "accepted");
  assert.equal(classifyWorkerResponse(422), "worker_failed");
  for (const s of [401, 403, 404]) assert.equal(classifyWorkerResponse(s), "rejected", String(s));
  for (const s of [400, 408, 429, 500, 502, 503, 504]) assert.equal(classifyWorkerResponse(s), "retry", String(s));
});

test("dispatchTimeoutMs reads the env var and caps it below maxDuration", () => {
  const env = (v?: string) => ({ DOCUMENT_IMPORT_SERVICE_TIMEOUT_MS: v }) as unknown as NodeJS.ProcessEnv;
  assert.equal(dispatchTimeoutMs(env()), DISPATCH_TIMEOUT_CEILING_MS);
  assert.equal(dispatchTimeoutMs(env("60000")), 60_000);
  assert.equal(dispatchTimeoutMs(env("10")), 5_000, "floor");
  assert.equal(dispatchTimeoutMs(env("9999999")), DISPATCH_TIMEOUT_CEILING_MS, "ceiling");
  assert.equal(dispatchTimeoutMs(env("abc")), DISPATCH_TIMEOUT_CEILING_MS);
  assert.equal(dispatchTimeoutMs(env("-5")), DISPATCH_TIMEOUT_CEILING_MS);
  assert.ok(DISPATCH_TIMEOUT_CEILING_MS < 800_000, "below the routes' maxDuration");
});

test("importServiceConfig needs both URL and token and trims the trailing slash", () => {
  assert.deepEqual(importServiceConfig(CONFIGURED), { baseUrl: "https://worker.example", token: "secret-token" });
  assert.equal(importServiceConfig({ DOCUMENT_IMPORT_SERVICE_URL: "https://w" } as unknown as NodeJS.ProcessEnv), null);
  assert.equal(importServiceConfig({ DOCUMENT_IMPORT_SERVICE_TOKEN: "t" } as unknown as NodeJS.ProcessEnv), null);
  assert.equal(importServiceConfig({ DOCUMENT_IMPORT_SERVICE_URL: "  ", DOCUMENT_IMPORT_SERVICE_TOKEN: "t" } as unknown as NodeJS.ProcessEnv), null);
});

test("dispatch sends the worker's run request with the bearer token", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const { failed, failJob } = recorder();

  const outcome = await dispatchImportJob(JOB, { env: CONFIGURED, fetchImpl, failJob });
  assert.deepEqual(outcome, { kind: "accepted", status: 200 });
  assert.equal(failed.length, 0);
  assert.ok(seen);
  const s = seen as { url: string; init: RequestInit };
  assert.equal(s.url, "https://worker.example/v1/import-jobs/dijob_test1/run");
  assert.equal(s.init.method, "POST");
  const headers = s.init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer secret-token");
  assert.deepEqual(JSON.parse(String(s.init.body)), { job_id: "dijob_test1", requested_by: "user_1", workspace_id: "ws_1" });
  assert.ok(s.init.signal, "has a timeout signal");
});

test("dispatch fails the job when the worker rejects our credentials or URL", async () => {
  for (const status of [401, 403, 404]) {
    const { failed, failJob } = recorder();
    const outcome = await dispatchImportJob(JOB, { env: CONFIGURED, fetchImpl: respond(status), failJob });
    assert.deepEqual(outcome, { kind: "rejected", status });
    assert.deepEqual(failed.map((f) => [f.jobId, f.code]), [["dijob_test1", IMPORT_ERROR_CODES.rejected]]);
  }
});

test("dispatch leaves the job for the sweep on 5xx, timeouts and network errors", async () => {
  for (const status of [500, 503]) {
    const { failed, failJob } = recorder();
    const outcome = await dispatchImportJob(JOB, { env: CONFIGURED, fetchImpl: respond(status), failJob });
    assert.deepEqual(outcome, { kind: "retry", status });
    assert.equal(failed.length, 0);
  }
  const { failed, failJob } = recorder();
  const throwing = (async () => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  }) as typeof fetch;
  const outcome = await dispatchImportJob(JOB, { env: CONFIGURED, fetchImpl: throwing, failJob });
  assert.equal(outcome.kind, "retry");
  assert.match((outcome as { error: string }).error, /TimeoutError/);
  assert.equal(failed.length, 0);
});

test("dispatch treats 422 as already handled by the worker", async () => {
  const { failed, failJob } = recorder();
  const outcome = await dispatchImportJob(JOB, { env: CONFIGURED, fetchImpl: respond(422), failJob });
  assert.deepEqual(outcome, { kind: "worker_failed", status: 422 });
  assert.equal(failed.length, 0, "the worker already wrote its own error code");
});

test("missing worker config: dev keeps the old no-op, production fails the job", async () => {
  const neverFetch = (async () => assert.fail("must not call the worker")) as typeof fetch;

  const dev = recorder();
  const devOutcome = await dispatchImportJob(JOB, {
    env: { NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv,
    fetchImpl: neverFetch,
    failJob: dev.failJob,
  });
  assert.deepEqual(devOutcome, { kind: "skipped", reason: "not_configured" });
  assert.equal(dev.failed.length, 0);

  const prod = recorder();
  const prodOutcome = await dispatchImportJob(JOB, {
    env: { NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv,
    fetchImpl: neverFetch,
    failJob: prod.failJob,
  });
  assert.deepEqual(prodOutcome, { kind: "failed", code: IMPORT_ERROR_CODES.notConfigured });
  assert.deepEqual(prod.failed.map((f) => f.code), [IMPORT_ERROR_CODES.notConfigured]);
});

test("dispatch never throws even if recording the failure throws", async () => {
  const failJob = async () => {
    throw new Error("db down");
  };
  const outcome = await dispatchImportJob(JOB, { env: CONFIGURED, fetchImpl: respond(401), failJob });
  assert.deepEqual(outcome, { kind: "rejected", status: 401 });
});

test("scheduleImportJobDispatch falls back to an unawaited dispatch outside a request", () => {
  // No request scope in a unit test: `after` throws, so this must not throw and
  // must report that it did not use `after`. With no worker configured in the
  // test env the fallback dispatch is a no-op.
  const previous = { url: process.env.DOCUMENT_IMPORT_SERVICE_URL, env: process.env.NODE_ENV };
  delete process.env.DOCUMENT_IMPORT_SERVICE_URL;
  try {
    assert.equal(scheduleImportJobDispatch(JOB), false);
  } finally {
    if (previous.url !== undefined) process.env.DOCUMENT_IMPORT_SERVICE_URL = previous.url;
  }
});

test("importJobNotice: failed jobs show their error instead of 'in progress'", () => {
  const now = Date.parse("2026-11-13T10:00:00Z");
  const base = { errorMessage: null, createdAt: "2026-11-13T09:59:30Z" };
  const opts = { hasReviewableQuestions: false, nowMs: now };

  assert.deepEqual(
    importJobNotice({ ...base, status: "failed", errorMessage: "The import service didn't pick up this file. Upload it again." }, opts),
    { tone: "error", text: "The import service didn't pick up this file. Upload it again." },
  );
  assert.equal(importJobNotice({ ...base, status: "failed" }, opts)?.tone, "error");
  assert.match(importJobNotice({ ...base, status: "failed" }, opts)?.text ?? "", /Upload the file again/);
  assert.equal(importJobNotice({ ...base, status: "cancelled" }, opts)?.tone, "error");
  assert.equal(importJobNotice({ ...base, status: "needs_review" }, opts), null);
  assert.equal(importJobNotice({ ...base, status: "succeeded" }, opts), null);
});

test("importJobNotice: a queued job turns into 'waiting' after two minutes", () => {
  const created = Date.parse("2026-11-13T10:00:00Z");
  const job = { status: "queued" as const, errorMessage: null, createdAt: new Date(created).toISOString() };
  const early = importJobNotice(job, { hasReviewableQuestions: false, nowMs: created + 30_000 });
  assert.match(early?.text ?? "", /Extraction in progress/);
  const late = importJobNotice(job, { hasReviewableQuestions: false, nowMs: created + QUEUED_WAITING_AFTER_MS + 1 });
  assert.match(late?.text ?? "", /Waiting for the import service/);
  assert.equal(late?.tone, "info");
  assert.equal(importJobNotice({ ...job, status: "processing" }, { hasReviewableQuestions: false, nowMs: created + 3_600_000 })?.text.startsWith("Extraction in progress"), true);
  assert.equal(importJobNotice({ ...job, status: "processing" }, { hasReviewableQuestions: true, nowMs: created }), null);
});
