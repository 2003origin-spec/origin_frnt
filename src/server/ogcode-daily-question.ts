/**
 * Question of the Day — the four daily subject draws.
 *
 * Plan: V1/allmd/QUESTION_OF_THE_DAY_PER_STUDENT_PLAN_2026-08-19.md
 *
 * The feature splits into a stateful global draw and a stateless per-student
 * view, and this module owns the first half:
 *
 *   MIDNIGHT IST                       ON EVERY REQUEST (src/legacy/assessments.ts)
 *   ------------                       --------------------------------------------
 *   4 bags -> 4 draws                  cohort  = scope.subjects        (derived)
 *   (senior x P/C/M/B)                 band    = class band of student (derived)
 *         |                            subject = cohort[istEpochDay % cohort.length]
 *   ogcode_daily_subject_questions            |
 *   (4 rows / day)                     look up (today, band, subject)
 *
 * A "bag" is one subject within one class band. Each bag draws ONE question a
 * day, never repeating until it has served everything it holds, at which point
 * its cycle counter increments and a fresh random pass begins.
 *
 * Nothing here is per-student. Which of the four draws a student sees is a pure
 * function of their accessible subjects and the day number, so student cohorts
 * are derived on every request and never stored — access changes take effect on
 * the next request with no recompute and nothing to backfill.
 *
 * Postgres is the source of truth; Redis is a cache whose every key can be
 * rebuilt from it, so an eviction costs a query and can never cause a repeat.
 */

import { Redis } from "@upstash/redis";

import { ALL_SUBJECTS, type Subject } from "@/lib/entitlements";
import { istDateKey } from "@/lib/ist-day";
import {
  ALL_CLASS_BANDS,
  bandClasses,
  bandIncludesUnclassified,
  type ClassBand,
} from "@/lib/qotd-eligibility";
import { drawOgcodeBagQuestion } from "@/server/ogcode-catalog";
import { getOgcodePostgresPool } from "@/server/postgres";

declare global {
  var __originOgcodeDailyQuestionSchemaReady: Promise<void> | undefined;
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

/** Null in local dev and wherever Upstash is unconfigured — every read still works. */
const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/** The day hash holds four fields; 36 h outlives the day it describes. */
const DAY_KEY_TTL_SECONDS = 36 * 60 * 60;
/** Served sets are rebuilt from Postgres weekly, which is also the drift repair. */
const SERVED_KEY_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Canonical SQL: src/db/migrations/20260819_ogcode_daily_subject_questions.sql.
 * Mirrored here so an un-migrated database self-heals on first use, exactly as
 * ensureCatalogSchema does for ogcode_questions.
 */
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_daily_subject_questions (
    pick_date   DATE    NOT NULL,
    class_band  TEXT    NOT NULL,
    subject     TEXT    NOT NULL,
    question_id TEXT    NOT NULL,
    cycle       INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (pick_date, class_band, subject)
  );
  CREATE INDEX IF NOT EXISTS ogcode_daily_subject_questions_bag_idx
    ON ogcode_daily_subject_questions (class_band, subject, cycle);
`;

async function ensureSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) return;
  if (!globalThis.__originOgcodeDailyQuestionSchemaReady) {
    globalThis.__originOgcodeDailyQuestionSchemaReady = pool
      .query(CREATE_TABLE_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalThis.__originOgcodeDailyQuestionSchemaReady = undefined;
        throw error;
      });
  }
  await globalThis.__originOgcodeDailyQuestionSchemaReady;
}

/** One bag: a subject within a class band. */
export type QuestionBag = {
  band: ClassBand;
  subject: Subject;
};

export type DailyDraw = {
  subject: Subject;
  band: ClassBand;
  questionId: string;
  cycle: number;
  /** True when this draw exhausted the bag and started a fresh pass. */
  recycled: boolean;
};

/** The bags drawn for a band — one per canonical subject. */
export function bagsForBand(band: ClassBand): QuestionBag[] {
  return ALL_SUBJECTS.map((subject) => ({ band, subject }));
}

function dayHashKey(dateKey: string): string {
  return `ogcode:qotd:day:${dateKey}`;
}

function dayHashField(band: ClassBand, subject: Subject): string {
  return `${band}:${subject}`;
}

function servedKey(band: ClassBand, subject: Subject, cycle: number): string {
  return `ogcode:qotd:served:${band}:${subject}:${cycle}`;
}

/** `"{cycle}:{questionId}"` — one Redis field carries both halves of a draw. */
function encodeDraw(cycle: number, questionId: string): string {
  return `${cycle}:${questionId}`;
}

function decodeDraw(raw: unknown): { cycle: number; questionId: string } | null {
  if (typeof raw !== "string") return null;
  const separator = raw.indexOf(":");
  if (separator <= 0) return null;
  const cycle = Number(raw.slice(0, separator));
  const questionId = raw.slice(separator + 1);
  if (!Number.isFinite(cycle) || !questionId) return null;
  return { cycle, questionId };
}

/**
 * The cycle a bag is currently on, and every question it has served in it.
 *
 * Read from Redis when warm, otherwise rebuilt from the ledger — which is also
 * why a Redis eviction can never make a bag repeat itself. The served set grows
 * by one row per day of the cycle, so even a five-year Biology pass is under
 * 2 000 ids.
 */
async function loadBagState(
  band: ClassBand,
  subject: Subject,
): Promise<{ cycle: number; served: string[] }> {
  const pool = getOgcodePostgresPool();
  if (!pool) return { cycle: 1, served: [] };

  // The bag's newest cycle and how many questions it has served in it, in one
  // indexed read (the bag index is exactly (class_band, subject, cycle)). No
  // rows at all means the bag has never been drawn: cycle 1, nothing served.
  const cycleResult = await pool.query<{ cycle: number | string; served: number | string }>(
    `SELECT cycle, count(*)::int AS served
       FROM ogcode_daily_subject_questions
      WHERE class_band = $1 AND subject = $2
      GROUP BY cycle
      ORDER BY cycle DESC
      LIMIT 1`,
    [band, subject],
  );
  const cycle = Math.max(1, Number(cycleResult.rows[0]?.cycle ?? 1));
  const servedCount = Number(cycleResult.rows[0]?.served ?? 0);

  if (redis && servedCount > 0) {
    try {
      const cached = await redis.smembers(servedKey(band, subject, cycle));
      // Trust the cache ONLY when it holds exactly as many ids as the ledger
      // recorded for this cycle. A short set means a write was interrupted
      // between the INSERT and the SADD, and using it would let an already-served
      // question be drawn again — the one guarantee this feature is defined by.
      if (cached.length === servedCount) {
        return { cycle, served: cached.map(String) };
      }
    } catch {
      // Cache miss or outage — fall through to the ledger.
    }
  }

  const servedResult = await pool.query<{ question_id: string }>(
    `SELECT question_id FROM ogcode_daily_subject_questions
      WHERE class_band = $1 AND subject = $2 AND cycle = $3`,
    [band, subject, cycle],
  );
  const served = servedResult.rows.map((row) => row.question_id);

  if (redis && served.length > 0) {
    try {
      // Delete first: we may be here BECAUSE the cached set was short, and
      // sadd would union into it rather than replace it, preserving the drift.
      // sadd's signature is (key, member, ...members), so the first id is
      // passed explicitly — a bare spread of a string[] does not type-check.
      await redis.del(servedKey(band, subject, cycle));
      await redis.sadd(servedKey(band, subject, cycle), served[0], ...served.slice(1));
      await redis.expire(servedKey(band, subject, cycle), SERVED_KEY_TTL_SECONDS);
    } catch {
      // Warming the cache is best-effort.
    }
  }
  return { cycle, served };
}

/**
 * Draw one bag for one day, idempotently.
 *
 * Returns the EXISTING row if the bag has already been drawn for that day — the
 * midnight cron and a lazy first read can race on the same bag and must converge
 * on one question, which `ON CONFLICT DO NOTHING` plus an authoritative read-back
 * guarantees (the same trick the old per-mode selector used).
 *
 * Returns null when the bag holds nothing, which today is every junior-band bag.
 */
export async function drawBagForDay(
  bag: QuestionBag,
  dateKey: string,
): Promise<DailyDraw | null> {
  const pool = getOgcodePostgresPool();
  if (!pool) return null;
  await ensureSchema();


  const existing = await pool.query<{ question_id: string; cycle: number }>(
    `SELECT question_id, cycle FROM ogcode_daily_subject_questions
      WHERE pick_date = $1 AND class_band = $2 AND subject = $3`,
    [dateKey, bag.band, bag.subject],
  );
  if (existing.rows[0]) {
    return {
      subject: bag.subject,
      band: bag.band,
      questionId: existing.rows[0].question_id,
      cycle: Number(existing.rows[0].cycle),
      recycled: false,
    };
  }

  const { cycle, served } = await loadBagState(bag.band, bag.subject);
  const draw = await drawOgcodeBagQuestion({
    subject: bag.subject,
    classes: bandClasses(bag.band),
    includeUnclassified: bandIncludesUnclassified(bag.band),
    alreadyServed: served,
  });
  if (!draw.questionId || draw.bagTotal === 0) {
    return null;
  }

  // The bag handed out its last question yesterday: start a fresh pass. The
  // draw already came from the whole bag (see drawOgcodeBagQuestion), so all
  // that is left is to record it under the new cycle.
  const recycled = draw.unservedTotal === 0;
  const effectiveCycle = recycled ? cycle + 1 : cycle;

  await pool.query(
    `INSERT INTO ogcode_daily_subject_questions (pick_date, class_band, subject, question_id, cycle)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (pick_date, class_band, subject) DO NOTHING`,
    [dateKey, bag.band, bag.subject, draw.questionId, effectiveCycle],
  );

  // Read back rather than trusting our own draw: a concurrent caller may have
  // won the insert, and every student must see the same question.
  const authoritative = await pool.query<{ question_id: string; cycle: number }>(
    `SELECT question_id, cycle FROM ogcode_daily_subject_questions
      WHERE pick_date = $1 AND class_band = $2 AND subject = $3`,
    [dateKey, bag.band, bag.subject],
  );
  const winner = authoritative.rows[0];
  const questionId = winner?.question_id ?? draw.questionId;
  const winningCycle = Number(winner?.cycle ?? effectiveCycle);

  if (redis) {
    try {
      await redis.sadd(servedKey(bag.band, bag.subject, winningCycle), questionId);
      await redis.expire(servedKey(bag.band, bag.subject, winningCycle), SERVED_KEY_TTL_SECONDS);
    } catch {
      // Best-effort; the ledger already has it.
    }
  }

  return {
    subject: bag.subject,
    band: bag.band,
    questionId,
    cycle: winningCycle,
    recycled: recycled && winningCycle !== cycle,
  };
}

/**
 * Draw every bag for a day and warm the day hash.
 *
 * This is what the midnight cron calls. It is also safe to call at any other
 * time and any number of times: each bag is idempotent per day, so a re-run is a
 * no-op rather than a re-draw.
 */
export async function runDailyQuestionRollover(
  dateKey: string = istDateKey(),
  bands: readonly ClassBand[] = ALL_CLASS_BANDS,
): Promise<{ dateKey: string; draws: DailyDraw[]; skipped: string[] }> {
  const draws: DailyDraw[] = [];
  const skipped: string[] = [];

  for (const band of bands) {
    for (const bag of bagsForBand(band)) {
      const draw = await drawBagForDay(bag, dateKey);
      if (draw) {
        draws.push(draw);
      } else {
        // An empty bag is normal, not an error: the junior band holds nothing
        // until class 9-10 content is imported.
        skipped.push(`${band}:${bag.subject}`);
      }
    }
  }

  if (redis && draws.length > 0) {
    try {
      const fields: Record<string, string> = {};
      for (const draw of draws) {
        fields[dayHashField(draw.band, draw.subject)] = encodeDraw(draw.cycle, draw.questionId);
      }
      await redis.hset(dayHashKey(dateKey), fields);
      await redis.expire(dayHashKey(dateKey), DAY_KEY_TTL_SECONDS);
    } catch {
      // Warming is best-effort; reads fall through to Postgres.
    }
  }

  return { dateKey, draws, skipped };
}

/**
 * Today's question id for one bag — the read every student request lands on.
 *
 * Redis first (one field read serves every student in the cohort), then the
 * ledger, then a lazy draw. That last step is what makes the midnight cron an
 * optimisation rather than a correctness dependency: a missed run, a cold
 * preview deploy or a local box with no scheduler still shows the right card,
 * because the first request of the day draws it.
 */
export async function getDailyQuestionId(
  bag: QuestionBag,
  dateKey: string = istDateKey(),
): Promise<string | null> {

  if (redis) {
    try {
      const cached = decodeDraw(
        await redis.hget(dayHashKey(dateKey), dayHashField(bag.band, bag.subject)),
      );
      if (cached) return cached.questionId;
    } catch {
      // Fall through to Postgres.
    }
  }

  const draw = await drawBagForDay(bag, dateKey);
  if (!draw) return null;

  if (redis) {
    try {
      await redis.hset(dayHashKey(dateKey), {
        [dayHashField(bag.band, bag.subject)]: encodeDraw(draw.cycle, draw.questionId),
      });
      await redis.expire(dayHashKey(dateKey), DAY_KEY_TTL_SECONDS);
    } catch {
      // Best-effort.
    }
  }
  return draw.questionId;
}
