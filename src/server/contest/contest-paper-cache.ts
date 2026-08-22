/**
 * Contest paper cache — the read-side thundering-herd defense (plan Phase 1,
 * §1.2 read-spike). At a synchronized start_at, ~1M clients request the paper
 * within seconds. The published question set is IMMUTABLE, so it is cached once
 * in Redis and served to everyone; a SINGLE-FLIGHT lock ensures a cold miss
 * triggers exactly one origin fill (from Postgres) instead of 1M concurrent
 * scans. The cached payload is the shared, ANSWER-KEY-STRIPPED student view; the
 * per-user shuffle is a deterministic seeded transform applied AFTER the cache
 * (so the cache stays shared).
 */

import { Redis } from "@upstash/redis";

import { getUserPostgresReplicaPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

function canUseLocalFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** A single question as the STUDENT sees it — no answer key, no explanation. */
export interface PaperQuestion {
  position: number;
  questionId: string;
  subject: string | null;
  sectionId: string | null;
  text: unknown;
  options: unknown;
  questionType: unknown;
  image: unknown;
  optionImages: unknown;
  marks: number | null;
  negativeMarks: number | null;
}

export interface ContestPaper {
  contestId: string;
  questions: PaperQuestion[];
}

function paperKey(contestId: string): string {
  return `contest:${contestId}:paper`;
}
function paperLockKey(contestId: string): string {
  return `contest:${contestId}:paper:lock`;
}

const PAPER_TTL_SECONDS = 24 * 60 * 60; // a contest paper is short-lived; a day is plenty
const LOCK_TTL_SECONDS = 10;

// In-process cache so a burst of reads on ONE lambda collapses to one Redis GET.
const localPaperCache = new Map<string, { paper: ContestPaper; expiresAt: number }>();
const LOCAL_TTL_MS = 30_000;

function pool() {
  // Read-only origin fill of the immutable paper — safe on a replica (the paper
  // never changes after publish, so replica lag is irrelevant).
  const p = getUserPostgresReplicaPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * The ONLY sanitization boundary: strip answer keys/explanations from a frozen
 * snapshot down to the renderable student fields. If a new answer-bearing field
 * is ever added to the snapshot, it stays hidden unless explicitly whitelisted
 * here.
 */
function sanitizeQuestion(row: {
  position: number;
  question_id: string;
  subject: string | null;
  section_id: string | null;
  snapshot: Record<string, unknown>;
  marks: number | null;
  negative_marks: number | null;
}): PaperQuestion {
  const s = row.snapshot ?? {};
  return {
    position: row.position,
    questionId: row.question_id,
    subject: row.subject,
    sectionId: row.section_id,
    text: s.text,
    options: s.options,
    questionType: s.questionType,
    // Diagrams are renderable, answer-free content — safe to expose.
    image: s.image ?? null,
    optionImages: s.optionImages ?? null,
    marks: row.marks,
    negativeMarks: row.negative_marks,
    // DELIBERATELY OMITTED: correctOption, correctOptions, answerText, tolerance,
    // explanation — the answer key never reaches the student paper.
  };
}

/** Build the sanitized paper straight from Postgres (the origin fill). */
async function buildPaperFromDb(contestId: string): Promise<ContestPaper> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT position, question_id, subject, section_id, snapshot, marks, negative_marks
       FROM contest.contest_questions WHERE contest_id = $1 ORDER BY position ASC`,
    [contestId],
  );
  return { contestId, questions: res.rows.map(sanitizeQuestion) };
}

async function readRedisPaper(contestId: string): Promise<ContestPaper | null> {
  if (!redis) return null;
  const raw = (await redis.get(paperKey(contestId))) as ContestPaper | string | null;
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as ContestPaper) : raw;
}

async function writeRedisPaper(paper: ContestPaper): Promise<void> {
  if (!redis) return;
  await redis.set(paperKey(paper.contestId), JSON.stringify(paper), { ex: PAPER_TTL_SECONDS });
}

/**
 * Pre-warm the cache (call at publish / reg_close, well before start_at) so the
 * start_at burst is served entirely from cache with zero origin fills.
 */
export async function prewarmContestPaper(contestId: string): Promise<ContestPaper> {
  const paper = await buildPaperFromDb(contestId);
  await writeRedisPaper(paper);
  localPaperCache.set(contestId, { paper, expiresAt: Date.now() + LOCAL_TTL_MS });
  return paper;
}

/**
 * Get the sanitized, shared contest paper. Cache path: in-process → Redis →
 * (single-flight) origin fill. The single-flight lock (SET NX) means a cold
 * miss under a 1M-client burst results in ONE origin fill; the losers briefly
 * back off and re-read the now-populated cache.
 */
export async function getContestPaper(contestId: string): Promise<ContestPaper> {
  const now = Date.now();
  const localHit = localPaperCache.get(contestId);
  if (localHit && localHit.expiresAt > now) return localHit.paper;

  const cached = await readRedisPaper(contestId);
  if (cached) {
    localPaperCache.set(contestId, { paper: cached, expiresAt: now + LOCAL_TTL_MS });
    return cached;
  }

  // Cold miss → single-flight fill.
  if (redis) {
    const gotLock = await redis.set(paperLockKey(contestId), "1", { nx: true, ex: LOCK_TTL_SECONDS });
    if (!gotLock) {
      // Someone else is filling; briefly poll the cache before falling back.
      for (let i = 0; i < 20; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        const filled = await readRedisPaper(contestId);
        if (filled) {
          localPaperCache.set(contestId, { paper: filled, expiresAt: Date.now() + LOCAL_TTL_MS });
          return filled;
        }
      }
      // Lock holder stalled — fall through and fill ourselves rather than error.
    }
  }

  const paper = await buildPaperFromDb(contestId);
  await writeRedisPaper(paper);
  if (redis) await redis.del(paperLockKey(contestId));
  localPaperCache.set(contestId, { paper, expiresAt: Date.now() + LOCAL_TTL_MS });
  return paper;
}

/** Test-only: reset the in-process cache. */
export function __resetPaperCacheForTests(): void {
  localPaperCache.clear();
}
