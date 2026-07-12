/**
 * OGCode Scoring V2 — per-(student, question) attempt/reveal progress
 * (V1/OGCODE_SCORING_ALGORITHM.md, Phase 1b).
 *
 * Single owner of the ogcode_question_progress table: no other module talks
 * SQL to it. Backs the CS_core scoring engine with TA (total_attempts,
 * incremented atomically — never read-modify-write), the Attempted flag, and
 * the reveal flags that pick which bs decay applies (hint → bs/2, answer → 0).
 *
 * Canonical SQL: src/db/migrations/20260712_ogcode_scoring_v2.sql
 */

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";

declare global {
  var __originOgcodeProgressSchemaReady: Promise<void> | undefined;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_question_progress (
    user_id           TEXT NOT NULL,
    question_id       TEXT NOT NULL,
    total_attempts    INTEGER NOT NULL DEFAULT 0,
    attempted         BOOLEAN NOT NULL DEFAULT FALSE,
    hint_revealed     BOOLEAN NOT NULL DEFAULT FALSE,
    answer_revealed   BOOLEAN NOT NULL DEFAULT FALSE,
    best_score        NUMERIC,
    first_terminal_at TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, question_id)
  );

  CREATE INDEX IF NOT EXISTS ogcode_question_progress_question_idx
    ON ogcode_question_progress (question_id);
`;

export type OgcodeQuestionProgress = {
  userId: string;
  questionId: string;
  totalAttempts: number;
  attempted: boolean;
  hintRevealed: boolean;
  answerRevealed: boolean;
  bestScore: number | null;
  firstTerminalAt: string | null;
};

type ProgressRow = {
  user_id: string;
  question_id: string;
  total_attempts: number | string;
  attempted: boolean;
  hint_revealed: boolean;
  answer_revealed: boolean;
  best_score: number | string | null;
  first_terminal_at: string | Date | null;
};

function mapRow(row: ProgressRow): OgcodeQuestionProgress {
  return {
    userId: row.user_id,
    questionId: row.question_id,
    totalAttempts: Number(row.total_attempts ?? 0),
    attempted: Boolean(row.attempted),
    hintRevealed: Boolean(row.hint_revealed),
    answerRevealed: Boolean(row.answer_revealed),
    bestScore: row.best_score == null ? null : Number(row.best_score),
    firstTerminalAt:
      row.first_terminal_at == null
        ? null
        : row.first_terminal_at instanceof Date
          ? row.first_terminal_at.toISOString()
          : String(row.first_terminal_at),
  };
}

function emptyProgress(userId: string, questionId: string): OgcodeQuestionProgress {
  return {
    userId,
    questionId,
    totalAttempts: 0,
    attempted: false,
    hintRevealed: false,
    answerRevealed: false,
    bestScore: null,
    firstTerminalAt: null,
  };
}

export function isOgcodeProgressAvailable(): boolean {
  return isOgcodePostgresConfigured();
}

async function ensureProgressSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return;
  }

  if (!globalThis.__originOgcodeProgressSchemaReady) {
    globalThis.__originOgcodeProgressSchemaReady = pool.query(CREATE_TABLE_SQL).then(() => undefined).catch((error) => {
      globalThis.__originOgcodeProgressSchemaReady = undefined;
      throw error;
    });
  }

  await globalThis.__originOgcodeProgressSchemaReady;
}

/** Current progress for one (student, question); zeros when no row exists yet. */
export async function getOgcodeQuestionProgress(
  userId: string,
  questionId: string,
): Promise<OgcodeQuestionProgress> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return emptyProgress(userId, questionId);
  }

  await ensureProgressSchema();
  const result = await pool.query<ProgressRow>(
    `SELECT user_id, question_id, total_attempts, attempted, hint_revealed,
            answer_revealed, best_score, first_terminal_at
       FROM ogcode_question_progress
      WHERE user_id = $1 AND question_id = $2`,
    [userId, questionId],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : emptyProgress(userId, questionId);
}

/** Batch read for list badges: progress rows for many questions at once. */
export async function getOgcodeQuestionProgressMap(
  userId: string,
  questionIds: string[],
): Promise<Map<string, OgcodeQuestionProgress>> {
  const ids = [...new Set(questionIds.filter(Boolean))];
  const pool = getOgcodePostgresPool();
  if (!pool || !ids.length) {
    return new Map();
  }

  await ensureProgressSchema();
  const result = await pool.query<ProgressRow>(
    `SELECT user_id, question_id, total_attempts, attempted, hint_revealed,
            answer_revealed, best_score, first_terminal_at
       FROM ogcode_question_progress
      WHERE user_id = $1 AND question_id = ANY($2::text[])`,
    [userId, ids],
  );
  return new Map(result.rows.map((row) => [row.question_id, mapRow(row)]));
}

/**
 * Atomically increment TA and return the post-increment state. Callers must
 * check the RETURNED totalAttempts against the cap — never read-then-increment
 * across two queries (concurrent tabs would both pass a stale check).
 */
export async function incrementOgcodeAttempt(
  userId: string,
  questionId: string,
): Promise<OgcodeQuestionProgress> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    // No persistence configured (store-only dev): behave as first attempt.
    return { ...emptyProgress(userId, questionId), totalAttempts: 1 };
  }

  await ensureProgressSchema();
  const result = await pool.query<ProgressRow>(
    `INSERT INTO ogcode_question_progress (user_id, question_id, total_attempts)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, question_id) DO UPDATE SET
       total_attempts = ogcode_question_progress.total_attempts + 1,
       updated_at = NOW()
     RETURNING user_id, question_id, total_attempts, attempted, hint_revealed,
               answer_revealed, best_score, first_terminal_at`,
    [userId, questionId],
  );
  return mapRow(result.rows[0]);
}

/**
 * The ONE reveal implementation (three triggers: manual hint, manual answer,
 * cap exhaustion — all call this). First reveal flips attempted = TRUE and the
 * matching flag; repeats are idempotent set-once no-ops, so re-opening a hint
 * can never re-halve bs. Returns the post-call state plus whether this call
 * performed the first reveal (i.e. whether the decay applies).
 */
export async function markOgcodeRevealed(
  userId: string,
  questionId: string,
  kind: "hint" | "answer",
): Promise<{ progress: OgcodeQuestionProgress; firstReveal: boolean }> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    const progress = {
      ...emptyProgress(userId, questionId),
      attempted: true,
      hintRevealed: kind === "hint",
      answerRevealed: kind === "answer",
    };
    return { progress, firstReveal: true };
  }

  await ensureProgressSchema();
  const flagColumn = kind === "hint" ? "hint_revealed" : "answer_revealed";
  // The `before` CTE reads the pre-statement snapshot, so was_attempted is the
  // state at reveal time — NULL (no row yet) or FALSE both mean the decay
  // applies; TRUE means this question was already attempted/revealed.
  const result = await pool.query<ProgressRow & { was_attempted: boolean | null }>(
    `WITH before AS (
       SELECT attempted FROM ogcode_question_progress
        WHERE user_id = $1 AND question_id = $2
     )
     INSERT INTO ogcode_question_progress (user_id, question_id, attempted, ${flagColumn})
     VALUES ($1, $2, TRUE, TRUE)
     ON CONFLICT (user_id, question_id) DO UPDATE SET
       attempted = TRUE,
       ${flagColumn} = TRUE,
       updated_at = NOW()
     RETURNING user_id, question_id, total_attempts, attempted, hint_revealed,
               answer_revealed, best_score, first_terminal_at,
               (SELECT attempted FROM before) AS was_attempted`,
    [userId, questionId],
  );
  const progress = mapRow(result.rows[0]);
  return { progress, firstReveal: !result.rows[0].was_attempted };
}

/**
 * Terminal outcome for a question session (final correct, cap exhausted, or a
 * single-attempt type's only submission): flips attempted, records best_score,
 * stamps first_terminal_at once. Idempotent for replays.
 */
export async function recordOgcodeTerminal(
  userId: string,
  questionId: string,
  score: number | null,
): Promise<OgcodeQuestionProgress> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return { ...emptyProgress(userId, questionId), attempted: true, bestScore: score };
  }

  await ensureProgressSchema();
  const result = await pool.query<ProgressRow>(
    `INSERT INTO ogcode_question_progress (user_id, question_id, attempted, best_score, first_terminal_at)
     VALUES ($1, $2, TRUE, $3, NOW())
     ON CONFLICT (user_id, question_id) DO UPDATE SET
       attempted = TRUE,
       best_score = GREATEST(COALESCE(ogcode_question_progress.best_score, $3), COALESCE($3, ogcode_question_progress.best_score)),
       first_terminal_at = COALESCE(ogcode_question_progress.first_terminal_at, NOW()),
       updated_at = NOW()
     RETURNING user_id, question_id, total_attempts, attempted, hint_revealed,
               answer_revealed, best_score, first_terminal_at`,
    [userId, questionId, score],
  );
  return mapRow(result.rows[0]);
}
