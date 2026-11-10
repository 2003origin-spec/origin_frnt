/**
 * Mark boxes per exam (plan §4.1). Mirrors `subjects` in the data files — a
 * unit test pins them equal — so the browser can validate without the data.
 */

import type { RankPredictorExam } from "./types";

export type SubjectBox = {
  id: string;
  label: string;
  min: number;
  max: number;
  /** Questions in the real paper (upper bound for "wrong answers"). Null = not asked. */
  questions: number | null;
};

export const EXAM_SUBJECTS: Readonly<Record<RankPredictorExam, readonly SubjectBox[]>> = Object.freeze({
  neet: [
    { id: "physics", label: "Physics", min: -45, max: 180, questions: 45 },
    { id: "chemistry", label: "Chemistry", min: -45, max: 180, questions: 45 },
    { id: "biology", label: "Biology", min: -90, max: 360, questions: 90 },
  ],
  "jee-main": [
    { id: "maths", label: "Maths", min: -25, max: 100, questions: 25 },
    { id: "physics", label: "Physics", min: -25, max: 100, questions: 25 },
    { id: "chemistry", label: "Chemistry", min: -25, max: 100, questions: 25 },
  ],
  // The real exam is two papers, 120 marks per subject. The lowest score depends
  // on the year's pattern (data has no fixed minimum), so allow -60 per subject.
  "jee-advanced": [
    { id: "maths", label: "Maths", min: -60, max: 120, questions: null },
    { id: "physics", label: "Physics", min: -60, max: 120, questions: null },
    { id: "chemistry", label: "Chemistry", min: -60, max: 120, questions: null },
  ],
});

export const EXAM_MAX_MARKS: Readonly<Record<RankPredictorExam, number>> = Object.freeze({
  neet: 720,
  "jee-main": 300,
  "jee-advanced": 360,
});
