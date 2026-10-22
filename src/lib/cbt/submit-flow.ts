/**
 * The CBT submit sequence, kept free of React and fetch so it can be tested.
 *
 * `/api/cbt-student/submit` grades the SERVER-held draft. If the final answer
 * flush has not landed, a successful submit grades stale answers, and the
 * caller then deletes the on-device copy that still held the newest ones. So
 * every attempt first makes sure the draft is on the server, and only a
 * confirmed flush followed by a confirmed submit counts as "submitted".
 * A save the server rejects for good (an explicit validation/size refusal,
 * see classifyCbtSaveFailure) must not block the submit forever: it submits
 * anyway and reports "submitted_unsaved".
 */

/** Result of pushing the draft to the server. */
export type CbtFlushOutcome =
  /** Saved (or there was nothing new to save). */
  | "ok"
  /** Network error, 5xx/429/408, or a 409 stale_draft: try again. */
  | "retry"
  /**
   * The server refused this draft for good (an explicit validation/size
   * refusal): no retry can ever land it, so it must not block the submit.
   */
  | "rejected"
  /** The server already finalized this attempt; nothing more can be saved. */
  | "finalized"
  /** Kicked, or the attempt was resumed elsewhere. */
  | "unauthorized";

export type CbtSubmitRequestOutcome = "ok" | "retry" | "unauthorized";

export type CbtSubmitOutcome =
  /** Final answers confirmed on the server AND the submit was accepted. */
  | "submitted"
  /**
   * Submitted, but the server permanently rejected the final save, so it
   * graded the draft it already held. The local draft must be KEPT: it holds
   * answers the server never got, for a teacher to recover.
   */
  | "submitted_unsaved"
  /** The server finalized the attempt on its own (deadline sweep, teacher). */
  | "finalized"
  | "unauthorized"
  /** Gave up after all retries; the local draft must be kept for resume. */
  | "failed";

export type CbtSubmitFlowDeps = {
  /** Whether there are answers the server has not confirmed yet. */
  isDirty: () => boolean;
  flush: () => Promise<CbtFlushOutcome>;
  submit: () => Promise<CbtSubmitRequestOutcome>;
  sleep: (ms: number) => Promise<void>;
  /** Delay before each retry; attempts = backoffs.length + 1. */
  backoffs: readonly number[];
  /** Called before each retry wait, with what failed. */
  onRetry?: (stage: "save" | "submit", attempt: number) => void;
};

/**
 * The `code`s the answers route sends when THIS draft can never be accepted
 * (src/app/api/cbt-student/answers/route.ts, cbt-attempts-service saveAnswers).
 */
export const CBT_SAVE_REJECTION_CODES: ReadonlySet<string> = new Set(["invalid_body", "payload_too_large"]);

/**
 * Whether a failed answers save (not 401/409, which the caller handles) is
 * worth retrying. Only an explicit validation refusal is permanent: a
 * 400/413/422 carrying one of {@link CBT_SAVE_REJECTION_CODES}, or a bare 413
 * (a platform body-size limit sends no code, and a too-large draft never
 * shrinks). Everything else retries — a bare 400 may be a proxy or an
 * unclassified server error, and giving up on it at the bell submits a stale
 * draft and loses the student's last answers.
 */
export function classifyCbtSaveFailure(status: number, code?: string | null): "retry" | "rejected" {
  if (status === 413) return "rejected";
  if ((status === 400 || status === 422) && typeof code === "string" && CBT_SAVE_REJECTION_CODES.has(code)) {
    return "rejected";
  }
  return "retry";
}

export async function runCbtSubmitFlow(deps: CbtSubmitFlowDeps): Promise<CbtSubmitOutcome> {
  const { backoffs } = deps;
  // Once the server has refused the draft for good, stop trying to save it:
  // submit anyway (the server grades the draft it holds).
  let saveRejected = false;
  for (let attempt = 0; attempt <= backoffs.length; attempt += 1) {
    let stage: "save" | "submit" = "save";
    // The answers have to land first: never submit while the server copy is
    // behind this device — unless the server has refused them permanently.
    const flushed: CbtFlushOutcome = saveRejected ? "rejected" : deps.isDirty() ? await safeFlush(deps) : "ok";
    if (flushed === "finalized") return "finalized";
    if (flushed === "unauthorized") return "unauthorized";
    if (flushed === "rejected") saveRejected = true;
    if (saveRejected || (flushed === "ok" && !deps.isDirty())) {
      stage = "submit";
      const res = await safeSubmit(deps);
      if (res === "ok") return saveRejected ? "submitted_unsaved" : "submitted";
      if (res === "unauthorized") return "unauthorized";
    }
    if (attempt < backoffs.length) {
      deps.onRetry?.(stage, attempt);
      await deps.sleep(backoffs[attempt]);
    }
  }
  return "failed";
}

async function safeFlush(deps: CbtSubmitFlowDeps): Promise<CbtFlushOutcome> {
  try {
    return await deps.flush();
  } catch {
    return "retry";
  }
}

async function safeSubmit(deps: CbtSubmitFlowDeps): Promise<CbtSubmitRequestOutcome> {
  try {
    return await deps.submit();
  } catch {
    return "retry";
  }
}
