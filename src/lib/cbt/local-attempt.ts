/**
 * On-device memory for a CBT attempt.
 *
 * The server-held draft is authoritative, but it can only ever be as fresh as
 * the last request that actually reached it. Two gaps used to lose real work:
 *
 *  • **Identity** — the participant cookie is HttpOnly, so if it is cleared
 *    (private window, "clear data", a different browser) the student became a
 *    stranger and started a blank attempt while their real one was left to be
 *    reported absent. We mirror the student ID per room so the join screen can
 *    offer "resume as CBT-7F3K9Q" without the cookie.
 *
 *  • **Answers written while offline** — anything typed after the last
 *    successful save died with the tab. We mirror the draft on every change and
 *    replay it on the next load when it is ahead of the server.
 *
 * Everything here is best-effort: Safari private mode and storage-blocking
 * extensions throw on access, quota can be exhausted, and the app must keep
 * working regardless. Every entry point swallows its own errors.
 */

import type { CbtPaletteStatus, CbtStudentAnswer } from "./attempt-model";

const IDENTITY_PREFIX = "origin.cbt.id.";
const DRAFT_PREFIX = "origin.cbt.draft.";

export type CbtLocalIdentity = {
  studentCode: string;
  participantId: string;
  displayName: string;
  savedAt: number;
};

export type CbtLocalDraft = {
  rev: number;
  answers: Record<number, CbtStudentAnswer>;
  palette: Record<number, CbtPaletteStatus>;
  /** Per-question seconds, mirrored so an offline stretch isn't lost either. */
  times?: Record<number, number>;
  savedAt: number;
};

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const ls = window.localStorage;
    // Touch it: blocked storage throws on access, not on read of the property.
    const probe = "__origin_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or blocked storage — the server draft is still the source of truth.
  }
}

function remove(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore
  }
}

// ── Identity (per room slug) ────────────────────────────────────────────────

export function loadLocalIdentity(slug: string): CbtLocalIdentity | null {
  const found = readJson<CbtLocalIdentity>(IDENTITY_PREFIX + slug);
  if (!found || typeof found.studentCode !== "string" || !found.studentCode) return null;
  return found;
}

export function saveLocalIdentity(
  slug: string,
  identity: { studentCode: string; participantId: string; displayName: string },
): void {
  if (!identity.studentCode) return;
  writeJson(IDENTITY_PREFIX + slug, { ...identity, savedAt: Date.now() });
}

export function clearLocalIdentity(slug: string): void {
  remove(IDENTITY_PREFIX + slug);
}

// ── Draft mirror (per room + participant) ───────────────────────────────────

function draftKey(roomId: string, participantId: string): string {
  return `${DRAFT_PREFIX}${roomId}.${participantId}`;
}

export function loadLocalDraft(roomId: string, participantId: string): CbtLocalDraft | null {
  const found = readJson<CbtLocalDraft>(draftKey(roomId, participantId));
  if (!found || typeof found.rev !== "number") return null;
  return {
    rev: found.rev,
    answers: found.answers ?? {},
    palette: found.palette ?? {},
    times: found.times ?? {},
    savedAt: found.savedAt ?? 0,
  };
}

export function saveLocalDraft(roomId: string, participantId: string, draft: Omit<CbtLocalDraft, "savedAt">): void {
  writeJson(draftKey(roomId, participantId), { ...draft, savedAt: Date.now() });
}

export function clearLocalDraft(roomId: string, participantId: string): void {
  remove(draftKey(roomId, participantId));
}

/**
 * Whether the on-device copy holds work the server has not seen.
 *
 * Revisions are compared, never timestamps: device clocks are unreliable (a
 * skewed clock is one of the ways a student got auto-submitted early), while
 * `rev` is issued by the same browser that owns the draft and echoed back by
 * the server.
 */
export function localDraftIsAhead(local: CbtLocalDraft | null, serverRev: number): boolean {
  if (!local) return false;
  if (local.rev <= serverRev) return false;
  return Object.keys(local.answers).length > 0 || Object.keys(local.palette).length > 0;
}
