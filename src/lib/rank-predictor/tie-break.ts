/**
 * Official tie-break order as a short note (plan §4.5). Per-subject marks barely
 * move the predicted rank, so we say how ties break instead of pretending to be
 * precise. Order from the 2026 NTA bulletins / JEE (Advanced) brochure.
 */

import type { RankPredictorExam } from "./types";

const NOTES: Record<RankPredictorExam, string> = {
  neet: "Ties: if two students have the same total, higher Biology marks rank first, then Chemistry, then Physics.",
  "jee-main": "Ties: if two students have the same NTA score, the higher Maths score ranks first, then Physics, then Chemistry.",
  "jee-advanced": "Ties: if two students have the same total, higher positive marks rank first, then Maths, then Physics.",
};

export function tieBreakNote(exam: RankPredictorExam): string {
  return NOTES[exam];
}
