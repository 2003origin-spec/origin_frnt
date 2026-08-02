/**
 * Identity recovery for the anonymous CBT student surface — pure logic.
 *
 * A student whose browser died mid-test has four ways back into their attempt,
 * in decreasing order of strength:
 *   1. the HttpOnly `cbt_participant` cookie (survives a browser restart);
 *   2. the student ID remembered in localStorage on that device;
 *   3. the student ID typed by hand + the room code;
 *   4. their NAME + the room code, confirmed against a candidate list.
 *
 * (4) is the last resort and is deliberately narrow: it only ever offers
 * attempts that are **unfinished** and **currently offline**, so a live session
 * can never be stolen and a submitted paper can never be re-opened. Rooms can
 * opt out entirely with `rejoin_policy = 'id_only'`.
 */

import type { CbtRejoinPolicy } from "./room-model";
import { CBT_PRESENCE_WINDOW_MS } from "./finalize-reason";

/**
 * Case/whitespace/unicode-insensitive name key. NFKC folds full-width and
 * compatibility forms so "ＲＡＨＵＬ" matches "Rahul"; control characters are
 * dropped for the same reason the display name strips them.
 */
export function normalizeParticipantName(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type CbtReclaimCandidate = {
  participantId: string;
  studentCode: string;
  answeredCount: number;
  lastSeenAt: string | null;
};

export type ReclaimRow = {
  participantId: string;
  displayName: string;
  studentCode: string;
  answeredCount: number;
  lastSeenAt: string | null;
  finishedAt: string | null;
  kicked: boolean;
};

export type ReclaimInput = {
  rows: ReclaimRow[];
  enteredName: string;
  policy: CbtRejoinPolicy;
  now: number;
  presenceWindowMs?: number;
};

/**
 * Attempts the entered name may reclaim. Empty means "no offer" — the caller
 * falls through to creating a brand-new participant, which is always the safe
 * default.
 */
export function pickReclaimCandidates(input: ReclaimInput): CbtReclaimCandidate[] {
  if (input.policy === "id_only") return [];
  const key = normalizeParticipantName(input.enteredName);
  if (!key) return [];
  const window = input.presenceWindowMs ?? CBT_PRESENCE_WINDOW_MS;

  return input.rows
    .filter((row) => {
      if (row.finishedAt || row.kicked) return false;
      if (normalizeParticipantName(row.displayName) !== key) return false;
      const lastSeen = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : null;
      // Only an attempt nobody is currently sitting at may be handed over.
      return lastSeen === null || !Number.isFinite(lastSeen) || input.now - lastSeen > window;
    })
    .sort((a, b) => {
      // Most progress first — the likeliest "their own" attempt.
      if (b.answeredCount !== a.answeredCount) return b.answeredCount - a.answeredCount;
      return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
    })
    .map((row) => ({
      participantId: row.participantId,
      studentCode: row.studentCode,
      answeredCount: row.answeredCount,
      lastSeenAt: row.lastSeenAt,
    }));
}
