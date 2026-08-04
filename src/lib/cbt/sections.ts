/**
 * Sectional (per-subject) marking for a CBT attempt — pure logic, no DB.
 *
 * A CBT paper is already delivered to the student in subject sections
 * (`getStudentTestPayload` groups by `question.subject ?? "General"`), so the
 * marks a participant scored are reported the same way: one row per subject,
 * plus the total the teacher already sees.
 *
 * Grouping rules (deliberate, and pinned by tests):
 *  • The key is the subject lower-cased and trimmed, so "Physics", "physics "
 *    and "PHYSICS" are ONE section rather than three. The label shown is the
 *    first spelling encountered in paper order, so the teacher's own casing
 *    survives.
 *  • A question with no subject — NULL, empty, or literally "general" — lands
 *    in a single **General** bucket. That mirrors the section the student
 *    actually sat under, so the report can never claim a section that wasn't
 *    on the paper.
 *  • Section order is paper order (first appearance), not alphabetical, so the
 *    report reads in the same sequence as the exam.
 */

export const GENERAL_SECTION_KEY = "general";
export const GENERAL_SECTION_LABEL = "General";

export type CbtSectionScore = {
  key: string;
  label: string;
  /** Paper order — the position of this section's first question. */
  order: number;
  score: number;
  maxScore: number;
  questionCount: number;
  correct: number;
  wrong: number;
  skipped: number;
  needsReview: number;
  /** correct / attempted, 0 when nothing was attempted. 0–100. */
  accuracy: number;
  /** Advisory: seconds accounted across this section's questions. */
  timeSeconds: number;
};

export type CbtSectionScores = Record<string, CbtSectionScore>;

/** One graded question, as both the grader and the stored submission see it. */
export type CbtSectionInput = {
  position: number;
  subject: string | null | undefined;
  marks: number;
  marksAwarded: number;
  isCorrect: boolean;
  needsReview: boolean;
  attempted: boolean;
  timeSeconds?: number;
};

export function canonicalSubjectKey(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (!trimmed || trimmed === GENERAL_SECTION_KEY) return GENERAL_SECTION_KEY;
  return trimmed;
}

export function canonicalSubjectLabel(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === GENERAL_SECTION_KEY) return GENERAL_SECTION_LABEL;
  return trimmed;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Aggregates graded questions into per-subject sections.
 *
 * Invariants asserted by the tests: Σ section.score === the attempt total, and
 * Σ section.maxScore === the paper max. Fractional marks (MSQ / matrix-match
 * partial credit) are summed at full precision and rounded ONCE at the end, so
 * a 90-question paper cannot drift away from the participant's stored score.
 */
export function buildSectionScores(questions: CbtSectionInput[]): CbtSectionScores {
  const sections: CbtSectionScores = {};

  for (const q of questions) {
    const key = canonicalSubjectKey(q.subject);
    let section = sections[key];
    if (!section) {
      section = {
        key,
        label: canonicalSubjectLabel(q.subject),
        order: q.position,
        score: 0,
        maxScore: 0,
        questionCount: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        needsReview: 0,
        accuracy: 0,
        timeSeconds: 0,
      };
      sections[key] = section;
    }

    section.questionCount += 1;
    section.score += Number.isFinite(q.marksAwarded) ? q.marksAwarded : 0;
    section.maxScore += Number.isFinite(q.marks) ? q.marks : 0;
    section.timeSeconds += Math.max(0, Math.floor(Number(q.timeSeconds) || 0));
    section.order = Math.min(section.order, q.position);

    // A question awaiting manual review is neither right nor wrong yet — it is
    // counted separately so the report never reports a subjective answer as a
    // mistake the student made.
    if (q.needsReview) section.needsReview += 1;
    else if (!q.attempted) section.skipped += 1;
    else if (q.isCorrect) section.correct += 1;
    else section.wrong += 1;
  }

  for (const section of Object.values(sections)) {
    section.score = round3(section.score);
    section.maxScore = round3(section.maxScore);
    const attempted = section.correct + section.wrong;
    section.accuracy = attempted > 0 ? Math.round((section.correct / attempted) * 100) : 0;
  }

  return sections;
}

/** Sections in paper order — the sequence the student actually sat them in. */
export function orderedSections(sections: CbtSectionScores | null | undefined): CbtSectionScore[] {
  if (!sections) return [];
  return Object.values(sections).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/**
 * Whether a per-section breakdown is worth showing at all.
 *
 * A single-section paper's "sectional marks" are just the total restated, and
 * rendering "Physics 72/80" directly above "Total 72/80" reads like a bug.
 */
export function hasMeaningfulSections(sections: CbtSectionScores | null | undefined): boolean {
  return Object.keys(sections ?? {}).length > 1;
}

/**
 * Display fallback for a stored row that lost its label. The key is lower-cased
 * by construction, and "physics" as a table heading reads like a bug — so the
 * degenerate path title-cases it rather than showing the raw key.
 */
function labelFromKey(key: string): string {
  if (key === GENERAL_SECTION_KEY) return GENERAL_SECTION_LABEL;
  return key.replace(/(^|\s)(\p{Ll})/gu, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}

/** Parses the JSONB column back into a typed map, tolerating legacy `{}`. */
export function parseSectionScores(raw: unknown): CbtSectionScores {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CbtSectionScores = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Partial<CbtSectionScore>;
    out[key] = {
      key,
      label: typeof v.label === "string" && v.label.trim() ? v.label : labelFromKey(key),
      order: Number(v.order ?? 0),
      score: Number(v.score ?? 0),
      maxScore: Number(v.maxScore ?? 0),
      questionCount: Number(v.questionCount ?? 0),
      correct: Number(v.correct ?? 0),
      wrong: Number(v.wrong ?? 0),
      skipped: Number(v.skipped ?? 0),
      needsReview: Number(v.needsReview ?? 0),
      accuracy: Number(v.accuracy ?? 0),
      timeSeconds: Number(v.timeSeconds ?? 0),
    };
  }
  return out;
}
