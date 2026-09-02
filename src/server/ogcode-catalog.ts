import { unstable_cache, revalidateTag } from "next/cache";
import type { DifficultyLevel, QuestionType, StoredAnswerSpec, StoredQuestion } from "@/server/store";
import { toAbsoluteMediaUrl } from "@/lib/media-url";

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";
import { studyModeSubjects } from "@/lib/study-mode";

declare global {
  var __originOgcodeCatalogSchemaReady: Promise<void> | undefined;
}

type CatalogFilters = {
  subject?: string | null;
  /** Premium entitlement allow-list (Phase 1.4): restrict to these subjects. */
  subjects?: string[] | null;
  difficulty?: string | null;
  /**
   * Union-matched difficulty band (e.g. `["hard", "insane"]`). Independent of
   * the singular `difficulty` above — both may be supplied, and both apply.
   */
  difficulties?: string[] | null;
  type?: string | null;
  search?: string | null;
  chapters?: string[] | null;
  classes?: number[] | null;
  occurrences?: string[] | null;
  concepts?: string[] | null;
  pyqOnly?: boolean;
  /** Institute-hallmark filter — only questions contributed by a coaching centre. */
  contributedOnly?: boolean;
  /**
   * Contest document-import visibility. By DEFAULT contest-import questions are
   * excluded (hidden from general OGCode student surfaces).
   * - `includeContestImports`: include ALL contest imports (contest paper resolver
   *   + direct-attach picker).
   * - `contestPracticePool`: include contest imports that are practice-eligible
   *   (contest pre-contest practice + DPP-from-mistakes recommendation), so OGCode
   *   questions and practice-flagged imports are suggested together.
   * `includeContestImports` wins if both are set.
   */
  includeContestImports?: boolean;
  contestPracticePool?: boolean;
};

type CatalogPageFilters = CatalogFilters & {
  includeIds?: string[] | null;
  excludeIds?: string[] | null;
  /** §10 "Liked" filter axis — restrict to questions this user has liked. */
  likedByUserId?: string | null;
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
  option_images: (string | null)[] | null;
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
  -- Per-option images (JSONB array parallel to options) for contributed
  -- questions with an image on one or more options; question diagram is image.
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS option_images JSONB;
  -- Institute hallmark (Admin Control Plane Phase 3): attribution for questions
  -- contributed by a coaching center and published via admin moderation.
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS contributor_workspace_id TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS attribution_name TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS attribution_logo_url TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS is_contributed BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE INDEX IF NOT EXISTS ogcode_questions_contributed_idx ON ogcode_questions (is_contributed);
  -- Contest document-import flags. A contest-imported question is tagged so it can
  -- be hidden from general OGCode student surfaces (default-excluded in
  -- buildFilterClause) while remaining available to the contest paper/resolver and,
  -- when contest_practice_eligible, to the contest practice + DPP recommendation pools.
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS is_contest_import BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS contest_practice_eligible BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE INDEX IF NOT EXISTS ogcode_questions_contest_import_idx ON ogcode_questions (is_contest_import);

  -- Exam provenance fields (added later; idempotent ALTER TABLE guards backcompat).
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS occurrence TEXT;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS class INTEGER;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS previous_year_question TEXT;

  -- Engagement §9 (V1/OGCODE_SCORING_ALGORITHM.md, Part 2): avg time-to-correct
  -- + first-attempt counters, feeding the "faster than X%" / first-try messages.
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS correct_time_sum    DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS correct_time_count  INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS first_attempt_total INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE ogcode_questions ADD COLUMN IF NOT EXISTS first_attempt_correct INTEGER NOT NULL DEFAULT 0;

  -- §9 completion-time histogram — narrow table so each increment is an atomic
  -- upsert (no JSONB read-modify-write lost-update race). bucket = floor(tt/5),
  -- capped at 120 (600s+ overflow).
  CREATE TABLE IF NOT EXISTS ogcode_question_time_buckets (
    question_id  TEXT NOT NULL,
    bucket_index SMALLINT NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (question_id, bucket_index)
  );

`;

/** Columns selected into `CatalogRow` — shared by every full-question read. */
const CATALOG_COLUMNS = `
  id, source_index, text, options, correct_option, correct_options, answer_text,
  answer_spec, tolerance, matrix_data, explanation, hint, subject, chapter, concept,
  difficulty, image, option_images, tags, question_type, acceptance_rate, total_correct, frequency,
  is_challenge_of_day, contributor_workspace_id, attribution_name, attribution_logo_url,
  is_contributed, occurrence, class, previous_year_question
`;

function normalizeDifficulty(value: string): DifficultyLevel {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard" || normalized === "insane") {
    return normalized as DifficultyLevel;
  }
  return "medium";
}

function normalizeQuestionType(value: string): QuestionType {
  // Case-insensitive: live rows exist with e.g. "MSQ" (manual/imported inserts),
  // which previously fell through to the "subjective" fallback and rendered as
  // a text box instead of a multi-select. Mirrored by LOWER() in buildFilterClause.
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "mcq" ||
    normalized === "msq" ||
    normalized === "numerical" ||
    normalized === "matrix_match" ||
    normalized === "subjective" ||
    normalized === "range"
  ) {
    return normalized;
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

/**
 * ~1,800 catalog rows are numerical fill-in-the-blank questions mislabeled as
 * "mcq": no options, answer_text NULL, and the accepted numeric answer stored
 * in correct_options as strings (e.g. ["2500"]). Left as-is they render as
 * un-answerable empty MCQs and never match the Integer type filter. Reconcile
 * at read time (same pattern as reconcileCorrectOption above); the SQL type
 * filter in buildFilterClause mirrors this derivation so filtered pages and
 * rendered rows classify identically.
 */
function reconcileQuestionType(
  questionType: QuestionType,
  options: string[] | null,
  answerText: string | null,
  rawCorrectOptions: unknown,
): { questionType: QuestionType; answerText: string | null; dropCorrectOptions: boolean } {
  if (questionType !== "mcq" || (options && options.length > 0)) {
    return { questionType, answerText, dropCorrectOptions: false };
  }
  const normalizedAnswer = answerText && answerText.trim() ? answerText : null;
  const storedAnswers = (toTextArray(rawCorrectOptions) ?? [])
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (normalizedAnswer || storedAnswers.length) {
    return {
      questionType: "numerical",
      answerText: normalizedAnswer ?? storedAnswers[0],
      dropCorrectOptions: true,
    };
  }
  return { questionType: "subjective", answerText, dropCorrectOptions: false };
}

function mapCatalogRow(row: CatalogRow): StoredQuestion {
  const options = toTextArray(row.options);
  const rawCorrectOption = row.correct_option == null ? null : Number(row.correct_option);
  const reconciledType = reconcileQuestionType(
    normalizeQuestionType(String(row.question_type)),
    options,
    row.answer_text ?? null,
    row.correct_options,
  );
  const questionType = reconciledType.questionType;
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
    correctOptions: reconciledType.dropCorrectOptions ? null : toNumberArray(row.correct_options),
    answerText: reconciledType.answerText,
    answerSpec: row.answer_spec ?? null,
    tolerance: row.tolerance == null ? null : Number(row.tolerance),
    matrixData: row.matrix_data ?? null,
    explanation: row.explanation,
    hint: row.hint ?? null,
    subject: normalizeSubject(row.subject),
    chapter: row.chapter,
    concept: row.concept,
    difficulty: normalizeDifficulty(String(row.difficulty)),
    image: toAbsoluteMediaUrl(row.image ?? null),
    optionImages: Array.isArray(row.option_images) ? row.option_images.map((u) => toAbsoluteMediaUrl(u)) : null,
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

/** Escape LIKE/ILIKE wildcards in user-supplied filter values. */
function escapeLikePattern(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

/**
 * Collapse a raw occurrence value ("JEE (2020)", "JEE Main (NA)",
 * "NEET (2019)", "JEE / NEET") into its exam family for the filter chips.
 * Combined values belong to every family they mention. Unrecognized values
 * pass through with any trailing "(...)" annotation stripped.
 */
export function canonicalOccurrenceFamilies(value: string): string[] {
  const upper = value.toUpperCase();
  const families: string[] = [];
  if (upper.includes("JEE")) families.push("JEE");
  if (upper.includes("NEET")) families.push("NEET");
  if (upper.includes("AIPMT")) families.push("AIPMT");
  if (families.length) return families;
  const cleaned = value.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return cleaned && cleaned.toUpperCase() !== "NA" ? [cleaned] : [];
}

function buildFilterClause(filters: CatalogFilters) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.subject) {
    values.push(normalizeSubject(filters.subject));
    clauses.push(`LOWER(subject) = $${values.length}`);
  }

  const subjects = (filters.subjects ?? [])
    .map((entry) => normalizeSubject(String(entry ?? "")))
    .filter(Boolean);
  if (subjects.length) {
    values.push(subjects);
    clauses.push(`LOWER(subject) = ANY($${values.length}::text[])`);
  }

  if (filters.difficulty) {
    values.push(String(filters.difficulty).trim().toLowerCase());
    clauses.push(`LOWER(difficulty) = $${values.length}`);
  }

  const difficulties = (filters.difficulties ?? [])
    .map((entry) => String(entry ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (difficulties.length) {
    values.push(difficulties);
    clauses.push(`LOWER(difficulty) = ANY($${values.length}::text[])`);
  }

  if (filters.type) {
    const type = String(filters.type).trim().toLowerCase();
    // Mirrors reconcileQuestionType(): option-less "mcq" rows are really
    // numerical (or subjective when they carry no answer at all). The SQL
    // filter must classify them the same way mapCatalogRow will, or filtered
    // pages would return rows that morph to a different type after mapping.
    const optionless = `(options IS NULL OR jsonb_typeof(options) <> 'array' OR jsonb_array_length(options) = 0)`;
    const hasStoredAnswer = `(NULLIF(TRIM(answer_text), '') IS NOT NULL OR (correct_options IS NOT NULL AND jsonb_typeof(correct_options) = 'array' AND jsonb_array_length(correct_options) > 0))`;
    if (type === "mcq") {
      clauses.push(`(LOWER(question_type) = 'mcq' AND NOT ${optionless})`);
    } else if (type === "numerical") {
      clauses.push(`(LOWER(question_type) = 'numerical' OR (LOWER(question_type) = 'mcq' AND ${optionless} AND ${hasStoredAnswer}))`);
    } else if (type === "subjective") {
      clauses.push(`(LOWER(question_type) = 'subjective' OR (LOWER(question_type) = 'mcq' AND ${optionless} AND NOT ${hasStoredAnswer}))`);
    } else {
      values.push(type);
      clauses.push(`LOWER(question_type) = $${values.length}`);
    }
  }

  const chapters = (filters.chapters ?? [])
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
  if (chapters.length) {
    values.push(chapters);
    clauses.push(`chapter = ANY($${values.length}::text[])`);
  }

  const classes = (filters.classes ?? []).map(c => Number(c)).filter(c => !isNaN(c) && c > 0);
  if (classes.length) {
    values.push(classes);
    clauses.push(`class = ANY($${values.length}::integer[])`);
  }

  const occurrences = (filters.occurrences ?? []).map(o => String(o).trim()).filter(Boolean);
  if (occurrences.length) {
    // Containment, not equality: the bank stores year/variant-suffixed values
    // ("JEE (2020)", "JEE Main", "JEE Advanced (2022)", "NEET (2019)"), so an
    // exam-family selection like "JEE" must match all of them. Combined values
    // ("JEE / NEET") match either family for free.
    const likeClauses = occurrences.map((occ) => {
      values.push(`%${escapeLikePattern(occ)}%`);
      return `occurrence ILIKE $${values.length}`;
    });
    clauses.push(`(${likeClauses.join(" OR ")})`);
  }

  const concepts = (filters.concepts ?? []).map(c => String(c).trim()).filter(Boolean);
  if (concepts.length) {
    values.push(concepts);
    clauses.push(`concept = ANY($${values.length}::text[])`);
  }

  if (filters.pyqOnly) {
    clauses.push(`previous_year_question = 'YES'`);
  }

  if (filters.contributedOnly) {
    clauses.push(`is_contributed = TRUE`);
  }

  // Contest document-import visibility. Default: hide contest imports from
  // general OGCode surfaces. Contest paths opt in explicitly.
  if (filters.includeContestImports) {
    // Contest paper resolver / direct-attach: see every contest import (no clause).
  } else if (filters.contestPracticePool) {
    // Contest practice + DPP: OGCode questions AND practice-eligible imports.
    clauses.push(`(is_contest_import = FALSE OR contest_practice_eligible = TRUE)`);
  } else {
    clauses.push(`is_contest_import = FALSE`);
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
        option_images,
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

  // §10 Liked filter: EXISTS against the co-located likes table (indexed on
  // question_id, PK on user_id+question_id) — no need to materialize the set.
  if (filters.likedByUserId) {
    values.push(filters.likedByUserId);
    clauses.push(
      `EXISTS (SELECT 1 FROM ogcode_question_likes l WHERE l.question_id = ogcode_questions.id AND l.user_id = $${values.length})`,
    );
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
        option_images,
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

/**
 * A question as the full-length test builder sees it: enough to place it in a
 * section and report the paper's composition, without hauling the stem, options
 * and explanation across for questions that may not even be picked.
 */
export type CatalogSampleRow = {
  id: string;
  subject: string;
  chapter: string;
  difficulty: string;
  questionType: QuestionType;
};

/**
 * Randomised-but-reproducible sampling for full-length mock tests.
 *
 * Every other read in this module is `ORDER BY source_index ASC`, which is the
 * right call for browsing (stable paging) and exactly wrong for building a mock
 * paper: it would hand every student the same first N questions of each filter.
 * Ordering by `md5(seed || id)` instead spreads the draw across the whole
 * matching set while staying deterministic for a given seed, so a test can be
 * rebuilt identically for debugging and two students never get the same paper.
 *
 * Randomising in SQL (rather than fetching all ids and shuffling in Node) keeps
 * the transfer proportional to what is actually needed — a NEET Biology band can
 * match 1,700+ rows for a 16-question draw.
 *
 * See V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §5, D7.
 */
export async function sampleOgcodeCatalogQuestionIds(
  filters: CatalogFilters & {
    excludeIds?: string[] | null;
    seed: string;
    limit: number;
  },
): Promise<CatalogSampleRow[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return [];
  }
  const limit = Math.max(0, Math.trunc(filters.limit));
  if (limit === 0) {
    return [];
  }

  await ensureCatalogSchema();
  const base = buildFilterClause(filters);
  const clauses = [...base.clauses];
  const values = [...base.values];

  const excludeIds = [...new Set((filters.excludeIds ?? []).filter(Boolean))];
  if (excludeIds.length) {
    values.push(excludeIds);
    clauses.push(`NOT (id = ANY($${values.length}::text[]))`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  values.push(filters.seed);
  const seedParam = `$${values.length}`;
  values.push(limit);

  const result = await pool.query<{
    id: string;
    subject: string;
    chapter: string;
    difficulty: string;
    question_type: string;
    options: unknown;
    answer_text: string | null;
    correct_options: unknown;
  }>(
    `
      SELECT id, subject, chapter, difficulty, question_type, options, answer_text, correct_options
      FROM ogcode_questions
      ${where}
      ORDER BY md5(${seedParam} || id) ASC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows.map((row) => {
    // Classify exactly as mapCatalogRow would, so a row sampled as "mcq" can
    // never render as something else once the taker resolves it in full.
    const options = toTextArray(row.options);
    const reconciled = reconcileQuestionType(
      normalizeQuestionType(String(row.question_type)),
      options,
      row.answer_text ?? null,
      row.correct_options,
    );
    return {
      id: row.id,
      subject: normalizeSubject(row.subject),
      chapter: row.chapter,
      difficulty: normalizeDifficulty(String(row.difficulty)),
      questionType: reconciled.questionType,
    };
  });
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

export async function listOgcodeCatalogFacets(params: {
  level: 'class' | 'occurrence' | 'subject' | 'chapter' | 'concept';
  classes?: number[];
  occurrences?: string[];
  subjects?: string[];
  chapters?: string[];
  /**
   * Subjects the caller is allowed to see (entitlements ∩ study mode), always
   * intersected into the SQL subject filter. `null` means "no restriction".
   *
   * Facets are an ENUMERATION surface: without this, `?subjects=biology` would
   * happily list every Biology chapter and concept to a JEE-mode student even
   * though the question list itself is filtered. Resolved by the route, not
   * here, so this module stays free of request/auth concerns.
   */
  allowedSubjects?: string[] | null;
}): Promise<string[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) return [];
  await ensureCatalogSchema();

  const conds: string[] = [];
  const vals: unknown[] = [];

  const parsedClasses = (params.classes ?? []).map(Number).filter(n => !isNaN(n) && n > 0);
  if (parsedClasses.length) {
    vals.push(parsedClasses);
    conds.push(`class = ANY($${vals.length}::integer[])`);
  }
  const parsedOccurrences = (params.occurrences ?? []).map(s => String(s).trim()).filter(Boolean);
  if (parsedOccurrences.length) {
    // Same containment semantics as buildFilterClause — exam-family values
    // ("JEE") must match year/variant-suffixed rows ("JEE (2020)", "JEE Main").
    const likeConds = parsedOccurrences.map((occ) => {
      vals.push(`%${escapeLikePattern(occ)}%`);
      return `occurrence ILIKE $${vals.length}`;
    });
    conds.push(`(${likeConds.join(" OR ")})`);
  }
  const requestedSubjects = (params.subjects ?? []).map(s => normalizeSubject(String(s))).filter(Boolean);
  const allowedSubjects = params.allowedSubjects == null
    ? null
    : params.allowedSubjects.map(s => normalizeSubject(String(s))).filter(Boolean);
  // Intersect the caller's picks with what they may see. An empty intersection
  // is NOT "no filter" — it means the request can only return nothing.
  const parsedSubjects = allowedSubjects == null
    ? requestedSubjects
    : (requestedSubjects.length
        ? requestedSubjects.filter(s => allowedSubjects.includes(s))
        : allowedSubjects);
  if (allowedSubjects != null && parsedSubjects.length === 0) {
    return [];
  }
  if (parsedSubjects.length) {
    vals.push(parsedSubjects);
    conds.push(`subject = ANY($${vals.length}::text[])`);
  }
  const parsedChapters = (params.chapters ?? []).map(s => String(s).trim()).filter(Boolean);
  if (parsedChapters.length) {
    vals.push(parsedChapters);
    conds.push(`chapter = ANY($${vals.length}::text[])`);
  }

  const col = params.level === 'class' ? 'class::text' : params.level;
  const colRaw = params.level === 'class' ? 'class' : params.level;
  conds.push(`${colRaw} IS NOT NULL`);
  if (params.level !== 'class') {
    conds.push(`${params.level} <> ''`);
  }

  const where = `WHERE ${conds.join(' AND ')}`;
  const result = await pool.query<{ val: string }>(
    `SELECT DISTINCT ${col} AS val FROM ogcode_questions ${where} ORDER BY val ASC`,
    vals,
  );
  const raw = result.rows.map(r => String(r.val)).filter(Boolean);

  // Occurrence chips collapse into exam families — the raw column now holds
  // 15+ year/variant-suffixed values ("JEE (2020)", "JEE Main (NA)", ...)
  // which would each render as their own chip. Selection round-trips fine:
  // the family value matches via the containment clauses above.
  if (params.level === "occurrence") {
    const families = new Set<string>();
    for (const value of raw) {
      for (const family of canonicalOccurrenceFamilies(value)) {
        families.add(family);
      }
    }
    return [...families].sort();
  }

  return raw;
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
        option_images,
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
      WHERE id = $1
      LIMIT 1
    `,
    [questionId],
  );

  return result.rows[0] ? mapCatalogRow(result.rows[0]) : null;
}

/**
 * Which of these ids actually exist in the catalog.
 *
 * For pure existence checks, use this instead of `getOgcodeCatalogQuestionMap`:
 * that one hydrates every column — stem, options, explanation, images — of every
 * row, which is a lot of bytes to move in order to answer a yes/no question. A
 * generated full-length paper validates up to 180 ids at once.
 */
export async function filterExistingOgcodeQuestionIds(questionIds: string[]): Promise<Set<string>> {
  const pool = getOgcodePostgresPool();
  if (!pool || !questionIds.length) {
    return new Set();
  }
  await ensureCatalogSchema();
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM ogcode_questions WHERE id = ANY($1::text[])`,
    [[...new Set(questionIds)]],
  );
  return new Set(result.rows.map((row) => row.id));
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
        option_images,
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
 * A Question-of-the-Day "bag": one subject within one class band.
 *
 * `alreadyServed` is the ids this bag has handed out in its CURRENT cycle, which
 * is what makes the draw non-repeating. `includeUnclassified` decides whether
 * rows with `class IS NULL` belong to the band (senior only — see
 * src/lib/qotd-eligibility.ts).
 */
export type OgcodeBagDrawParams = {
  subject: string;
  classes: readonly number[];
  includeUnclassified: boolean;
  alreadyServed: readonly string[];
};

export type OgcodeBagDrawResult = {
  /** How many questions the bag holds in total. 0 means the bag does not exist. */
  bagTotal: number;
  /** How many of those have not been served in the current cycle. */
  unservedTotal: number;
  /** The drawn question, or null when the bag is empty. */
  questionId: string | null;
};

/**
 * Draw one question from a bag — uniformly at random, without repeating.
 *
 * The rule, in one statement: **take a random question this bag has not served
 * yet; if there is none left, the bag is exhausted, so refill it and take a
 * random one from the whole bag.** That `COALESCE` IS the recycle — the caller
 * only has to notice `unservedTotal === 0` and bump the bag's cycle counter.
 *
 * `bagTotal === 0` means no such bag exists today, which is how the class 9-10
 * gate falls out of the data rather than out of a special case: a junior-band
 * student resolves to a band that currently matches no rows, so there is nothing
 * to draw and no card to show.
 *
 * Eligibility is the pre-existing challenge predicate — an answerable MCQ — so a
 * Question of the Day is always solvable in one tap. Widening it to numerical
 * questions later is a change to this WHERE clause alone.
 *
 * Cost against the live 6 232-row bank: ~4.5 ms. It runs four times a day.
 */
export async function drawOgcodeBagQuestion(
  params: OgcodeBagDrawParams,
): Promise<OgcodeBagDrawResult> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return { bagTotal: 0, unservedTotal: 0, questionId: null };
  }
  await ensureCatalogSchema();

  const result = await pool.query<{
    bag_total: number;
    unserved_total: number;
    question_id: string | null;
  }>(
    `
      WITH bag AS (
        SELECT id
          FROM ogcode_questions
         WHERE LOWER(subject) = $1
           AND (class = ANY($2::int[]) OR ($3::boolean AND class IS NULL))
           AND question_type = 'mcq'
           AND correct_option IS NOT NULL
      ),
      unserved AS (
        SELECT id FROM bag WHERE NOT (id = ANY($4::text[]))
      )
      SELECT
        (SELECT count(*)::int FROM bag)      AS bag_total,
        (SELECT count(*)::int FROM unserved) AS unserved_total,
        COALESCE(
          (SELECT id FROM unserved ORDER BY random() LIMIT 1),
          (SELECT id FROM bag      ORDER BY random() LIMIT 1)
        ) AS question_id
    `,
    [
      String(params.subject).trim().toLowerCase(),
      [...params.classes],
      params.includeUnclassified,
      [...params.alreadyServed],
    ],
  );

  const row = result.rows[0];
  return {
    bagTotal: Number(row?.bag_total ?? 0),
    unservedTotal: Number(row?.unserved_total ?? 0),
    questionId: row?.question_id ?? null,
  };
}

/** §9 time-bucket width (seconds) and the overflow-bucket index cap. */
const OGCODE_TIME_BUCKET_SECONDS = 5;
const OGCODE_TIME_BUCKET_MAX = 120; // 120 × 5s = 600s+ overflow bucket

export function ogcodeTimeBucketIndex(timeSpentSeconds: number): number {
  const t = Number.isFinite(timeSpentSeconds) ? Math.max(0, timeSpentSeconds) : 0;
  return Math.min(OGCODE_TIME_BUCKET_MAX, Math.floor(t / OGCODE_TIME_BUCKET_SECONDS));
}

/** Optional §9 engagement inputs recorded alongside the base frequency stats. */
export type OgcodeStatsExtras = {
  /** Cumulative session time; recorded into the histogram + avg only when correct. */
  timeSpentSeconds?: number;
  /** True on this student's first-ever terminal outcome for the question (V2 only). */
  firstAttempt?: boolean;
  /** True when that first terminal outcome was a correct first try (total_attempts === 1). */
  firstAttemptCorrect?: boolean;
};

export async function incrementOgcodeCatalogQuestionStats(
  questionId: string,
  isCorrect: boolean,
  extras: OgcodeStatsExtras = {},
): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return;
  }

  await ensureCatalogSchema();

  const recordTime = isCorrect && Number.isFinite(extras.timeSpentSeconds ?? NaN);
  const timeValue = recordTime ? Math.max(0, extras.timeSpentSeconds as number) : 0;

  // Base frequency/acceptance + §9 avg-time (correct only) + first-attempt
  // counters (V2-supplied) in one statement so they can't drift apart.
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
        END,
        correct_time_sum = correct_time_sum + CASE WHEN $3 THEN $4::double precision ELSE 0 END,
        correct_time_count = correct_time_count + CASE WHEN $3 THEN 1 ELSE 0 END,
        first_attempt_total = first_attempt_total + CASE WHEN $5 THEN 1 ELSE 0 END,
        first_attempt_correct = first_attempt_correct + CASE WHEN $6 THEN 1 ELSE 0 END
      WHERE id = $1
    `,
    [questionId, isCorrect, recordTime, timeValue, Boolean(extras.firstAttempt), Boolean(extras.firstAttemptCorrect)],
  );

  if (recordTime) {
    await pool.query(
      `
        INSERT INTO ogcode_question_time_buckets (question_id, bucket_index, count)
        VALUES ($1, $2, 1)
        ON CONFLICT (question_id, bucket_index)
        DO UPDATE SET count = ogcode_question_time_buckets.count + 1
      `,
      [questionId, ogcodeTimeBucketIndex(timeValue)],
    );
  }
}

export type OgcodeQuestionStatsMessage = {
  /** Global correct rate, 0-100 (from acceptance_rate). */
  acceptanceRate: number;
  /** How many distinct students have completed this question (first_attempt_total). */
  completedByCount: number;
  /** % of completers who did NOT solve on their first try. Null if too little data. */
  neededRetryPercent: number | null;
  /** % of solvers this student was faster than. Null unless a correct tt is given + data exists. */
  fasterThanPercent: number | null;
  /** True when this is the very first completion anywhere (cold-start copy). */
  isFirstEver: boolean;
};

/**
 * §9 messaging payload for the result view. Reads the histogram + counters and,
 * when the caller's own correct `timeSpentSeconds` is supplied, computes the
 * speed percentile (fraction of recorded solvers strictly slower).
 */
export async function getOgcodeQuestionStatsMessage(
  questionId: string,
  opts: { timeSpentSeconds?: number; isCorrect?: boolean } = {},
): Promise<OgcodeQuestionStatsMessage | null> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return null;
  }

  await ensureCatalogSchema();
  const statsResult = await pool.query<{
    acceptance_rate: number | string | null;
    correct_time_count: number | string | null;
    first_attempt_total: number | string | null;
    first_attempt_correct: number | string | null;
  }>(
    `SELECT acceptance_rate, correct_time_count, first_attempt_total, first_attempt_correct
       FROM ogcode_questions WHERE id = $1`,
    [questionId],
  );
  const row = statsResult.rows[0];
  if (!row) {
    return null;
  }

  const completedByCount = Number(row.first_attempt_total ?? 0);
  const firstAttemptCorrect = Number(row.first_attempt_correct ?? 0);
  const correctTimeCount = Number(row.correct_time_count ?? 0);

  const neededRetryPercent =
    completedByCount >= 5
      ? Math.round(((completedByCount - firstAttemptCorrect) / completedByCount) * 100)
      : null;

  let fasterThanPercent: number | null = null;
  if (opts.isCorrect && Number.isFinite(opts.timeSpentSeconds ?? NaN) && correctTimeCount >= 5) {
    const myBucket = ogcodeTimeBucketIndex(opts.timeSpentSeconds as number);
    const slowerResult = await pool.query<{ slower: number | string }>(
      `SELECT COALESCE(SUM(count), 0) AS slower
         FROM ogcode_question_time_buckets
        WHERE question_id = $1 AND bucket_index > $2`,
      [questionId, myBucket],
    );
    const slower = Number(slowerResult.rows[0]?.slower ?? 0);
    fasterThanPercent = Math.round((slower / correctTimeCount) * 100);
  }

  return {
    acceptanceRate: Math.round(Number(row.acceptance_rate ?? 0)),
    completedByCount,
    neededRetryPercent,
    fasterThanPercent,
    isFirstEver: completedByCount <= 1,
  };
}

export type ContributedCatalogInput = {
  /** Catalog row id = source content.questions id (so re-publish updates in place). */
  id: string;
  text: string;
  options: string[] | null;
  image?: string | null;
  optionImages?: (string | null)[] | null;
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
  /** Tags this row as a contest document-import (hidden from general OGCode surfaces). */
  isContestImport?: boolean;
  /** When a contest import, whether it may be suggested in the contest practice/DPP pools. */
  contestPracticeEligible?: boolean;
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
        contributor_workspace_id, attribution_name, attribution_logo_url,
        image, option_images, is_contributed,
        is_contest_import, contest_practice_eligible
      ) VALUES (
        $1,
        (SELECT COALESCE(MAX(source_index), 0) + 1 FROM ogcode_questions),
        $2, $3::jsonb, $4, $5::jsonb, $6, $7::jsonb, $8, $9::jsonb, $10, $11,
        $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21, $22::jsonb, TRUE,
        $23, $24
      )
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        options = EXCLUDED.options,
        image = EXCLUDED.image,
        option_images = EXCLUDED.option_images,
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
        is_contest_import = EXCLUDED.is_contest_import,
        contest_practice_eligible = EXCLUDED.contest_practice_eligible,
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
      input.image ?? null,
      JSON.stringify(input.optionImages ?? null),
      input.isContestImport ?? false,
      input.contestPracticeEligible ?? false,
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

// ── Admin edit (issue triage) ────────────────────────────────────────────────

/** Editable content fields of a catalog question (admin issue-fix). */
export type OgcodeQuestionEditFields = {
  text: string;
  options: string[] | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  answerText: string | null;
  explanation: string;
  hint: string | null;
  subject: string;
  chapter: string;
  difficulty: string;
};

/**
 * Admin: overwrite the editable content of a catalog question (used to fix a
 * reported issue). Only content fields — never touches stats/attribution.
 * Busts the catalog cache so students see the fix promptly.
 */
export async function updateOgcodeCatalogQuestion(id: string, fields: OgcodeQuestionEditFields): Promise<{ ok: boolean }> {
  const pool = getOgcodePostgresPool();
  if (!pool) return { ok: false };
  await ensureCatalogSchema();
  const res = await pool.query(
    `UPDATE ogcode_questions SET
        text = $2,
        options = $3::jsonb,
        correct_option = $4,
        correct_options = $5::jsonb,
        answer_text = $6,
        explanation = $7,
        hint = $8,
        subject = $9,
        chapter = $10,
        difficulty = $11,
        updated_at = NOW()
      WHERE id = $1`,
    [
      id,
      fields.text,
      fields.options ? JSON.stringify(fields.options) : null,
      fields.correctOption,
      fields.correctOptions ? JSON.stringify(fields.correctOptions) : null,
      fields.answerText,
      fields.explanation,
      fields.hint,
      normalizeSubject(fields.subject),
      fields.chapter,
      String(fields.difficulty || "medium").toLowerCase(),
    ],
  );
  try {
    revalidateTag("ogcode-catalog", "max");
  } catch {
    // outside request context — row already committed
  }
  return { ok: (res.rowCount ?? 0) > 0 };
}

// ── Admin analytics ──────────────────────────────────────────────────────────

/**
 * Attempt totals for the admin dashboard, from ogcode_question_progress:
 * distinctQuestionsAttempted = rows where `attempted`; totalAttemptEvents = Σ total_attempts.
 */
export async function getOgcodeAttemptTotals(): Promise<{ distinctQuestionsAttempted: number; totalAttemptEvents: number }> {
  const pool = getOgcodePostgresPool();
  if (!pool) return { distinctQuestionsAttempted: 0, totalAttemptEvents: 0 };
  await ensureCatalogSchema();
  try {
    const res = await pool.query<{ distinct_attempted: string; total_events: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE attempted) AS distinct_attempted,
         COALESCE(SUM(total_attempts), 0) AS total_events
       FROM ogcode_question_progress`,
    );
    const row = res.rows[0];
    return {
      distinctQuestionsAttempted: Number(row?.distinct_attempted ?? 0),
      totalAttemptEvents: Number(row?.total_events ?? 0),
    };
  } catch {
    return { distinctQuestionsAttempted: 0, totalAttemptEvents: 0 };
  }
}

/** Weekly first-terminal completions for the last `weeks` weeks (oldest→newest). */
export async function getOgcodeWeeklyTerminals(weeks = 8): Promise<{ weekStart: string; count: number }[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) return [];
  await ensureCatalogSchema();
  const n = Math.min(Math.max(1, weeks), 52);
  try {
    const res = await pool.query<{ week_start: string; count: number | string }>(
      `SELECT date_trunc('week', first_terminal_at) AS week_start, COUNT(*) AS count
         FROM ogcode_question_progress
        WHERE first_terminal_at IS NOT NULL
          AND first_terminal_at >= date_trunc('week', NOW()) - ($1::int - 1) * INTERVAL '1 week'
        GROUP BY 1
        ORDER BY 1 ASC`,
      [n],
    );
    return res.rows.map((row) => ({
      weekStart: new Date(row.week_start as string).toISOString(),
      count: Number(row.count ?? 0),
    }));
  } catch {
    return [];
  }
}
