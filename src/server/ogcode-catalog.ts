import { unstable_cache, revalidateTag } from "next/cache";
import type { DifficultyLevel, QuestionType, StoredAnswerSpec, StoredQuestion } from "@/server/store";

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";

declare global {
  var __originOgcodeCatalogSchemaReady: Promise<void> | undefined;
}

type CatalogFilters = {
  subject?: string | null;
  /** Premium entitlement allow-list (Phase 1.4): restrict to these subjects. */
  subjects?: string[] | null;
  difficulty?: string | null;
  type?: string | null;
  search?: string | null;
  chapters?: string[] | null;
};

type CatalogPageFilters = CatalogFilters & {
  includeIds?: string[] | null;
  excludeIds?: string[] | null;
  limit: number;
  offset: number;
};

type CatalogRow = {
  id: string;
  source_index: number;
  text: string;
  options: string[] | null;
  correct_option: number | null;
  correct_options: number[] | null;
  answer_text: string | null;
  answer_spec: StoredAnswerSpec | null;
  tolerance: number | null;
  matrix_data: { column_a: string[]; column_b: string[]; correct_pairs: number[][] } | null;
  explanation: string;
  hint: string | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: string;
  image: string | null;
  tags: string[] | string | null;
  question_type: string;
  acceptance_rate: number | string | null;
  total_correct: number | string | null;
  frequency: number | string | null;
  is_challenge_of_day: boolean;
  contributor_workspace_id: string | null;
  attribution_name: string | null;
  attribution_logo_url: string | null;
  is_contributed: boolean | null;
  occurrence: string | null;
  class: number | null;
  previous_year_question: string | null;
};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_questions (
    id TEXT PRIMARY KEY,
    source_index INTEGER NOT NULL UNIQUE,
    text TEXT NOT NULL,
    options JSONB,
    correct_option INTEGER,
    correct_options JSONB,
    answer_text TEXT,
    answer_spec JSONB,
    tolerance DOUBLE PRECISION,
    matrix_data JSONB,
    explanation TEXT NOT NULL,
    hint TEXT,
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    concept TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    image TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    question_type TEXT NOT NULL,
    acceptance_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    frequency INTEGER NOT NULL DEFAULT 0,
    is_challenge_of_day BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS ogcode_questions_subject_idx ON ogcode_questions (subject);
  CREATE INDEX IF NOT EXISTS ogcode_questions_difficulty_idx ON ogcode_questions (difficulty);
  CREATE INDEX IF NOT EXISTS ogcode_questions_question_type_idx ON ogcode_questions (question_type);
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS answer_spec JSONB;
  -- Institute hallmark (Admin Control Plane Phase 3): attribution for questions
  -- contributed by a coaching center and published via admin moderation.
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS contributor_workspace_id TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS attribution_name TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS attribution_logo_url TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS is_contributed BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE INDEX IF NOT EXISTS ogcode_questions_contributed_idx ON ogcode_questions (is_contributed);

  -- Exam provenance fields (added later; idempotent ALTER TABLE guards backcompat).
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS occurrence TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS class INTEGER;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS previous_year_question TEXT;

  -- Daily Mission (Phase 1): one persisted challenge question per calendar day.
  -- Recording the per-day pick makes the challenge stable for the whole day
  -- (immune to catalog edits) and lets the selector enforce a no-repeat window
  -- so the same question can't surface two days running.
  CREATE TABLE IF NOT EXISTS ogcode_daily_challenges (
    challenge_date DATE PRIMARY KEY,
    question_id TEXT NOT NULL,
    was_curated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS ogcode_daily_challenges_question_idx ON ogcode_daily_challenges (question_id);
`;

/** Columns selected into `CatalogRow` — shared by the by-id + daily-challenge reads. */
const CATALOG_COLUMNS = `
  id, source_index, text, options, correct_option, correct_options, answer_text,
  answer_spec, tolerance, matrix_data, explanation, hint, subject, chapter, concept,
  difficulty, image, tags, question_type, acceptance_rate, total_correct, frequency,
  is_challenge_of_day, contributor_workspace_id, attribution_name, attribution_logo_url,
  is_contributed, occurrence, class, previous_year_question
`;

/**
 * No-repeat window for the Daily Mission. A question used as the daily challenge
 * within this many days is excluded from re-selection, so the challenge rotates
 * even when only a handful of questions are curated. If the eligible pool is
 * smaller than the window the exclusion relaxes automatically (see
 * `pickDailyChallengeId`).
 */
export const DAILY_CHALLENGE_NO_REPEAT_DAYS = 60;

export type DailyChallengeCandidate = {
  id: string;
  sourceIndex: number;
  isCurated: boolean;
};

/**
 * Pure, deterministic per-day selection of the daily-challenge question.
 *
 * Rules (see PLATFORM_GAP_AUDIT_AND_COMPLETION_PLAN.md, Phase 1):
 *  - rotate over the FULL eligible pool, not just curated rows;
 *  - skip questions used within the no-repeat window (unless that empties the
 *    pool, in which case repeats are allowed again);
 *  - prefer curated (`is_challenge_of_day`) rows when any remain eligible, so
 *    hand-picked questions surface first without ever collapsing the pool to one;
 *  - pick a stable-per-day row via `epochDay % count` over a deterministic order.
 */
export function pickDailyChallengeId(
  eligible: readonly DailyChallengeCandidate[],
  usedIds: ReadonlySet<string>,
  epochDay: number,
): string | null {
  if (eligible.length === 0) {
    return null;
  }
  let candidates = eligible.filter((question) => !usedIds.has(question.id));
  if (candidates.length === 0) {
    candidates = [...eligible];
  }
  const curated = candidates.filter((question) => question.isCurated);
  const chosen = curated.length > 0 ? curated : candidates;
  const sorted = [...chosen].sort((left, right) =>
    left.sourceIndex !== right.sourceIndex
      ? left.sourceIndex - right.sourceIndex
      : left.id < right.id
        ? -1
        : left.id > right.id
          ? 1
          : 0,
  );
  const offset = ((epochDay % sorted.length) + sorted.length) % sorted.length;
  return sorted[offset].id;
}

function normalizeDifficulty(value: string): DifficultyLevel {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard" || normalized === "insane") {
    return normalized as DifficultyLevel;
  }
  return "medium";
}

function normalizeQuestionType(value: string): QuestionType {
  if (
    value === "mcq" ||
    value === "msq" ||
    value === "numerical" ||
    value === "matrix_match" ||
    value === "subjective"
  ) {
    return value;
  }
  return "subjective";
}

function normalizeSubject(value: string | null | undefined): string {
  const subject = String(value ?? "physics").trim().toLowerCase();
  if (subject === "maths") {
    return "mathematics";
  }
  return subject || "physics";
}

function toTextArray(value: unknown): string[] | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return null;
}

function toNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const numbers = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
  return numbers.length ? numbers : null;
}

function normalizeOptionText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-d]\s*[).:-]\s*/i, "")
    .replace(/\s+/g, " ");
}

/**
 * Reconciles correct_option against answer_text + options at read time so rows
 * imported by older importer versions (which mis-treated numeric answers as
 * 1-based indices) return the right option without a DB re-import.
 */
function reconcileCorrectOption(
  questionType: string,
  options: string[] | null,
  rawCorrectOption: number | null,
  answerText: string | null,
): number | null {
  if (!options || options.length === 0) {
    return rawCorrectOption;
  }
  if (questionType !== "mcq") {
    return rawCorrectOption;
  }

  const normalizedAnswer = normalizeOptionText(answerText);
  if (!normalizedAnswer) {
    return rawCorrectOption;
  }

  const textMatchIndex = options.findIndex((option) => normalizeOptionText(option) === normalizedAnswer);
  if (textMatchIndex < 0) {
    return rawCorrectOption;
  }

  // Prefer the unambiguous text match over a stored index that disagrees.
  return textMatchIndex;
}

function mapCatalogRow(row: CatalogRow): StoredQuestion {
  const options = toTextArray(row.options);
  const rawCorrectOption = row.correct_option == null ? null : Number(row.correct_option);
  const questionType = normalizeQuestionType(String(row.question_type));
  const reconciledCorrectOption = reconcileCorrectOption(
    questionType,
    options,
    rawCorrectOption,
    row.answer_text ?? null,
  );
  return {
    id: row.id,
    text: row.text,
    options,
    correctOption: reconciledCorrectOption,
    correctOptions: toNumberArray(row.correct_options),
    answerText: row.answer_text ?? null,
    answerSpec: row.answer_spec ?? null,
    tolerance: row.tolerance == null ? null : Number(row.tolerance),
    matrixData: row.matrix_data ?? null,
    explanation: row.explanation,
    hint: row.hint ?? null,
    subject: normalizeSubject(row.subject),
    chapter: row.chapter,
    concept: row.concept,
    difficulty: normalizeDifficulty(String(row.difficulty)),
    image: row.image ?? null,
    tags: Array.isArray(row.tags) ? row.tags.map((entry) => String(entry)) : row.tags ?? null,
    questionType,
    acceptanceRate: Number(row.acceptance_rate ?? 0),
    totalCorrect: Number(row.total_correct ?? 0),
    frequency: Number(row.frequency ?? 0),
    isChallengeOfTheDay: Boolean(row.is_challenge_of_day),
    contributorWorkspaceId: row.contributor_workspace_id ?? null,
    attributionName: row.attribution_name ?? null,
    attributionLogoUrl: row.attribution_logo_url ?? null,
    isContributed: Boolean(row.is_contributed),
    occurrence: row.occurrence ?? null,
    classLevel: row.class == null ? null : Number(row.class),
    previousYearQuestion: row.previous_year_question ?? null,
  };
}

async function ensureCatalogSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return;
  }

  if (!globalThis.__originOgcodeCatalogSchemaReady) {
    globalThis.__originOgcodeCatalogSchemaReady = pool.query(CREATE_TABLE_SQL).then(() => undefined).catch((error) => {
      globalThis.__originOgcodeCatalogSchemaReady = undefined;
      throw error;
    });
  }

  await globalThis.__originOgcodeCatalogSchemaReady;
}

function buildFilterClause(filters: CatalogFilters) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.subject) {
    values.push(normalizeSubject(filters.subject));
    clauses.push(`subject = $${values.length}`);
  }

  const subjects = (filters.subjects ?? [])
    .map((entry) => normalizeSubject(String(entry ?? "")))
    .filter(Boolean);
  if (subjects.length) {
    values.push(subjects);
    clauses.push(`subject = ANY($${values.length}::text[])`);
  }

  if (filters.difficulty) {
    values.push(String(filters.difficulty).trim().toLowerCase());
    clauses.push(`difficulty = $${values.length}`);
  }

  if (filters.type) {
    values.push(String(filters.type).trim().toLowerCase());
    clauses.push(`question_type = $${values.length}`);
  }

  const chapters = (filters.chapters ?? [])
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
  if (chapters.length) {
    values.push(chapters);
    clauses.push(`chapter = ANY($${values.length}::text[])`);
  }

  const search = String(filters.search ?? "").trim();
  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    clauses.push(
      `(LOWER(text) LIKE $${values.length} OR LOWER(chapter) LIKE $${values.length} OR LOWER(concept) LIKE $${values.length} OR LOWER(COALESCE(tags::text, '')) LIKE $${values.length})`,
    );
  }

  return {
    clauses,
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

export function isOgcodeCatalogAvailable(): boolean {
  return isOgcodePostgresConfigured();
}

async function _listOgcodeCatalogQuestions(filters: CatalogFilters = {}): Promise<StoredQuestion[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return [];
  }

  await ensureCatalogSchema();
  const { sql, values } = buildFilterClause(filters);
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day,
        contributor_workspace_id,
        attribution_name,
        attribution_logo_url,
        is_contributed,
        occurrence,
        class,
        previous_year_question
      FROM ogcode_questions
      ${sql}
      ORDER BY source_index ASC
    `,
    values,
  );

  return result.rows.map(mapCatalogRow);
}

// Cache the full catalog for 5 minutes — this is a large read-heavy query and
// the question bank changes infrequently. Revalidate via the "ogcode-catalog" tag
// when questions are added/updated.
export const listOgcodeCatalogQuestions = unstable_cache(
  _listOgcodeCatalogQuestions,
  ["ogcode-catalog-questions"],
  { revalidate: 300, tags: ["ogcode-catalog"] },
);

export async function listOgcodeCatalogQuestionIds(filters: CatalogFilters = {}): Promise<string[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return [];
  }

  await ensureCatalogSchema();
  const { sql, values } = buildFilterClause(filters);
  const result = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM ogcode_questions
      ${sql}
      ORDER BY source_index ASC
    `,
    values,
  );

  return result.rows.map((row) => row.id);
}

export async function listOgcodeCatalogQuestionPage(filters: CatalogPageFilters): Promise<{
  items: StoredQuestion[];
  total: number;
}> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return { items: [], total: 0 };
  }

  await ensureCatalogSchema();
  const base = buildFilterClause(filters);
  const clauses = [...base.clauses];
  const values = [...base.values];
  const includeIds = [...new Set((filters.includeIds ?? []).filter(Boolean))];
  const excludeIds = [...new Set((filters.excludeIds ?? []).filter(Boolean))];

  if (includeIds.length) {
    values.push(includeIds);
    clauses.push(`id = ANY($${values.length}::text[])`);
  }

  if (excludeIds.length) {
    values.push(excludeIds);
    clauses.push(`NOT (id = ANY($${values.length}::text[]))`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  values.push(Math.max(1, Math.trunc(filters.limit)), Math.max(0, Math.trunc(filters.offset)));

  const result = await pool.query<(CatalogRow & { total_count: number | string })>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day,
        contributor_workspace_id,
        attribution_name,
        attribution_logo_url,
        is_contributed,
        occurrence,
        class,
        previous_year_question,
        COUNT(*) OVER() AS total_count
      FROM ogcode_questions
      ${where}
      ORDER BY source_index ASC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values,
  );

  return {
    items: result.rows.map(mapCatalogRow),
    total: Number(result.rows[0]?.total_count ?? 0),
  };
}

export async function listOgcodeCatalogChapters(subject: string): Promise<string[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return [];
  }

  await ensureCatalogSchema();
  const result = await pool.query<{ chapter: string }>(
    `
      SELECT DISTINCT chapter
      FROM ogcode_questions
      WHERE subject = $1
      ORDER BY chapter ASC
    `,
    [normalizeSubject(subject)],
  );

  return result.rows
    .map((row) => row.chapter.trim())
    .filter(Boolean);
}

export async function getOgcodeCatalogQuestionById(questionId: string): Promise<StoredQuestion | null> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return null;
  }

  await ensureCatalogSchema();
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day,
        contributor_workspace_id,
        attribution_name,
        attribution_logo_url,
        is_contributed
      FROM ogcode_questions
      WHERE id = $1
      LIMIT 1
    `,
    [questionId],
  );

  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null;
}

export async function getOgcodeCatalogQuestionMap(questionIds: string[]): Promise<Map<string, StoredQuestion>> {
  const pool = getOgcodePostgresPool();
  if (!pool || !questionIds.length) {
    return new Map();
  }

  await ensureCatalogSchema();
  const uniqueIds = [...new Set(questionIds)];
  const result = await pool.query<CatalogRow>(
    `
      SELECT
        id,
        source_index,
        text,
        options,
        correct_option,
        correct_options,
        answer_text,
        answer_spec,
        tolerance,
        matrix_data,
        explanation,
        hint,
        subject,
        chapter,
        concept,
        difficulty,
        image,
        tags,
        question_type,
        acceptance_rate,
        total_correct,
        frequency,
        is_challenge_of_day,
        contributor_workspace_id,
        attribution_name,
        attribution_logo_url,
        is_contributed
      FROM ogcode_questions
      WHERE id = ANY($1::text[])
    `,
    [uniqueIds],
  );

  return new Map<string, StoredQuestion>(
    result.rows.map((row: CatalogRow) => [row.id, mapCatalogRow(row)]),
  );
}

export async function getOgcodeCatalogCounts() {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return { total: 0, bySubject: {} as Record<string, number> };
  }

  await ensureCatalogSchema();
  const result = await pool.query<{ subject: string; total: number | string }>(
    `
      SELECT subject, COUNT(*)::int AS total
      FROM ogcode_questions
      GROUP BY subject
    `,
  );

  const bySubject: Record<string, number> = {};
  let total = 0;
  result.rows.forEach((row: { subject: string; total: number | string }) => {
    const count = Number(row.total ?? 0);
    bySubject[normalizeSubject(row.subject)] = count;
    total += count;
  });

  return { total, bySubject };
}

async function fetchCatalogQuestionById(
  pool: NonNullable<ReturnType<typeof getOgcodePostgresPool>>,
  id: string,
): Promise<StoredQuestion | null> {
  const result = await pool.query<CatalogRow>(
    `SELECT ${CATALOG_COLUMNS} FROM ogcode_questions WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null;
}

/**
 * Resolve the Daily Mission question for a given day (defaults to today, UTC).
 *
 * The pick is recorded in `ogcode_daily_challenges`, so:
 *  - the challenge is stable for the whole day even if the catalog is edited;
 *  - the no-repeat window can be computed from prior days;
 *  - concurrent first-hits of a fresh day converge on one row via
 *    `ON CONFLICT DO NOTHING` + read-back.
 *
 * Rotation now walks the full eligible pool (curated preferred) instead of the
 * old `epochDay % curatedCount`, which surfaced the same question forever
 * whenever a single row was flagged `is_challenge_of_day`.
 */
export async function getOgcodeChallengeQuestion(dateKey?: string): Promise<StoredQuestion | null> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return null;
  }

  await ensureCatalogSchema();

  const today = dateKey ?? new Date().toISOString().slice(0, 10);

  // 1. Already scheduled for today → return it verbatim (stable for the day).
  const existing = await pool.query<{ question_id: string }>(
    `SELECT question_id FROM ogcode_daily_challenges WHERE challenge_date = $1`,
    [today],
  );
  if (existing.rows[0]?.question_id) {
    const scheduled = await fetchCatalogQuestionById(pool, existing.rows[0].question_id);
    if (scheduled) {
      return scheduled;
    }
    // The recorded question was deleted from the catalog — fall through and re-pick.
  }

  // 2. Build the eligible pool (curated OR answerable MCQ) + the no-repeat window.
  const eligibleResult = await pool.query<{ id: string; source_index: number | string; is_challenge_of_day: boolean }>(
    `SELECT id, source_index, is_challenge_of_day
       FROM ogcode_questions
      WHERE is_challenge_of_day = true
         OR (question_type = 'mcq' AND correct_option IS NOT NULL)`,
  );
  const eligible: DailyChallengeCandidate[] = eligibleResult.rows.map((row) => ({
    id: row.id,
    sourceIndex: Number(row.source_index),
    isCurated: Boolean(row.is_challenge_of_day),
  }));
  if (eligible.length === 0) {
    return null;
  }

  const usedResult = await pool.query<{ question_id: string }>(
    `SELECT question_id FROM ogcode_daily_challenges WHERE challenge_date > ($1::date - $2::int)`,
    [today, DAILY_CHALLENGE_NO_REPEAT_DAYS],
  );
  const usedIds = new Set(usedResult.rows.map((row) => row.question_id));

  const epochDay = Math.floor(new Date(`${today}T00:00:00Z`).getTime() / 86_400_000);
  const chosenId = pickDailyChallengeId(eligible, usedIds, epochDay);
  if (!chosenId) {
    return null;
  }
  const wasCurated = eligible.find((question) => question.id === chosenId)?.isCurated ?? false;

  // 3. Persist the pick (idempotent under concurrency), then read back the winner.
  await pool.query(
    `INSERT INTO ogcode_daily_challenges (challenge_date, question_id, was_curated)
     VALUES ($1, $2, $3)
     ON CONFLICT (challenge_date) DO NOTHING`,
    [today, chosenId, wasCurated],
  );
  const authoritative = await pool.query<{ question_id: string }>(
    `SELECT question_id FROM ogcode_daily_challenges WHERE challenge_date = $1`,
    [today],
  );
  const finalId = authoritative.rows[0]?.question_id ?? chosenId;
  return fetchCatalogQuestionById(pool, finalId);
}

export async function incrementOgcodeCatalogQuestionStats(questionId: string, isCorrect: boolean): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return;
  }

  await ensureCatalogSchema();
  await pool.query(
    `
      UPDATE ogcode_questions
      SET
        frequency = frequency + 1,
        total_correct = total_correct + CASE WHEN $2 THEN 1 ELSE 0 END,
        acceptance_rate = CASE
          WHEN frequency + 1 > 0 THEN
            ((total_correct + CASE WHEN $2 THEN 1 ELSE 0 END)::double precision / (frequency + 1)::double precision) * 100
          ELSE 0
        END
      WHERE id = $1
    `,
    [questionId, isCorrect],
  );
}

export type ContributedCatalogInput = {
  /** Catalog row id = source content.questions id (so re-publish updates in place). */
  id: string;
  text: string;
  options: string[] | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  answerText: string | null;
  answerSpec: unknown | null;
  tolerance: number | null;
  matrixData: unknown | null;
  explanation: string;
  hint: string | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: string;
  questionType: string;
  tags: string[];
  contributorWorkspaceId: string | null;
  attributionName: string | null;
  attributionLogoUrl: string | null;
  occurrence?: string | null;
  classLevel?: number | null;
  previousYearQuestion?: string | null;
};

/**
 * Inserts (or refreshes) an admin-approved, teacher-contributed question into the
 * student OG-Code catalog with institute attribution (the "hallmark"). Called from
 * the publish step. `source_index` is MAX+1 on first insert and preserved on
 * conflict. No-op when the OGCODE pool is not configured. Revalidates the catalog
 * cache so the question appears promptly in the student pool.
 */
export async function upsertContributedCatalogQuestion(input: ContributedCatalogInput): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) return;

  await ensureCatalogSchema();
  await pool.query(
    `
      INSERT INTO ogcode_questions (
        id, source_index, text, options, correct_option, correct_options,
        answer_text, answer_spec, tolerance, matrix_data, explanation, hint,
        subject, chapter, concept, difficulty, tags, question_type,
        contributor_workspace_id, attribution_name, attribution_logo_url, is_contributed
      ) VALUES (
        $1,
        (SELECT COALESCE(MAX(source_index), 0) + 1 FROM ogcode_questions),
        $2, $3::jsonb, $4, $5::jsonb, $6, $7::jsonb, $8, $9::jsonb, $10, $11,
        $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, TRUE
      )
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        options = EXCLUDED.options,
        correct_option = EXCLUDED.correct_option,
        correct_options = EXCLUDED.correct_options,
        answer_text = EXCLUDED.answer_text,
        answer_spec = EXCLUDED.answer_spec,
        tolerance = EXCLUDED.tolerance,
        matrix_data = EXCLUDED.matrix_data,
        explanation = EXCLUDED.explanation,
        hint = EXCLUDED.hint,
        subject = EXCLUDED.subject,
        chapter = EXCLUDED.chapter,
        concept = EXCLUDED.concept,
        difficulty = EXCLUDED.difficulty,
        tags = EXCLUDED.tags,
        question_type = EXCLUDED.question_type,
        contributor_workspace_id = EXCLUDED.contributor_workspace_id,
        attribution_name = EXCLUDED.attribution_name,
        attribution_logo_url = EXCLUDED.attribution_logo_url,
        is_contributed = TRUE,
        updated_at = NOW()
    `,
    [
      input.id,
      input.text,
      JSON.stringify(input.options ?? null),
      input.correctOption,
      JSON.stringify(input.correctOptions ?? null),
      input.answerText,
      input.answerSpec ? JSON.stringify(input.answerSpec) : null,
      input.tolerance,
      input.matrixData ? JSON.stringify(input.matrixData) : null,
      input.explanation,
      input.hint,
      normalizeSubject(input.subject),
      input.chapter,
      input.concept,
      String(input.difficulty || "medium").toLowerCase(),
      JSON.stringify(input.tags ?? []),
      input.questionType,
      input.contributorWorkspaceId,
      input.attributionName,
      input.attributionLogoUrl,
    ],
  );
  // Bust the catalog cache so the question appears promptly. Never let a
  // revalidation failure fail the write itself: revalidateTag throws
  // "static generation store missing" when called outside a request context
  // (e.g. the one-time backfill script), and the row is already committed above.
  try {
    revalidateTag("ogcode-catalog", "max");
  } catch (error) {
    console.warn("[upsertContributedCatalogQuestion] revalidateTag skipped:", error instanceof Error ? error.message : error);
  }
}
