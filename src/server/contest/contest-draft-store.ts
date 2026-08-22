/**
 * Contest autosave draft store — the Redis (Upstash) WRITE path for the live
 * attempt draft (plan Phase 1). This is the hot path 1M concurrent autosaves
 * hit; it NEVER writes to Postgres. contest-service `/v1/drain` later batch-
 * flushes the buffered drafts into contest.answer_drafts.
 *
 * The rev-guard (last-write-wins, reject stale) is applied ATOMICALLY so two
 * racing tabs can't interleave a stale write past a newer one:
 *  - Upstash: a Lua eval does read-rev → compare → conditional set + dirty-set
 *    add in one round trip.
 *  - Dev (no Redis): an in-memory map replicates the same decision.
 *
 * The pure decision logic + key helpers live in @/lib/contest/draft-buffer.
 */

import { Redis } from "@upstash/redis";

import {
  type ContestDraft,
  type SaveDecision,
  decideDraftWrite,
  draftDirtySetKey,
  draftKey,
} from "@/lib/contest/draft-buffer";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

function canUseLocalFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

// In-memory dev fallback: draft JSON per key + a dirty set per contest.
const localDrafts = new Map<string, ContestDraft>();
const localDirty = new Map<string, Set<string>>();

export type SaveResult =
  | { ok: true; rev: number }
  | { ok: false; code: number; reason: string };

/**
 * Atomic compare-and-set on Upstash. KEYS[1]=draft key, KEYS[2]=dirty set;
 * ARGV[1]=incoming rev, ARGV[2]=draft json, ARGV[3]=userId. Writes only when
 * the incoming rev is strictly greater than the stored rev; returns the stored
 * rev on reject (so the caller can tell the client to re-sync).
 */
// ARGV[4] = TTL seconds for the draft + dirty-set keys. A safety net well beyond
// any contest's duration+grace so keys can't accumulate unbounded in Redis if the
// drain worker isn't running (e.g. CONTEST_SERVICE_URL unset), while never
// expiring a draft mid-contest.
const DRAFT_TTL_SECONDS = 2 * 24 * 60 * 60; // 2 days
const CAS_LUA = `
local cur = redis.call('HGET', KEYS[1], 'rev')
local incoming = tonumber(ARGV[1])
if cur and tonumber(cur) >= incoming then
  return {0, tonumber(cur)}
end
redis.call('HSET', KEYS[1], 'rev', incoming, 'draft', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[4])
redis.call('SADD', KEYS[2], ARGV[3])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return {1, incoming}
`;

/**
 * Persist an autosave draft to the Redis buffer with the rev-LWW guard. Returns
 * the accepted rev, or a rejection ({409 stale_draft, 400 bad rev, 413 too big}).
 * Never touches Postgres.
 */
export async function saveContestDraft(
  contestId: string,
  userId: string,
  incoming: { answers?: unknown; palette?: unknown; times?: unknown; rev?: unknown },
): Promise<SaveResult> {
  // Payload + rev validation up front (cheap, no I/O). storedRev=null here only
  // gates format/size; the true stale check happens atomically below.
  const pre: SaveDecision = decideDraftWrite(incoming, null);
  if (!pre.ok) return { ok: false, code: pre.code, reason: pre.reason };
  const draft = pre.draft;
  const key = draftKey(contestId, userId);
  const dirty = draftDirtySetKey(contestId);
  const draftJson = JSON.stringify(draft);

  if (redis) {
    const [written, rev] = (await redis.eval(
      CAS_LUA,
      [key, dirty],
      [String(draft.rev), draftJson, userId, String(DRAFT_TTL_SECONDS)],
    )) as [number, number];
    if (written === 1) return { ok: true, rev };
    return { ok: false, code: 409, reason: "stale_draft" };
  }

  if (!canUseLocalFallback()) {
    // Prod with no Redis configured is a hard misconfiguration for the hot path.
    throw new Error("Contest draft buffer requires UPSTASH_REDIS_REST_URL in production.");
  }

  // In-memory fallback with the same LWW semantics.
  const stored = localDrafts.get(key) ?? null;
  const decision = decideDraftWrite(incoming, stored ? stored.rev : null);
  if (!decision.ok) return { ok: false, code: decision.code, reason: decision.reason };
  localDrafts.set(key, decision.draft);
  const set = localDirty.get(dirty) ?? new Set<string>();
  set.add(userId);
  localDirty.set(dirty, set);
  return { ok: true, rev: decision.draft.rev };
}

/** Read a buffered draft (for the resume/GET-state path). Null if none. */
export async function readContestDraft(
  contestId: string,
  userId: string,
): Promise<ContestDraft | null> {
  const key = draftKey(contestId, userId);
  if (redis) {
    const raw = (await redis.hget(key, "draft")) as string | null;
    if (!raw) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as ContestDraft) : (raw as ContestDraft);
  }
  return localDrafts.get(key) ?? null;
}

/** Test-only: reset the in-memory fallback between cases. */
export function __resetLocalDraftBufferForTests(): void {
  localDrafts.clear();
  localDirty.clear();
}
