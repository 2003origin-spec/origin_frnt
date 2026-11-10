/**
 * "+10 / +20 marks" what-if (plan §9.1). Pure, so the server answers both
 * chips in the same response as the prediction: a logged-out visitor never
 * uses up a free check by tapping a chip.
 */

import { EXAM_SUBJECTS } from "./subjects";
import type { RankBand, RankPredictorExam } from "./types";

export const WHAT_IF_DELTAS = [10, 20] as const;

export type WhatIfBand = {
  delta: number;
  /** Marks actually added (less than `delta` when the boxes are nearly full). */
  added: number;
  air: RankBand | null;
};

/** Add `delta` marks, filling the subjects with the most room first. */
export function addMarks(exam: RankPredictorExam, marks: Record<string, number>, delta: number): { marks: Record<string, number>; added: number } {
  const out = { ...marks };
  let left = delta;
  const boxes = [...EXAM_SUBJECTS[exam]].sort((a, b) => b.max - (out[b.id] ?? 0) - (a.max - (out[a.id] ?? 0)));
  for (const box of boxes) {
    if (left <= 0) break;
    const room = Math.max(0, box.max - (out[box.id] ?? 0));
    const add = Math.min(room, left);
    out[box.id] = (out[box.id] ?? 0) + add;
    left -= add;
  }
  return { marks: out, added: delta - left };
}
