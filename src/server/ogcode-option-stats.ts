/**
 * OGCode per-option answer distribution (V1/OGCODE_SCORING_ALGORITHM.md, Part 2 §9 add-on).
 *
 * Records, per question, how many students picked each option so the result
 * view can show "N% of people chose this" beside every choice. Counts are
 * keyed by the CANONICAL option index (question.options order), never the
 * per-user shuffled display order — the submit flow remaps the selected
 * option(s) to canonical before recording, and the read side maps counts back
 * to the viewer's displayed order.
 *
 * Public aggregate (no per-user rows). Sole owner of ogcode_question_option_choices.
 * Not flag-gated — like/report/challenge, this ships on for catalog questions.
 */

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";

declare global {
  var __originOgcodeOptionStatsSchemaReady: Promise<void> | undefined;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_question_option_choices (
    question_id  TEXT NOT NULL,
    option_index SMALLINT NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (question_id, option_index)
  );
`;

export type OgcodeOptionCounts = {
  /** count keyed by canonical option index. */
  counts: Map<number, number>;
  /** total recorded responses across all options. */
  total: number;
};

export function isOgcodeOptionStatsAvailable(): boolean {
  return isOgcodePostgresConfigured();
}

async function ensureOptionStatsSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) return;
  if (!globalThis.__originOgcodeOptionStatsSchemaReady) {
    globalThis.__originOgcodeOptionStatsSchemaReady = pool
      .query(CREATE_TABLE_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalThis.__originOgcodeOptionStatsSchemaReady = undefined;
        throw error;
      });
  }
  await globalThis.__originOgcodeOptionStatsSchemaReady;
}

/**
 * Bump the count for each canonical option index chosen. Call ONCE per
 * submission — every submit is counted, including mid-loop retries, so the
 * denominator is all submissions of the question (MCQ: one index; MSQ: the
 * selected set). No-op on empty input or when Postgres is unconfigured.
 */
export async function recordOgcodeOptionChoices(
  questionId: string,
  canonicalOptionIndices: number[],
): Promise<void> {
  const indices = [...new Set(canonicalOptionIndices.filter((i) => Number.isInteger(i) && i >= 0))];
  if (!questionId || indices.length === 0) return;
  const pool = getOgcodePostgresPool();
  if (!pool) return;
  await ensureOptionStatsSchema();
  await pool.query(
    `INSERT INTO ogcode_question_option_choices (question_id, option_index, count)
     SELECT $1, idx, 1 FROM unnest($2::int[]) AS idx
     ON CONFLICT (question_id, option_index)
     DO UPDATE SET count = ogcode_question_option_choices.count + 1`,
    [questionId, indices],
  );
}

/** Read the canonical-indexed counts + total for one question. */
export async function getOgcodeOptionCounts(questionId: string): Promise<OgcodeOptionCounts> {
  const empty: OgcodeOptionCounts = { counts: new Map(), total: 0 };
  const pool = getOgcodePostgresPool();
  if (!pool || !questionId) return empty;
  await ensureOptionStatsSchema();
  const result = await pool.query<{ option_index: number; count: number | string }>(
    `SELECT option_index, count FROM ogcode_question_option_choices WHERE question_id = $1`,
    [questionId],
  );
  const counts = new Map<number, number>();
  let total = 0;
  for (const row of result.rows) {
    const n = Number(row.count ?? 0);
    counts.set(Number(row.option_index), n);
    total += n;
  }
  return { counts, total };
}

/**
 * Build the per-option response percentages in the viewer's DISPLAYED order.
 * `displayOrder[displayedIndex] = canonicalIndex` (null ⇒ unshuffled, identity).
 * Returns null when there are no recorded responses yet.
 */
export function toDisplayedOptionDistribution(
  counts: OgcodeOptionCounts,
  optionCount: number,
  displayOrder: number[] | null,
): { percent: number; count: number; total: number }[] | null {
  if (counts.total <= 0 || optionCount <= 0) return null;
  const out: { percent: number; count: number; total: number }[] = [];
  for (let displayed = 0; displayed < optionCount; displayed += 1) {
    const canonical = displayOrder ? displayOrder[displayed] ?? displayed : displayed;
    const c = counts.counts.get(canonical) ?? 0;
    out.push({
      percent: Math.round((c / counts.total) * 100),
      count: c,
      total: counts.total,
    });
  }
  return out;
}
