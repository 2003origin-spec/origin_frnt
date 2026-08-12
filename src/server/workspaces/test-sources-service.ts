/**
 * Multi-source ("build from documents") test assembly for the Origin teacher
 * side — the counterpart of CBT's `createTestFromSources`.
 *
 * A teacher who has just imported three question papers should be able to say
 * "paper 1, then my Thermodynamics topic group, then last term's mock" and get
 * one stacked paper, instead of clicking 90 questions one at a time.
 *
 * Three source kinds, all workspace-scoped:
 *   • `import_job` — every Question-Bag question published from one imported
 *     document (`content.questions.imported_job_id`);
 *   • `bag_topic`  — a `subject::chapter` group inside the Question Bag;
 *   • `test`       — an existing test's questions, which is the direct
 *     expression of "one question can be used in multiple tests";
 *   • `cluster`    — a named, teacher-curated, ORDERED set. Unlike the other
 *     three (which are groupings that happen to exist), a cluster is built
 *     deliberately, so stacking clusters is how a teacher assembles a paper
 *     section by section.
 *
 * Ordering, de-duplication and per-source marks come from the shared pure
 * stacker; this module only resolves ids and enforces ownership. An id the
 * workspace does not own resolves to NOTHING rather than raising — the same
 * rule CBT uses for clusters, so a probe can't confirm that an id exists.
 */

import { AuthzError } from "@/server/authz";
import { getUserPostgresPool } from "@/server/user-postgres";
import {
  parseSources,
  stackSources,
  type ResolvedTestSource,
  type SourceStackResult,
  type TestSource,
} from "@/lib/assessments/source-stack";

import { ensureContentSchema } from "./content-schema";
import { listClusterUsableQuestionIds, listClusters } from "./clusters-store";
import type { TestQuestionInput } from "./tests-service";

export type TeacherTestSourceKind = "import_job" | "bag_topic" | "test" | "cluster";

export const TEACHER_TEST_SOURCE_KINDS: readonly TeacherTestSourceKind[] = [
  "import_job",
  "bag_topic",
  "test",
  "cluster",
];

export type TeacherTestSource = TestSource<TeacherTestSourceKind>;

/** One pickable source, as offered to the builder UI. */
export type TeacherTestSourceOption = {
  kind: TeacherTestSourceKind;
  id: string;
  label: string;
  /** Questions this source contributes today. */
  questionCount: number;
  /** Extra context for the row (document status, topic subject, …). */
  note?: string;
};

/** How many sources one paper may be stacked from. */
export const MAX_TEACHER_TEST_SOURCES = 12;

/** Ceiling on a stacked paper, mirroring CBT's per-test cap. */
export const MAX_TEACHER_TEST_QUESTIONS = 200;

/** The bag statuses a question must have to be usable in a test. */
const USABLE_STATUSES = ["ready", "published_private"];

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** `subject::chapter` — the id of a topic-group source. */
export function bagTopicId(subject: string, chapter: string): string {
  return `${subject}::${chapter}`;
}

function parseBagTopicId(id: string): { subject: string; chapter: string } | null {
  const index = id.indexOf("::");
  if (index <= 0) return null;
  const subject = id.slice(0, index);
  const chapter = id.slice(index + 2);
  if (!subject || !chapter) return null;
  return { subject, chapter };
}

// ── Listing the pickable sources ─────────────────────────────────────────────

/**
 * Everything this workspace can stack a paper from, grouped by kind and ordered
 * newest/most-populated first. Sources that would contribute nothing (a
 * document whose questions were all rejected, an empty test) are omitted — a
 * teacher picking one and getting zero questions reads like a bug.
 */
export async function listTeacherTestSources(workspaceId: string): Promise<TeacherTestSourceOption[]> {
  await ensureContentSchema();

  const [clusters, documents, topics, tests] = await Promise.all([
    listClusterSources(workspaceId),
    listImportJobSources(workspaceId),
    listBagTopicSources(workspaceId),
    listTestSources(workspaceId),
  ]);

  // Clusters first: they are the deliberately-curated sets, so they are what a
  // teacher assembling a paper reaches for.
  return [...clusters, ...documents, ...topics, ...tests];
}

async function listClusterSources(workspaceId: string): Promise<TeacherTestSourceOption[]> {
  const clusters = await listClusters(workspaceId);
  return clusters
    .filter((cluster) => cluster.questionCount > 0)
    .map((cluster) => ({
      kind: "cluster" as const,
      id: cluster.id,
      label: cluster.name,
      questionCount: cluster.questionCount,
      note: cluster.sourceImportJobId ? "Cluster · from a document" : "Cluster",
    }));
}

async function listImportJobSources(workspaceId: string): Promise<TeacherTestSourceOption[]> {
  const res = await pool().query(
    `SELECT j.id,
            COALESCE(NULLIF(btrim(j.source_file_name), ''), 'Imported document') AS label,
            j.status,
            COUNT(q.id)::int AS question_count
       FROM import.document_import_jobs j
       JOIN content.questions q
         ON q.imported_job_id = j.id
        AND q.workspace_id = j.workspace_id
        AND q.status::text = ANY($2::text[])
      WHERE j.workspace_id = $1
      GROUP BY j.id, label, j.status
     HAVING COUNT(q.id) > 0
      ORDER BY MAX(j.created_at) DESC
      LIMIT 60`,
    [workspaceId, USABLE_STATUSES],
  );
  return res.rows.map((r) => ({
    kind: "import_job" as const,
    id: String(r.id),
    label: String(r.label),
    questionCount: Number(r.question_count ?? 0),
    note: "Imported document",
  }));
}

async function listBagTopicSources(workspaceId: string): Promise<TeacherTestSourceOption[]> {
  const res = await pool().query(
    `SELECT v.subject, v.chapter, COUNT(*)::int AS question_count
       FROM content.questions q
       JOIN content.question_versions v ON v.id = q.current_version_id
      WHERE q.workspace_id = $1 AND q.status::text = ANY($2::text[])
      GROUP BY v.subject, v.chapter
      ORDER BY COUNT(*) DESC, v.subject ASC, v.chapter ASC
      LIMIT 60`,
    [workspaceId, USABLE_STATUSES],
  );
  return res.rows.map((r) => {
    const subject = String(r.subject ?? "");
    const chapter = String(r.chapter ?? "");
    return {
      kind: "bag_topic" as const,
      id: bagTopicId(subject, chapter),
      label: `${subject} · ${chapter}`,
      questionCount: Number(r.question_count ?? 0),
      note: "Question Bag topic",
    };
  });
}

async function listTestSources(workspaceId: string): Promise<TeacherTestSourceOption[]> {
  const res = await pool().query(
    `SELECT t.id, t.title, t.status, COUNT(tq.position)::int AS question_count
       FROM assessment.tests t
       JOIN assessment.test_questions tq ON tq.test_id = t.id
      WHERE t.workspace_id = $1
      GROUP BY t.id, t.title, t.status
     HAVING COUNT(tq.position) > 0
      ORDER BY MAX(t.created_at) DESC
      LIMIT 40`,
    [workspaceId],
  );
  return res.rows.map((r) => ({
    kind: "test" as const,
    id: String(r.id),
    label: String(r.title ?? "Untitled test"),
    questionCount: Number(r.question_count ?? 0),
    note: `Existing test · ${String(r.status ?? "draft")}`,
  }));
}

// ── Resolving a picked stack into questions ──────────────────────────────────

/** Question-Bag ids published from one imported document, in bank order. */
async function resolveImportJob(workspaceId: string, jobId: string): Promise<string[]> {
  const res = await pool().query(
    `SELECT q.id
       FROM content.questions q
      WHERE q.workspace_id = $1 AND q.imported_job_id = $2 AND q.status::text = ANY($3::text[])
      ORDER BY q.created_at ASC, q.id ASC`,
    [workspaceId, jobId, USABLE_STATUSES],
  );
  return res.rows.map((r) => String(r.id));
}

async function resolveBagTopic(workspaceId: string, id: string): Promise<string[]> {
  const parsed = parseBagTopicId(id);
  if (!parsed) return [];
  const res = await pool().query(
    `SELECT q.id
       FROM content.questions q
       JOIN content.question_versions v ON v.id = q.current_version_id
      WHERE q.workspace_id = $1 AND v.subject = $2 AND v.chapter = $3
        AND q.status::text = ANY($4::text[])
      ORDER BY q.created_at ASC, q.id ASC`,
    [workspaceId, parsed.subject, parsed.chapter, USABLE_STATUSES],
  );
  return res.rows.map((r) => String(r.id));
}

/**
 * An existing test's Question-Bag questions, in paper order.
 *
 * OG Code rows are deliberately skipped: this builder stacks bag questions, and
 * an OG Code id is not a `content.questions` id. The count difference is
 * reported back to the teacher as `skipped` so it isn't silent.
 */
async function resolveTest(workspaceId: string, testId: string): Promise<{ ids: string[]; skipped: number }> {
  const res = await pool().query(
    `SELECT tq.content_question_id, tq.source_bank
       FROM assessment.test_questions tq
       JOIN assessment.tests t ON t.id = tq.test_id
      WHERE t.workspace_id = $1 AND tq.test_id = $2
      ORDER BY tq.position ASC`,
    [workspaceId, testId],
  );
  const ids: string[] = [];
  let skipped = 0;
  for (const row of res.rows) {
    const id = row.content_question_id ? String(row.content_question_id) : "";
    if (row.source_bank === "workspace_bag" && id) ids.push(id);
    else skipped += 1;
  }
  return { ids, skipped };
}

export type TeacherSourceResolution = {
  questions: TestQuestionInput[];
  perSource: (SourceStackResult<TeacherTestSourceKind>["perSource"][number] & {
    skipped: number;
    /** Blueprint section this source was mapped onto, when the test has one. */
    sectionId?: string;
    sectionLabel?: string;
  })[];
  totalQuestions: number;
};

/**
 * One blueprint section, as snapshotted onto a full-mock test's
 * `selection_policy`. Only the fields stacking needs.
 */
type BlueprintSectionSnapshot = {
  id: string;
  label: string;
  plannedCount: number;
  marks: { correct: number; incorrect: number };
};

/**
 * The blueprint sections of a full-mock test, or null for an ordinary test.
 *
 * The `kind` discriminator matters: `selection_policy` is free-form JSONB that
 * other builders write into too, so it must be positively identified as a
 * full-length blueprint before its shape is trusted.
 */
/** A finite number, or the fallback. Rejects null/undefined, which `Number()` coerces to 0. */
function numberOr(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function blueprintSectionsOf(
  selectionPolicy: Record<string, unknown> | null | undefined,
): BlueprintSectionSnapshot[] | null {
  if (!selectionPolicy || selectionPolicy.kind !== "full_length_mock") return null;
  const raw = selectionPolicy.sections;
  if (!Array.isArray(raw)) return null;
  const sections: BlueprintSectionSnapshot[] = [];
  for (const entry of raw as Array<Record<string, unknown>>) {
    const marks = (entry?.marks ?? {}) as { correct?: unknown; incorrect?: unknown };
    if (typeof entry?.id !== "string") continue;
    sections.push({
      id: entry.id,
      label: typeof entry.label === "string" ? entry.label : entry.id,
      plannedCount: Number(entry.plannedCount ?? entry.count ?? 0),
      marks: {
        // `Number(null)` is 0, not NaN — so a null/missing value must be
        // rejected explicitly. Without this a malformed section would silently
        // become "worth 0" or "no negative marking", quietly changing how a
        // paper scores.
        correct: numberOr(marks.correct, 4),
        incorrect: numberOr(marks.incorrect, -1),
      },
    });
  }
  return sections.length ? sections : null;
}

/**
 * Resolves a picked stack into the ordered question list `createTeacherTest`
 * expects. Positions are 1-based, matching the wizard's own numbering.
 *
 * When `blueprintSections` is supplied (the target test is a full-mock draft),
 * source *i* lands in blueprint section *i*: its questions inherit that
 * section's `sectionId` and marks, which is what turns "stack one cluster per
 * section" into a genuinely sectional paper for the student. Sources past the
 * last section fall back to flat marking rather than erroring, and a test with
 * no blueprint behaves exactly as it always has.
 *
 * Plan: V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md D6.
 */
export async function resolveTeacherTestSources(
  workspaceId: string,
  sources: TeacherTestSource[],
  blueprintSections?: BlueprintSectionSnapshot[] | null,
): Promise<TeacherSourceResolution> {
  if (sources.length === 0) {
    throw new AuthzError(400, "Pick at least one document, topic or test.");
  }
  if (sources.length > MAX_TEACHER_TEST_SOURCES) {
    throw new AuthzError(400, `You can combine at most ${MAX_TEACHER_TEST_SOURCES} sources in one test.`);
  }
  await ensureContentSchema();

  const resolved: ResolvedTestSource<TeacherTestSourceKind>[] = [];
  const skippedById = new Map<string, number>();

  for (const source of sources) {
    let questionIds: string[] = [];
    if (source.kind === "import_job") {
      questionIds = await resolveImportJob(workspaceId, source.id);
    } else if (source.kind === "bag_topic") {
      questionIds = await resolveBagTopic(workspaceId, source.id);
    } else if (source.kind === "cluster") {
      // Cluster order IS the order the questions get asked.
      questionIds = await listClusterUsableQuestionIds(workspaceId, source.id);
    } else {
      const { ids, skipped } = await resolveTest(workspaceId, source.id);
      questionIds = ids;
      if (skipped > 0) skippedById.set(source.id, skipped);
    }
    resolved.push({ ...source, questionIds });
  }

  const stacked = stackSources(resolved);
  if (stacked.questions.length === 0) {
    throw new AuthzError(400, "None of the selected sources have any usable questions yet.");
  }
  if (stacked.questions.length > MAX_TEACHER_TEST_QUESTIONS) {
    throw new AuthzError(
      400,
      `That selection makes ${stacked.questions.length} questions; a test can have at most ` +
        `${MAX_TEACHER_TEST_QUESTIONS}. Remove a source and try again.`,
    );
  }

  // Map each SOURCE to a blueprint section, in pick order, then look the
  // section up per question by which source contributed it.
  const sectionBySourceId = new Map<string, BlueprintSectionSnapshot>();
  if (blueprintSections?.length) {
    stacked.perSource.forEach((entry, index) => {
      const section = blueprintSections[index];
      if (section) sectionBySourceId.set(entry.id, section);
    });
  }

  return {
    questions: stacked.questions.map((q, index) => {
      const section = sectionBySourceId.get(q.sourceId);
      return {
        position: index + 1,
        sourceBank: "workspace_bag" as const,
        contentQuestionId: q.questionId,
        ogcodeQuestionId: null,
        // A blueprint section states what its questions are worth; without one
        // the per-source marks the teacher set still apply.
        marks: section ? section.marks.correct : q.marks,
        negativeMarks: section ? section.marks.incorrect : q.negativeMarks,
        ...(section ? { metadata: { sectionId: section.id } } : {}),
      };
    }),
    perSource: stacked.perSource.map((entry) => {
      const section = sectionBySourceId.get(entry.id);
      return {
        ...entry,
        skipped: skippedById.get(entry.id) ?? 0,
        ...(section ? { sectionId: section.id, sectionLabel: section.label } : {}),
      };
    }),
    totalQuestions: stacked.questions.length,
  };
}

/** Parses the API's `sources` array against the teacher vocabulary. */
export function parseTeacherTestSources(raw: unknown): TeacherTestSource[] {
  return parseSources(raw, TEACHER_TEST_SOURCE_KINDS);
}

// ── Reuse visibility ─────────────────────────────────────────────────────────

export type TeacherQuestionUsage = {
  /** How many OTHER tests in this workspace already include the question. */
  testCount: number;
  /** Their titles (capped), for an informational tooltip. */
  titles: string[];
  /** How many of those are live right now — editing then changes a running paper. */
  liveCount: number;
};

/**
 * Where each Question-Bag question is already used, excluding the test being
 * edited.
 *
 * Reuse across tests is allowed and always has been (`assessment.test_questions`
 * is keyed by `(test_id, position)`, and nothing in `applyTestQuestions`
 * objects) — a teacher legitimately reuses a question across a mock, a revision
 * paper and a retest, and historical results are unaffected either way because
 * every attempt snapshots its question. This is purely informational, so the
 * builder can say "already in 3 tests" instead of leaving the teacher guessing.
 */
export async function listWorkspaceQuestionUsage(
  workspaceId: string,
  excludeTestId?: string,
): Promise<Record<string, TeacherQuestionUsage>> {
  await ensureContentSchema();
  const res = await pool().query(
    `SELECT tq.content_question_id, t.title, t.status
       FROM assessment.test_questions tq
       JOIN assessment.tests t ON t.id = tq.test_id
      WHERE t.workspace_id = $1
        AND tq.content_question_id IS NOT NULL
        AND ($2::text IS NULL OR tq.test_id <> $2)
      ORDER BY t.created_at DESC`,
    [workspaceId, excludeTestId ?? null],
  );

  const usage: Record<string, TeacherQuestionUsage> = {};
  for (const row of res.rows) {
    const id = String(row.content_question_id);
    const entry = (usage[id] ??= { testCount: 0, titles: [], liveCount: 0 });
    entry.testCount += 1;
    if (entry.titles.length < 5) entry.titles.push(String(row.title ?? ""));
    if (row.status === "live") entry.liveCount += 1;
  }
  return usage;
}
