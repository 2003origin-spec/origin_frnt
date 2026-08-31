/**
 * Deleting a queued / processing import job.
 *
 * A job whose pipeline trigger was lost strands in `queued` forever and keeps
 * holding one of the 5 per-workspace concurrency slots, eventually locking a
 * teacher out of importing. `deleteImportJobService` is the escape hatch:
 * it hard-deletes the job, cascades to its pages and extracted questions,
 * and frees the slot.
 *
 * Verifies the delete itself, the cascade, the freed slot, the refusal to
 * touch a terminal job, and cross-workspace isolation.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createImportJob,
  deleteImportJobService,
  ImportJobDeleteError,
  updateJobStatusService,
} from "@/server/workspaces/document-import-service";
import { addJobPage, addJobQuestion, getImportJob } from "@/server/workspaces/document-import-store";

import { cleanup, closePool, dbConfigured, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();

/** Count the rows that should have cascaded away with the job. */
async function trailCounts(jobId: string): Promise<{ pages: number; questions: number }> {
  const pool = rawPool();
  const pages = await pool.query(
    `SELECT COUNT(*)::int AS n FROM import.import_job_pages WHERE job_id = $1`,
    [jobId],
  );
  const questions = await pool.query(
    `SELECT COUNT(*)::int AS n FROM import.import_job_questions WHERE job_id = $1`,
    [jobId],
  );
  return { pages: Number(pages.rows[0].n), questions: Number(questions.rows[0].n) };
}

test(
  "deleting a queued import job removes its trail and frees a concurrency slot",
  { skip: SKIP },
  async () => {
    const previousCap = process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY;
    const previousKey = process.env.R2_ACCESS_KEY_ID;
    process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY = "1";
    // Force the best-effort R2 cleanup down its failure path rather than
    // letting the suite make a live call against the real bucket. The delete
    // must still succeed — an unreachable R2 is not a reason to keep a dead row.
    delete process.env.R2_ACCESS_KEY_ID;

    const fx = await seedFixtures();
    try {
      const job = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "stranded.pdf",
        triggerPipeline: false,
      });
      assert.equal(job.status, "queued");

      // Give the job a trail: one page, and a question hanging off that page.
      const page = await addJobPage(job.id, 1, { status: "parsed", extractedText: "Q1 ..." });
      await addJobQuestion(job.id, page.id, { questionNumber: 1, questionText: "What is 2+2?" });
      assert.deepEqual(await trailCounts(job.id), { pages: 1, questions: 1 });

      // Cap is 1 and the job holds the only slot, so a second upload is refused.
      await assert.rejects(
        createImportJob({
          workspaceId: fx.workspaceId,
          userId: fx.ownerId,
          sourceType: "pdf",
          fileName: "blocked.pdf",
          triggerPipeline: false,
        }),
        /capacity/i,
        "the stranded job should be holding the only slot",
      );

      const deleted = await deleteImportJobService({
        workspaceId: fx.workspaceId,
        jobId: job.id,
        actorUserId: fx.ownerId,
      });
      assert.equal(deleted.id, job.id);

      // Job row gone, and pages + questions cascaded with it.
      assert.equal(await getImportJob(fx.workspaceId, job.id), null);
      assert.deepEqual(await trailCounts(job.id), { pages: 0, questions: 0 });

      // Slot released — the upload that was refused above now succeeds.
      const next = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "unblocked.pdf",
        triggerPipeline: false,
      });
      assert.equal(next.status, "queued");
    } finally {
      if (previousCap === undefined) delete process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY;
      else process.env.DOCUMENT_IMPORT_WORKSPACE_CONCURRENCY = previousCap;
      if (previousKey !== undefined) process.env.R2_ACCESS_KEY_ID = previousKey;
      await cleanup(fx);
      await closePool();
    }
  },
);

test(
  "a finished import job is refused with 409 rather than deleted",
  { skip: SKIP },
  async () => {
    const fx = await seedFixtures();
    try {
      const job = await createImportJob({
        workspaceId: fx.workspaceId,
        userId: fx.ownerId,
        sourceType: "pdf",
        fileName: "reviewed.pdf",
        triggerPipeline: false,
      });
      // needs_review is the state that owns extracted questions a teacher has
      // yet to accept — exactly what must not be destroyed by a queue cleanup.
      await updateJobStatusService({
        workspaceId: fx.workspaceId,
        jobId: job.id,
        userId: fx.ownerId,
        status: "needs_review",
      });

      await assert.rejects(
        deleteImportJobService({
          workspaceId: fx.workspaceId,
          jobId: job.id,
          actorUserId: fx.ownerId,
        }),
        (err: unknown) => {
          assert.ok(err instanceof ImportJobDeleteError, "should be ImportJobDeleteError");
          assert.equal(err.status, 409);
          assert.equal(err.errorCode, "IMPORT_JOB_NOT_ACTIVE");
          return true;
        },
      );

      // Still there.
      const survivor = await getImportJob(fx.workspaceId, job.id);
      assert.equal(survivor?.status, "needs_review");
    } finally {
      await cleanup(fx);
      await closePool();
    }
  },
);

test(
  "an import job cannot be deleted through another workspace",
  { skip: SKIP },
  async () => {
    const victim = await seedFixtures();
    const attacker = await seedFixtures();
    try {
      const job = await createImportJob({
        workspaceId: victim.workspaceId,
        userId: victim.ownerId,
        sourceType: "pdf",
        fileName: "not-yours.pdf",
        triggerPipeline: false,
      });

      // The attacker is a legitimate owner of their OWN workspace, so the
      // membership check passes; isolation has to come from the workspace
      // scoping on the lookup, not from authz.
      await assert.rejects(
        deleteImportJobService({
          workspaceId: attacker.workspaceId,
          jobId: job.id,
          actorUserId: attacker.ownerId,
        }),
        (err: unknown) => {
          assert.ok(err instanceof ImportJobDeleteError, "should be ImportJobDeleteError");
          assert.equal(err.status, 404);
          assert.equal(err.errorCode, "IMPORT_JOB_NOT_FOUND");
          return true;
        },
      );

      const survivor = await getImportJob(victim.workspaceId, job.id);
      assert.equal(survivor?.id, job.id);
    } finally {
      await cleanup(attacker);
      await cleanup(victim);
      await closePool();
    }
  },
);
