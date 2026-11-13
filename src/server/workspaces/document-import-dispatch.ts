/**
 * Hand-off from Next.js to the document-import worker, plus the cron sweep
 * that recovers jobs whose hand-off was lost.
 *
 * Plan: V1/IMPORT_PIPELINE_RELIABILITY_PLAN.md (Phase 1).
 *
 * Why this exists: job creation used to fire `POST /v1/import-jobs/{id}/run`
 * without awaiting it. The worker runs the whole pipeline inside that request,
 * so the Vercel invocation returned long before the reply — and the request
 * could be dropped with it, or come back 5xx (worker down) and be ignored.
 * Nothing ever retried, so the job sat in `queued` forever and held one of the
 * workspace's import slots.
 *
 * Now:
 * - the dispatch runs inside `after()` so Vercel keeps the invocation alive
 *   until the worker answers (bounded by the route's `maxDuration`);
 * - the worker's answer is classified: config errors fail the job with a clear
 *   code, transient errors leave it `queued` for the sweep;
 * - the 5-minute cron (`/api/internal/cbt/drain`) re-dispatches stale `queued`
 *   jobs and gives up on them after `QUEUED_JOB_MAX_AGE_MINUTES`.
 */

import { after } from "next/server";

import {
  claimStaleQueuedImportJobs,
  expireQueuedImportJobs,
  failQueuedImportJob,
} from "./document-import-store";
import type { DocumentImportJob } from "./types";

/** Route segments that dispatch an import (job create + the sweep) export
 * `maxDuration = 800`; the fetch must give up a little before that. */
export const DISPATCH_TIMEOUT_CEILING_MS = 780_000;
const DISPATCH_TIMEOUT_FLOOR_MS = 5_000;

/** A `queued` job untouched this long was never received: the worker flips a
 * job to `processing` within seconds of getting the request. */
export const QUEUED_JOB_STALE_MINUTES = 4;
/** After this long in `queued`, stop retrying and fail the job. */
export const QUEUED_JOB_MAX_AGE_MINUTES = 45;
/** Jobs re-dispatched per sweep tick. Each one runs a whole pipeline. */
export const SWEEP_RETRY_LIMIT = 3;

export const IMPORT_ERROR_CODES = {
  notConfigured: "IMPORT_SERVICE_NOT_CONFIGURED",
  rejected: "IMPORT_SERVICE_REJECTED",
  workerUnavailable: "WORKER_UNAVAILABLE",
} as const;

export const WORKER_UNAVAILABLE_MESSAGE =
  "The import service didn't pick up this file. Upload it again.";

export type ImportServiceConfig = { baseUrl: string; token: string };

export function importServiceConfig(env: NodeJS.ProcessEnv = process.env): ImportServiceConfig | null {
  const baseUrl = env.DOCUMENT_IMPORT_SERVICE_URL?.trim();
  const token = env.DOCUMENT_IMPORT_SERVICE_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), token };
}

/** `DOCUMENT_IMPORT_SERVICE_TIMEOUT_MS`, clamped below the routes' maxDuration.
 * Unset or invalid → the ceiling (the pipeline routinely takes minutes). */
export function dispatchTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.DOCUMENT_IMPORT_SERVICE_TIMEOUT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return DISPATCH_TIMEOUT_CEILING_MS;
  return Math.min(Math.max(parsed, DISPATCH_TIMEOUT_FLOOR_MS), DISPATCH_TIMEOUT_CEILING_MS);
}

/**
 * What the worker's HTTP status means for the job.
 * - accepted: the pipeline ran (the worker wrote the outcome to the row).
 * - worker_failed: 422 — the pipeline failed and the worker already marked
 *   the job failed with its own code.
 * - rejected: 401/403/404 — our URL or token is wrong. Retrying won't help.
 * - retry: anything else (5xx, 429, odd 4xx) — leave the job for the sweep.
 *   If the worker did start it, it is `processing` and the sweep skips it.
 */
export type DispatchVerdict = "accepted" | "worker_failed" | "rejected" | "retry";

export function classifyWorkerResponse(status: number): DispatchVerdict {
  if (status >= 200 && status < 300) return "accepted";
  if (status === 422) return "worker_failed";
  if (status === 401 || status === 403 || status === 404) return "rejected";
  return "retry";
}

export type DispatchOutcome =
  | { kind: "skipped"; reason: "not_configured" }
  | { kind: "failed"; code: string }
  | { kind: DispatchVerdict; status: number }
  | { kind: "retry"; error: string };

type DispatchDeps = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  failJob?: typeof failQueuedImportJob;
};

function isDeployed(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Send one job to the worker and wait for the answer. Never throws: every
 * failure is either recorded on the job or left for the sweep to retry.
 */
export async function dispatchImportJob(
  job: Pick<DocumentImportJob, "id" | "requestedBy" | "workspaceId">,
  deps: DispatchDeps = {},
): Promise<DispatchOutcome> {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const failJob = deps.failJob ?? failQueuedImportJob;

  const config = importServiceConfig(env);
  if (!config) {
    // Dev boxes run without the worker: the job just stays queued, as before.
    if (!isDeployed(env)) return { kind: "skipped", reason: "not_configured" };
    // Deployed without a worker URL/token: the job can never run. Say so on
    // the job instead of leaving it to look "in progress" forever.
    console.error(`[document-import] ${IMPORT_ERROR_CODES.notConfigured}: cannot dispatch ${job.id}`);
    await safeFail(failJob, job.id, IMPORT_ERROR_CODES.notConfigured,
      "The import service isn't set up on this site. Contact support.");
    return { kind: "failed", code: IMPORT_ERROR_CODES.notConfigured };
  }

  const requestId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  let status: number;
  try {
    const response = await fetchImpl(`${config.baseUrl}/v1/import-jobs/${job.id}/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.token}`,
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        job_id: job.id,
        requested_by: job.requestedBy,
        workspace_id: job.workspaceId,
      }),
      signal: AbortSignal.timeout(dispatchTimeoutMs(env)),
    });
    status = response.status;
    // Drain the body so the connection is released; its content is not needed
    // (the worker writes the outcome to the job row).
    await response.body?.cancel().catch(() => undefined);
  } catch (error) {
    // Network error, or our timeout. A timeout after the worker started leaves
    // the job `processing` (the sweep ignores it); otherwise it is still
    // `queued` and the sweep retries it.
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`[document-import] dispatch of ${job.id} did not complete: ${message}`);
    return { kind: "retry", error: message };
  }

  const verdict = classifyWorkerResponse(status);
  if (verdict === "rejected") {
    console.error(`[document-import] worker rejected ${job.id} with HTTP ${status} — check DOCUMENT_IMPORT_SERVICE_URL / _TOKEN`);
    await safeFail(failJob, job.id, IMPORT_ERROR_CODES.rejected,
      "The import service refused this file. Contact support.");
  } else if (verdict === "retry") {
    console.warn(`[document-import] worker answered HTTP ${status} for ${job.id}; the sweep will retry it`);
  }
  return { kind: verdict, status };
}

async function safeFail(
  failJob: typeof failQueuedImportJob,
  jobId: string,
  code: string,
  message: string,
): Promise<void> {
  try {
    await failJob(jobId, { code, message });
  } catch (error) {
    // The sweep's expiry is the backstop.
    console.error(`[document-import] could not mark ${jobId} failed (${code})`, error);
  }
}

/**
 * Dispatch after the current response is sent, keeping the invocation alive
 * until the worker answers. Outside a request scope (scripts, tests) `after`
 * throws; then the dispatch is started without being awaited, as before.
 * Returns whether it was scheduled with `after`.
 */
export function scheduleImportJobDispatch(
  job: Pick<DocumentImportJob, "id" | "requestedBy" | "workspaceId">,
): boolean {
  const run = () =>
    dispatchImportJob(job).catch((error: unknown) => {
      console.warn(`[document-import] dispatch of ${job.id} crashed`, error);
    });
  try {
    after(run);
    return true;
  } catch {
    void run();
    return false;
  }
}

export type ImportSweepResult = {
  expired: string[];
  retried: string[];
  skipped?: "not_configured";
};

/**
 * One cron tick: fail jobs stuck in `queued` past the max age (frees their
 * slots), then re-dispatch a few stale ones. Retries are scheduled with
 * `after` so the cron response isn't held for whole pipelines.
 */
export async function sweepStuckImportJobs(deps: {
  env?: NodeJS.ProcessEnv;
  schedule?: (job: DocumentImportJob) => unknown;
} = {}): Promise<ImportSweepResult> {
  const env = deps.env ?? process.env;
  const schedule = deps.schedule ?? scheduleImportJobDispatch;

  const expired = await expireQueuedImportJobs({
    maxAgeMinutes: QUEUED_JOB_MAX_AGE_MINUTES,
    code: IMPORT_ERROR_CODES.workerUnavailable,
    message: WORKER_UNAVAILABLE_MESSAGE,
  });

  // Without a worker there is nothing to retry against; don't claim (and so
  // don't touch) any job. The expiry above still frees the slots in time.
  if (!importServiceConfig(env)) return { expired, retried: [], skipped: "not_configured" };

  const claimed = await claimStaleQueuedImportJobs({
    staleAfterMinutes: QUEUED_JOB_STALE_MINUTES,
    maxAgeMinutes: QUEUED_JOB_MAX_AGE_MINUTES,
    limit: SWEEP_RETRY_LIMIT,
  });
  for (const job of claimed) schedule(job);
  return { expired, retried: claimed.map((job) => job.id) };
}
