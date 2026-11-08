/**
 * result-screen-refetch-and-drain (server side): the result GET used to claim
 * the OLDEST pending analysis job of ANY user and wait up to 3.5 s on it, and
 * nothing else started a job. Now submit kicks its own job after the response,
 * the result GET settles only its own job, and the DPP reads drain only the
 * caller's jobs. Fake ogcode pool, no database, no analytics service.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildClaimAnalysisJobQuery,
  drainOneAnalysisJobWithTimeout,
  kickAnalysisJobAfterResponse,
  settleAnalysisJobWithTimeout,
} from "../../src/server/analysis-jobs";

type G = Record<string, unknown>;
const g = globalThis as unknown as G;

function normalized(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

/** Fake ogcode pool; `rowsFor` answers by statement. Schema flags pre-set. */
function installFakeOgcodePool(rowsFor: (sql: string, values?: unknown[]) => unknown[] | undefined) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const query = async (text: string, values?: unknown[]) => {
    const sql = normalized(text);
    calls.push({ sql, values });
    const rows = rowsFor(sql, values) ?? [];
    return { rows, rowCount: rows.length };
  };
  process.env.OGCODE_DATABASE_URL = "postgres://fake:fake@127.0.0.1:1/fake_analysis";
  g.__originAnalysisJobsSchemaApplied = true;
  g.__originAnalysisJobsSchemaReady = Promise.resolve();
  g.__originOgcodePool = { query, connect: async () => ({ query, release: () => undefined }), end: async () => undefined };
  return calls;
}

test("buildClaimAnalysisJobQuery: any job, one job, or one user's jobs; always pending + under the attempt cap", () => {
  const any = buildClaimAnalysisJobQuery();
  assert.match(normalized(any.text), /WHERE status = 'pending' AND attempts < \$1 ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED/);
  assert.deepEqual(any.values, [5]);

  const one = buildClaimAnalysisJobQuery({ jobId: "analysis_r1" });
  assert.match(normalized(one.text), /attempts < \$1 AND id = \$2 ORDER BY/);
  assert.deepEqual(one.values, [5, "analysis_r1"]);

  const mine = buildClaimAnalysisJobQuery({ userId: "u1" });
  assert.match(normalized(mine.text), /attempts < \$1 AND user_id = \$2 ORDER BY/);
  assert.deepEqual(mine.values, [5, "u1"]);
});

test("settle: a pending own job is claimed by id (never another user's)", async () => {
  const calls = installFakeOgcodePool(() => undefined);
  await settleAnalysisJobWithTimeout("analysis_r1", 400);
  const claim = calls.find((call) => call.sql.startsWith("SELECT id, user_id, kind, payload, attempts"));
  assert.ok(claim, "claimed");
  assert.match(claim!.sql, /id = \$2/);
  assert.deepEqual(claim!.values, [5, "analysis_r1"]);
});

test("settle: a job already running elsewhere is waited for until it finishes", async () => {
  let polls = 0;
  const calls = installFakeOgcodePool((sql) => {
    if (sql.startsWith("SELECT status FROM app.analysis_jobs")) {
      polls += 1;
      return [{ status: polls < 3 ? "running" : "complete" }];
    }
    return undefined;
  });
  const started = Date.now();
  await settleAnalysisJobWithTimeout("analysis_r2", 3000);
  assert.equal(polls, 3);
  assert.ok(Date.now() - started < 2000, "returned as soon as the job completed");
  assert.ok(calls.every((call) => !call.sql.startsWith("UPDATE")), "did not touch the running job");
});

test("settle: gives up at the deadline on a job stuck in running", async () => {
  installFakeOgcodePool((sql) => (sql.startsWith("SELECT status FROM") ? [{ status: "running" }] : undefined));
  const started = Date.now();
  await settleAnalysisJobWithTimeout("analysis_r3", 300);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 250 && elapsed < 1500, `elapsed ${elapsed}ms`);
});

test("settle and drains never throw on a database failure, and respect the kill switch", async () => {
  const pool = { query: async () => Promise.reject(new Error("db down")), connect: async () => Promise.reject(new Error("db down")) };
  g.__originOgcodePool = pool;
  await settleAnalysisJobWithTimeout("analysis_r4", 300);
  assert.equal(await drainOneAnalysisJobWithTimeout(300, { userId: "u1" }), null);

  process.env.ORIGIN_ANALYSIS_OPPORTUNISTIC_DRAIN = "false";
  try {
    let touched = false;
    g.__originOgcodePool = { query: async () => ((touched = true), { rows: [] }) };
    await settleAnalysisJobWithTimeout("analysis_r5", 300);
    assert.equal(kickAnalysisJobAfterResponse("analysis_r5"), false);
    assert.equal(touched, false);
  } finally {
    delete process.env.ORIGIN_ANALYSIS_OPPORTUNISTIC_DRAIN;
  }
});

test("drainOneAnalysisJobWithTimeout with a user filter claims only that user's jobs", async () => {
  const calls = installFakeOgcodePool(() => undefined);
  const result = await drainOneAnalysisJobWithTimeout(500, { userId: "u9" });
  assert.deepEqual(result, { claimed: 0, completed: 0, retried: 0, failed: 0 });
  const claim = calls.find((call) => call.sql.startsWith("SELECT id, user_id"));
  assert.deepEqual(claim!.values, [5, "u9"]);
});

test("kickAnalysisJobAfterResponse is a no-op outside a request scope", () => {
  installFakeOgcodePool(() => undefined);
  assert.equal(kickAnalysisJobAfterResponse("analysis_r6"), false);
});

test("wiring: submit kicks its job, the result GET settles only its own job, DPP reads drain only the caller's", () => {
  const src = readFileSync(new URL("../../src/legacy/assessments.ts", import.meta.url), "utf8");
  assert.equal((src.match(/kickAnalysisJobAfterResponse\(jobId\)/g) ?? []).length, 2, "test + DPP submit");
  assert.match(src, /settleAnalysisJobWithTimeout\(`analysis_\$\{persisted\.id\}`\)/);
  assert.equal((src.match(/drainOneAnalysisJobWithTimeout\(undefined, \{ userId: user\.id \}\)/g) ?? []).length, 2);
  assert.doesNotMatch(src, /drainOneAnalysisJobWithTimeout\(\);/, "no read path drains anyone's oldest job");
});
