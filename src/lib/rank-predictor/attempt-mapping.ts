/**
 * "Fill from a past Origin test" (plan §4.6) — pure mapping from a stored test
 * result to the predictor's mark boxes. The SQL lives in
 * src/server/rank-predictor/predictor-service.ts.
 *
 * subject_stats is written in two casings (legacy/analytics-store.ts snake,
 * legacy/assessments.ts camel); both are read. NEET Botany + Zoology add up to
 * Biology. JEE Advanced mocks are one 198-mark paper (66 per subject), scaled
 * to the real 120 per subject and labelled rough (Q4).
 */

import { clamp } from "./interpolate";
import { EXAM_SUBJECTS } from "./subjects";
import type { RankPredictorExam } from "./types";

export type AttemptKind = "full_mock" | "subject" | "teacher" | "other";

export type StoredAttemptRow = {
  id: string;
  title: string;
  createdAt: string;
  score: number;
  totalMarks: number;
  subjectStats: unknown;
  /** analytics.custom_tests.exam_preset (full-length mocks only). */
  examPreset: string | null;
  /** Set for teacher-assigned tests. */
  assignmentId: string | null;
};

export type SubjectScore = { score: number; outOf: number };

export type AttemptSummary = {
  resultId: string;
  title: string;
  takenAt: string;
  score: number;
  outOf: number;
  kind: AttemptKind;
  /** The exam a full-length mock was for (null for other tests). */
  examPreset: RankPredictorExam | null;
  subjects: Record<string, SubjectScore>;
};

export type FilledBox = {
  value: number;
  /** "mock" = from a full mock of this exam; "projected" = percentage × max from another test. */
  how: "mock" | "scaled" | "projected";
  note: string;
};

export type AttemptFill = {
  exam: RankPredictorExam;
  resultId: string | null;
  title: string;
  kind: AttemptKind;
  /** Boxes this attempt fills; missing boxes stay for the student to type. */
  marks: Record<string, FilledBox>;
  quality: "estimate" | "rough";
  notes: string[];
};

const SUBJECT_ALIASES: Record<string, string> = {
  physics: "physics",
  chemistry: "chemistry",
  biology: "biology",
  botany: "biology",
  zoology: "biology",
  mathematics: "maths",
  maths: "maths",
  math: "maths",
};

const PRESETS = new Set<RankPredictorExam>(["neet", "jee-main", "jee-advanced"]);

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Normalised per-subject {score, outOf} from subject_stats (both casings, Botany+Zoology summed). */
export function readSubjectStats(raw: unknown): Record<string, SubjectScore> {
  const out: Record<string, SubjectScore> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = SUBJECT_ALIASES[key.trim().toLowerCase()];
    if (!id || !value || typeof value !== "object") continue;
    const stats = value as Record<string, unknown>;
    const score = num(stats.score);
    const outOf = num(stats.total_marks) ?? num(stats.totalMarks);
    if (score === null || outOf === null || outOf <= 0) continue;
    const prev = out[id] ?? { score: 0, outOf: 0 };
    out[id] = { score: prev.score + score, outOf: prev.outOf + outOf };
  }
  return out;
}

export function attemptKind(row: StoredAttemptRow, subjects: Record<string, SubjectScore>): AttemptKind {
  if (row.examPreset && PRESETS.has(row.examPreset as RankPredictorExam)) return "full_mock";
  if (row.assignmentId) return "teacher";
  if (Object.keys(subjects).length === 1) return "subject";
  return "other";
}

export function summariseAttempt(row: StoredAttemptRow): AttemptSummary {
  const subjects = readSubjectStats(row.subjectStats);
  const kind = attemptKind(row, subjects);
  return {
    resultId: row.id,
    title: row.title,
    takenAt: row.createdAt,
    score: row.score,
    outOf: row.totalMarks,
    kind,
    examPreset: kind === "full_mock" ? (row.examPreset as RankPredictorExam) : null,
    subjects,
  };
}

/** Can this attempt fill at least one box of `exam`? (Other exams' full mocks are left out.) */
export function attemptFitsExam(summary: AttemptSummary, exam: RankPredictorExam): boolean {
  if (summary.kind === "full_mock") return summary.examPreset === exam;
  const ids = new Set(EXAM_SUBJECTS[exam].map((b) => b.id));
  const covered = Object.keys(summary.subjects);
  return covered.length > 0 && covered.every((id) => ids.has(id));
}

/** Map one attempt to the exam's boxes. */
export function fillFromAttempt(summary: AttemptSummary, exam: RankPredictorExam): AttemptFill {
  const boxes = EXAM_SUBJECTS[exam];
  const marks: Record<string, FilledBox> = {};
  const notes: string[] = [];
  const sameExamMock = summary.kind === "full_mock" && summary.examPreset === exam;
  for (const box of boxes) {
    const s = summary.subjects[box.id];
    if (!s) continue;
    if (sameExamMock && exam !== "jee-advanced") {
      marks[box.id] = { value: Math.round(clamp(s.score, box.min, box.max)), how: "mock", note: `From your ${summary.title}` };
    } else if (sameExamMock) {
      const value = Math.round(clamp((s.score * box.max) / s.outOf, box.min, box.max));
      marks[box.id] = { value, how: "scaled", note: `Scaled from ${Math.round(s.score)}/${Math.round(s.outOf)} to /${box.max}` };
    } else {
      const value = Math.round(clamp((s.score / s.outOf) * box.max, box.min, box.max));
      marks[box.id] = { value, how: "projected", note: `Projected from a ${box.label} test (${Math.round(s.score)}/${Math.round(s.outOf)})` };
    }
  }
  if (sameExamMock && exam === "jee-advanced") {
    notes.push("Origin's JEE Advanced mock is one 198-mark paper; we scaled each subject to the real 120 marks (rough).");
  }
  if (!sameExamMock && Object.keys(marks).length) {
    notes.push("Only the subjects this test covers are filled; type the rest yourself.");
  }
  return {
    exam,
    resultId: summary.resultId,
    title: summary.title,
    kind: summary.kind,
    marks,
    quality: exam === "jee-advanced" || !sameExamMock ? "rough" : "estimate",
    notes,
  };
}

/** "Average of my last 3 full mocks" — uses fewer when fewer exist, and says so (T3.10). */
export function averageOfLastMocks(summaries: readonly AttemptSummary[], exam: RankPredictorExam, count = 3): AttemptFill | null {
  const mocks = summaries
    .filter((s) => s.kind === "full_mock" && s.examPreset === exam)
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
    .slice(0, count);
  if (!mocks.length) return null;
  const fills = mocks.map((m) => fillFromAttempt(m, exam));
  const marks: Record<string, FilledBox> = {};
  for (const box of EXAM_SUBJECTS[exam]) {
    const values = fills.map((f) => f.marks[box.id]?.value).filter((v): v is number => typeof v === "number");
    if (!values.length) continue;
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    marks[box.id] = { value: avg, how: exam === "jee-advanced" ? "scaled" : "mock", note: `Average of ${values.length} mock${values.length === 1 ? "" : "s"}` };
  }
  const notes: string[] = [];
  notes.push(
    mocks.length < count
      ? `Average of your last ${mocks.length} full mock${mocks.length === 1 ? "" : "s"} (you have only ${mocks.length}).`
      : `Average of your last ${count} full mocks.`,
  );
  if (exam === "jee-advanced") notes.push(fills[0].notes[0]);
  return {
    exam,
    resultId: null,
    title: `Average of last ${mocks.length} mock${mocks.length === 1 ? "" : "s"}`,
    kind: "full_mock",
    marks,
    quality: exam === "jee-advanced" ? "rough" : "estimate",
    notes,
  };
}
