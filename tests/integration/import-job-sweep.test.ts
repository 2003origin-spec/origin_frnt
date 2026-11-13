/**
 * Recovering import jobs whose hand-off to the worker was lost.
 *
 * Plan: V1/IMPORT_PIPELINE_RELIABILITY_PLAN.md (Phase 1). Covers the SQL the
 * cron sweep relies on, against a real Postgres:
 * - claimStaleQueuedImportJobs picks only stale, young, still-queued jobs,
 *   bumps them so the next tick doesn't re-claim them, and never hands the
 *   same job to two overlapping sweeps;
 * - expireQueuedImportJobs fails jobs queued past the max age (and only those);
 * - failQueuedImportJob never overwrites a job the worker already picked up;
 * - sweepStuckImportJobs ties them together.
 *
 * The sweep queries span every workspace, so assertions only look at this
 * file's own job ids.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createImportJob } from "@/server/workspaces/document-import-service";
import {
  claimStaleQueuedImportJobs,
  expireQueuedImportJobs,
  failQueuedImportJob,
  getImportJob,
} from "@/server/workspaces/document-import-store";
import {
  IMPORT_ERROR_CODES,
  QUEUED_JOB_MAX_AGE_MINUTES,
  sweepStuckImportJobs,
  WORKER_UNAVAILABLE_MESSAGE,
} from "@/server/workspaces/document-import-dispatch";
import type { DocumentImportJob } from "@/server/workspaces/types";

import { cleanup, closePool, dbConfigured, rawPool, seedFixtures, type Fixtures } from "./_db";

const SKIP = !dbConfigured();

async function newJob(fx: Fixtures, fileName: string): Promise<DocumentImportJob> {
  return createImportJob({
    workspaceId: fx.workspaceId,
    userId: fx.ownerId,
    sourceType: "txt",
    fileName,
    content: "Q1. What is 2+2?",
    triggerPipeline: false,
  });
}

/** Age a job: created `createdMinAgo` minutes ago, last touched `updatedMinAgo`. */
async function age(jobId: string, createdMinAgo: number, updatedMinAgo: number, status?: string): Promise<void> {
  await rawPool().query(
    `UPDATE import.document_import_jobs
        SET created_at = NOW() - make_interval(mins => $2::int),
            updated_at = NOW() - make_interval(mins => $3::int),
            status = COALESCE($4::import.import_job_status, status)
      WHERE id = $1`,
    [jobId, createdMinAgo, updatedMinAgo, status ?? null],
  );
}

async function updatedAtMs(jobId: string): Promise<number> {
  const r = await rawPool().query(`SELECT updated_at FROM import.document_import_jobs WHERE id = $1`, [jobId]);
  return new Date(r.rows[0].updated_at).getTime();
}

/** Sweeps from other test files must not see this file's jobs as stale later. */
async function settle(ids: string[]): Promise<void> {
  await rawPool().query(
    `UPDATE import.document_import_jobs SET status = 'cancelled' WHERE id = ANY($1::text[]) AND status = 'queued'`,
    [ids],
  );
}

test("claim picks only stale, young, queued jobs and bumps them", { skip: SKIP }, async () => {
  process.env.R2_PRIVATE_BUCKET ??= "test-private";
  const fx = await seedFixtures();
  const ids: string[] = [];
  try {
    const stale = await newJob(fx, "stale.txt");
    const fresh = await newJob(fx, "fresh.txt");
    const tooOld = await newJob(fx, "too-old.txt");
    const processing = await newJob(fx, "processing.txt");
    ids.push(stale.id, fresh.id, tooOld.id, processing.id);

    await age(stale.id, 10, 10); // stale and young → claimable
    await age(fresh.id, 1, 1); // touched 1 min ago → not stale yet
    await age(tooOld.id, QUEUED_JOB_MAX_AGE_MINUTES + 5, 30); // past max age → expiry's job, not a retry
    await age(processing.id, 10, 10, "processing"); // the worker has it

    const before = await updatedAtMs(stale.id);
    const claimed = await claimStaleQueuedImportJobs({ staleAfterMinutes: 4, maxAgeMinutes: QUEUED_JOB_MAX_AGE_MINUTES, limit: 50 });
    const mine = claimed.map((j) => j.id).filter((id) => ids.includes(id));
    assert.deepEqual(mine, [stale.id]);
    assert.ok((await updatedAtMs(stale.id)) > before, "claim bumps updated_at");
    assert.equal((await getImportJob(fx.workspaceId, stale.id))?.status, "queued", "claim does not change status");

    // Bumped → not stale any more → the next tick leaves it alone.
    const again = await claimStaleQueuedImportJobs({ staleAfterMinutes: 4, maxAgeMinutes: QUEUED_JOB_MAX_AGE_MINUTES, limit: 50 });
    assert.equal(again.filter((j) => ids.includes(j.id)).length, 0);
  } finally {
    await settle(ids);
    await cleanup(fx);
  }
});

test("two overlapping sweeps never claim the same job", { skip: SKIP }, async () => {
  process.env.R2_PRIVATE_BUCKET ??= "test-private";
  const previousCap = process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY;
  process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY = "20"; // six jobs in one workspace
  const fx = await seedFixtures();
  const ids: string[] = [];
  try {
    for (let i = 0; i < 6; i++) {
      const job = await newJob(fx, `race-${i}.txt`);
      ids.push(job.id);
      await age(job.id, 10, 10);
    }
    const opts = { staleAfterMinutes: 4, maxAgeMinutes: QUEUED_JOB_MAX_AGE_MINUTES, limit: 50 };
    const [a, b] = await Promise.all([claimStaleQueuedImportJobs(opts), claimStaleQueuedImportJobs(opts)]);
    const aMine = a.map((j) => j.id).filter((id) => ids.includes(id));
    const bMine = b.map((j) => j.id).filter((id) => ids.includes(id));
    const overlap = aMine.filter((id) => bMine.includes(id));
    assert.deepEqual(overlap, [], "no job claimed twice");
    assert.equal(new Set([...aMine, ...bMine]).size, ids.length, "every stale job claimed exactly once");
  } finally {
    if (previousCap === undefined) delete process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY;
    else process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY = previousCap;
    await settle(ids);
    await cleanup(fx);
  }
});

test("expiry fails only jobs queued past the max age, with an actionable message", { skip: SKIP }, async () => {
  process.env.R2_PRIVATE_BUCKET ??= "test-private";
  const fx = await seedFixtures();
  const ids: string[] = [];
  try {
    const old = await newJob(fx, "old.txt");
    const young = await newJob(fx, "young.txt");
    const oldProcessing = await newJob(fx, "old-processing.txt");
    ids.push(old.id, young.id, oldProcessing.id);
    await age(old.id, QUEUED_JOB_MAX_AGE_MINUTES + 1, QUEUED_JOB_MAX_AGE_MINUTES + 1);
    await age(young.id, 10, 10);
    await age(oldProcessing.id, QUEUED_JOB_MAX_AGE_MINUTES + 1, 5, "processing");

    const expired = await expireQueuedImportJobs({
      maxAgeMinutes: QUEUED_JOB_MAX_AGE_MINUTES,
      code: IMPORT_ERROR_CODES.workerUnavailable,
      message: WORKER_UNAVAILABLE_MESSAGE,
    });
    assert.deepEqual(expired.filter((id) => ids.includes(id)), [old.id]);

    const failed = await getImportJob(fx.workspaceId, old.id);
    assert.equal(failed?.status, "failed");
    assert.equal(failed?.stage, "failed");
    assert.equal(failed?.errorCode, IMPORT_ERROR_CODES.workerUnavailable);
    assert.equal(failed?.errorMessage, WORKER_UNAVAILABLE_MESSAGE);
    assert.ok(failed?.completedAt, "completed_at set");
    assert.equal((await getImportJob(fx.workspaceId, young.id))?.status, "queued");
    assert.equal((await getImportJob(fx.workspaceId, oldProcessing.id))?.status, "processing", "the worker's jobs are the reaper's business");
  } finally {
    await settle(ids);
    await cleanup(fx);
  }
});

test("failQueuedImportJob never overwrites a job the worker picked up", { skip: SKIP }, async () => {
  process.env.R2_PRIVATE_BUCKET ??= "test-private";
  const fx = await seedFixtures();
  const ids: string[] = [];
  try {
    const queued = await newJob(fx, "q.txt");
    const running = await newJob(fx, "r.txt");
    ids.push(queued.id, running.id);
    await age(running.id, 1, 1, "processing");

    const err = { code: IMPORT_ERROR_CODES.rejected, message: "nope" };
    assert.equal((await failQueuedImportJob(queued.id, err))?.status, "failed");
    assert.equal(await failQueuedImportJob(running.id, err), null);
    assert.equal((await getImportJob(fx.workspaceId, running.id))?.status, "processing");
  } finally {
    await settle(ids);
    await cleanup(fx);
  }
});

test("sweep expires old jobs, then schedules the stale ones for a retry", { skip: SKIP }, async () => {
  process.env.R2_PRIVATE_BUCKET ??= "test-private";
  const fx = await seedFixtures();
  const ids: string[] = [];
  try {
    const old = await newJob(fx, "sweep-old.txt");
    const stale = await newJob(fx, "sweep-stale.txt");
    ids.push(old.id, stale.id);
    await age(old.id, QUEUED_JOB_MAX_AGE_MINUTES + 2, QUEUED_JOB_MAX_AGE_MINUTES + 2);
    await age(stale.id, 8, 8);

    const scheduled: string[] = [];
    const env = { ...process.env, DOCUMENT_IMPORT_SERVICE_URL: "https://worker.test", DOCUMENT_IMPORT_SERVICE_TOKEN: "t" };
    const result = await sweepStuckImportJobs({ env, schedule: (job) => scheduled.push(job.id) });
    assert.ok(result.expired.includes(old.id));
    assert.ok(result.retried.includes(stale.id));
    assert.ok(scheduled.includes(stale.id));
    assert.ok(!scheduled.includes(old.id));

    // No worker configured: expiry still runs, nothing is claimed or touched.
    await age(stale.id, 8, 8);
    const before = await updatedAtMs(stale.id);
    const bare = { ...process.env, DOCUMENT_IMPORT_SERVICE_URL: "", DOCUMENT_IMPORT_SERVICE_TOKEN: "" };
    const skipped = await sweepStuckImportJobs({ env: bare, schedule: () => assert.fail("must not schedule") });
    assert.equal(skipped.skipped, "not_configured");
    assert.equal(await updatedAtMs(stale.id), before);
  } finally {
    await settle(ids);
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
