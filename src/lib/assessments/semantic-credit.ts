/**
 * Partial credit for subjective-text answers (bug-fix G4) — mirror of
 * `semantic_band` / `credit_awarded` in grader-service/app/engine.py.
 *
 * With the default text threshold of 0.82:
 *   score ≥ 0.82          ⇒ correct, full credit
 *   0.74 ≤ score < 0.82   ⇒ near_match, credit = 0.4 · score/threshold
 *   score < 0.74          ⇒ weak_match, credit 0 ⇒ incorrect_marks
 *
 * Binary modes (numeric / symbolic / range) never use this: a wrong answer is
 * credit 0, full stop — the old `weak_match ⇒ 0.15·ratio` leaked ~+0.18 marks
 * for every wrong symbolic answer.
 */

export type SemanticBand = "strong_match" | "accepted_match" | "near_match" | "weak_match";

export function semanticBand(score: number, threshold: number): SemanticBand {
  if (score >= threshold + 0.12) return "strong_match";
  if (score >= threshold) return "accepted_match";
  if (score >= threshold - 0.08) return "near_match";
  return "weak_match";
}

export function semanticCreditAwarded(score: number, threshold: number, isCorrect: boolean): number {
  if (isCorrect) return 1;
  if (score >= threshold - 0.08) {
    const normalized = threshold > 0 ? Math.min(1, score / threshold) : score;
    return Number((normalized * 0.4).toFixed(3));
  }
  return 0;
}
