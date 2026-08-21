/**
 * Contest autosave draft — pure, client-safe rev-LWW logic (plan Phase 1).
 *
 * The live draft is buffered in Redis (per-attempt hash), NOT written
 * synchronously to Postgres, so 1M concurrent autosaves never touch Neon. A
 * monotonic `rev` gives last-write-wins: an out-of-order or stale-tab write
 * (rev ≤ the stored rev) is REJECTED, so a laggy older tab can never clobber a
 * newer draft. This module holds only the decision logic + payload shape; the
 * Redis I/O lives in src/server/contest/contest-draft-store.ts and the batch
 * drain in contest-service.
 */

/** Max bytes per JSON sub-payload — matches the CBT 64KB cap so a malicious
 *  client can't bloat the buffered draft. */
export const CONTEST_DRAFT_MAX_BYTES = 64 * 1024;

/** The buffered draft payload (mirrors contest.answer_drafts columns). */
export interface ContestDraft {
  answers: Record<string, unknown>;
  palette: Record<string, unknown>;
  times: Record<string, unknown>;
  rev: number;
}

export type SaveDecision =
  | { ok: true; draft: ContestDraft }
  | { ok: false; code: number; reason: string };

function jsonBytes(value: unknown): number {
  // Byte length of the UTF-8 JSON, matching what Redis stores.
  return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
}

function coerceRev(rev: unknown): number | null {
  const n = Number(rev);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * Decide the next buffered draft given the incoming write and the currently
 * stored rev. Returns the draft to persist (with its new rev) or a rejection.
 *
 * Rules:
 *  - incoming rev must be a positive integer;
 *  - incoming rev must be strictly greater than the stored rev (LWW) — an equal
 *    or lower rev is a stale/duplicate write and is rejected 409;
 *  - payloads over the cap are rejected 413.
 */
export function decideDraftWrite(
  incoming: { answers?: unknown; palette?: unknown; times?: unknown; rev?: unknown },
  storedRev: number | null,
): SaveDecision {
  const rev = coerceRev(incoming.rev);
  if (rev === null) {
    return { ok: false, code: 400, reason: "A positive integer rev is required." };
  }
  if (storedRev !== null && rev <= storedRev) {
    return { ok: false, code: 409, reason: "stale_draft" };
  }
  const answers = (incoming.answers ?? {}) as Record<string, unknown>;
  const palette = (incoming.palette ?? {}) as Record<string, unknown>;
  const times = (incoming.times ?? {}) as Record<string, unknown>;
  if (jsonBytes(answers) > CONTEST_DRAFT_MAX_BYTES || jsonBytes(palette) > CONTEST_DRAFT_MAX_BYTES) {
    return { ok: false, code: 413, reason: "Draft payload too large." };
  }
  return { ok: true, draft: { answers, palette, times, rev } };
}

/** Redis key for a contest attempt's buffered draft. */
export function draftKey(contestId: string, userId: string): string {
  return `contest:${contestId}:draft:${userId}`;
}

/** Redis set key holding the userIds with a buffered (undrained) draft for a
 *  contest — the drain worker reads this to know which attempts to flush. */
export function draftDirtySetKey(contestId: string): string {
  return `contest:${contestId}:draft:dirty`;
}
