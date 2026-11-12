import "server-only";

/**
 * Rank Predictor service (plan §4.6, §7): runs the pure engine on the static
 * tables and reads the caller's own past attempts for "Fill from my tests".
 *
 * Privacy (plan §12.1): category, PwD, gender and home state are used for the
 * calculation only. Nothing here stores or logs them, or the marks.
 */

import {
  averageOfLastMocks,
  attemptFitsExam,
  fillFromAttempt,
  summariseAttempt,
  type AttemptFill,
  type AttemptSummary,
  type StoredAttemptRow,
} from "@/lib/rank-predictor/attempt-mapping";
import { DISCLAIMER, roundPercentileRange, roundRankRange } from "@/lib/rank-predictor/format";
import { jeeMainShiftIds, predict } from "@/lib/rank-predictor/predict";
import type { DataSource, PercentileBand, PredictInput, Prediction, RankBand, RankPredictorExam } from "@/lib/rank-predictor/types";
import { addMarks, WHAT_IF_DELTAS, type WhatIfBand } from "@/lib/rank-predictor/what-if";
import { ensureAnalyticsTables } from "@/legacy/analytics-store";
import { getOgcodePostgresPool } from "@/server/postgres";

import { RANK_PREDICTOR_DATA } from "./data";

export type PublicSource = { publisher: string; url: string; official: boolean; fetchedOn: string };

export type PredictionResponse = {
  prediction: Prediction;
  sources: PublicSource[];
  checkedOn: string;
  disclaimer: string;
};

let shiftIdSet: Set<string> | null = null;

/** JEE Main shift ids with real tables (for request validation). */
export function rankPredictorShiftIds(): ReadonlySet<string> {
  shiftIdSet ??= new Set(jeeMainShiftIds(RANK_PREDICTOR_DATA["jee-main"]));
  return shiftIdSet;
}

function roundBand(band: RankBand | null): RankBand | null {
  return band ? { ...band, ...roundRankRange(band) } : null;
}

/**
 * Only nice-rounded ranges leave the server (plan §8.5: no raw anchors), plus
 * the sources the numbers came from, credited on every result (§12.2).
 */
export function runPrediction(input: PredictInput): PredictionResponse {
  const raw = predict(RANK_PREDICTOR_DATA, input);
  const file = RANK_PREDICTOR_DATA[input.exam];
  const byId = new Map<string, DataSource>(file.sources.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const sources: PublicSource[] = [];
  for (const id of raw.sourceIds) {
    const s = byId.get(id);
    if (!s) continue;
    // One credit per publisher (its first source's link), so the line stays short.
    const key = s.publisher;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ publisher: s.publisher, url: s.url, official: s.official, fetchedOn: s.fetchedOn });
  }
  const prediction: Prediction = {
    ...raw,
    air: roundBand(raw.air),
    categoryRank: roundBand(raw.categoryRank),
    pwdRank: roundBand(raw.pwdRank),
    stateRank: roundBand(raw.stateRank),
    percentile: raw.percentile ? { ...raw.percentile, ...roundPercentileRange(raw.percentile) } : null,
  };
  return { prediction, sources, checkedOn: file.checkedOn, disclaimer: DISCLAIMER };
}

/** The "+10 / +20 marks" chips, answered in the same response (no extra request). */
export function whatIfBands(input: PredictInput): WhatIfBand[] {
  return WHAT_IF_DELTAS.map((delta) => {
    const { marks, added } = addMarks(input.exam, input.marks, delta);
    const air = added > 0 ? runPrediction({ ...input, marks }).prediction.air : null;
    return { delta, added, air };
  });
}

// ─── Fill from my tests ──────────────────────────────────────────────────────

const ATTEMPT_LIMIT = 60;

type Queryable = { query: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

function pool(): Queryable {
  const p = getOgcodePostgresPool();
  if (!p) throw new Error("OGCODE_DATABASE_URL is not configured.");
  return p as unknown as Queryable;
}

const ATTEMPT_COLUMNS = `r.id, r.title, r.created_at, r.score, r.total_marks, r.subject_stats, r.assignment_id, c.exam_preset`;

function toRow(row: Record<string, unknown>): StoredAttemptRow {
  const created = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? "");
  return {
    id: String(row.id),
    title: String(row.title ?? "Test"),
    createdAt: created,
    score: Number(row.score ?? 0),
    totalMarks: Number(row.total_marks ?? 0),
    subjectStats: row.subject_stats ?? {},
    examPreset: row.exam_preset ? String(row.exam_preset) : null,
    assignmentId: row.assignment_id ? String(row.assignment_id) : null,
  };
}

/**
 * The caller's own attempts that can fill `exam`, newest first, malpractice
 * attempts left out (T3.7). Other exams' full mocks are dropped in SQL, before
 * the LIMIT, so they never crowd out this exam's tests.
 */
async function loadAttempts(userId: string, exam: RankPredictorExam, mocksOnly: boolean): Promise<AttemptSummary[]> {
  await ensureAnalyticsTables();
  const presetFilter = mocksOnly ? "c.exam_preset = $2" : "(c.exam_preset IS NULL OR c.exam_preset = $2)";
  const result = await pool().query(
    `SELECT ${ATTEMPT_COLUMNS}
       FROM analytics.test_results r
       LEFT JOIN analytics.custom_tests c ON c.id = r.test_id
      WHERE r.user_id = $1 AND r.is_malpractice = FALSE AND ${presetFilter}
      ORDER BY r.created_at DESC
      LIMIT ${mocksOnly ? 3 : ATTEMPT_LIMIT}`,
    [userId, exam],
  );
  return result.rows.map((row) => summariseAttempt(toRow(row))).filter((a) => attemptFitsExam(a, exam));
}

export async function listRankPredictorAttempts(userId: string, exam: RankPredictorExam): Promise<AttemptSummary[]> {
  return loadAttempts(userId, exam, false);
}

export type AttemptFillResponse = AttemptFill & {
  /**
   * Full-length mock of this exam only: a one-line AIR range for the result page (plan §9.3),
   * with the percentile for NEET and JEE Main (JEE Advanced has none → null).
   */
  preview: { air: RankBand | null; percentile: PercentileBand | null; topText: string | null } | null;
};

function previewFor(fill: AttemptFill): AttemptFillResponse["preview"] {
  if (fill.kind !== "full_mock") return null;
  const marks = Object.fromEntries(Object.entries(fill.marks).map(([id, box]) => [id, box.value]));
  const { prediction } = runPrediction({
    exam: fill.exam,
    marks,
    category: "general",
    pwd: false,
    source: { kind: "attempt" },
  });
  return { air: prediction.air, percentile: prediction.percentile, topText: prediction.topText };
}

/**
 * One attempt mapped to the boxes. Ownership is part of the query: another
 * user's id, a malpractice attempt or an unknown id all come back null, so the
 * route answers 404 without saying whether it exists (T3.8).
 */
export async function getRankPredictorAttemptFill(
  userId: string,
  resultId: string,
  exam: RankPredictorExam | null,
): Promise<AttemptFillResponse | null> {
  await ensureAnalyticsTables();
  const result = await pool().query(
    `SELECT ${ATTEMPT_COLUMNS}
       FROM analytics.test_results r
       LEFT JOIN analytics.custom_tests c ON c.id = r.test_id
      WHERE r.id = $1 AND r.user_id = $2 AND r.is_malpractice = FALSE
      LIMIT 1`,
    [resultId, userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const summary = summariseAttempt(toRow(row));
  const target = exam ?? summary.examPreset;
  if (!target || !attemptFitsExam(summary, target)) return null;
  const fill = fillFromAttempt(summary, target);
  return { ...fill, preview: previewFor(fill) };
}

export async function getRankPredictorAverageFill(userId: string, exam: RankPredictorExam): Promise<AttemptFill | null> {
  return averageOfLastMocks(await loadAttempts(userId, exam, true), exam);
}
