/**
 * The status line a teacher sees on a CBT import job that has nothing to
 * review yet. Pure, so it can be unit-tested and shared by client components.
 *
 * Before this, every job without reviewable questions — failed ones included —
 * said "Extraction in progress", so a dead import looked alive forever.
 * Plan: V1/IMPORT_PIPELINE_RELIABILITY_PLAN.md (Phase 1, UI).
 */

import type { ImportJobStatus } from "@/server/workspaces/types";

/** A queued job older than this is waiting on the worker, not just starting. */
export const QUEUED_WAITING_AFTER_MS = 2 * 60 * 1000;

export type ImportJobNotice = { tone: "info" | "error"; text: string } | null;

export function importJobNotice(
  job: { status: ImportJobStatus; errorMessage: string | null; createdAt: string },
  opts: { hasReviewableQuestions: boolean; nowMs: number },
): ImportJobNotice {
  switch (job.status) {
    case "succeeded":
    case "needs_review":
      return null;
    case "failed":
      return {
        tone: "error",
        text: job.errorMessage?.trim() || "This import failed. Upload the file again.",
      };
    case "cancelled":
      return { tone: "error", text: "This import was cancelled." };
    case "queued": {
      if (opts.hasReviewableQuestions) return null;
      const createdMs = Date.parse(job.createdAt);
      if (Number.isFinite(createdMs) && opts.nowMs - createdMs > QUEUED_WAITING_AFTER_MS) {
        return {
          tone: "info",
          text:
            "Waiting for the import service… We retry automatically. If it still hasn't started after 45 minutes, the import is marked failed and you can upload the file again.",
        };
      }
      return { tone: "info", text: "Extraction in progress. Refresh in a moment to review the questions." };
    }
    case "processing":
    default:
      return opts.hasReviewableQuestions
        ? null
        : { tone: "info", text: "Extraction in progress. Refresh in a moment to review the questions." };
  }
}
