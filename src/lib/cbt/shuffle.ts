/**
 * Deterministic, per-participant question shuffling for CBT tests.
 *
 * Design notes (why it looks like this):
 *
 *  - **Key-sort, not Fisher-Yates.** Each question is assigned a sort key
 *    derived from SHA-256(participantId : testId : questionId) and the list is
 *    sorted by that key. A uniform hash yields a uniform permutation, so the
 *    result is unbiased, but — unlike an index-seeded Fisher-Yates — adding or
 *    removing a question leaves the relative order of every other question
 *    intact. A teacher editing a test mid-run therefore cannot reshuffle a
 *    paper under a student who is already attempting it.
 *
 *  - **No secret, no stored state.** The permutation is not a secret: the
 *    student can see their own order regardless. Deriving it from stable ids
 *    means it survives refresh, cross-device resume, and reconnects with no
 *    extra column and no key-rotation failure mode.
 *
 *  - **Canonical positions are never touched.** Callers reorder the delivered
 *    array only; every question keeps its authored `position`, which is what
 *    drafts, submissions, and grading are keyed by.
 */

import { createHash } from "node:crypto";

/** Anything carrying a stable question id and its canonical position. */
export type ShufflableQuestion = {
  questionId: string;
  position: number;
};

/**
 * 128 bits of SHA-256 as a lowercase hex string. Compared lexicographically,
 * which is order-equivalent to comparing the underlying big integers because
 * every key is the same fixed width.
 */
function sortKey(participantId: string, testId: string, questionId: string): string {
  return createHash("sha256")
    .update(`${participantId}:${testId}:${questionId}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}

/**
 * Returns a new array holding the same questions in a per-participant random
 * order. Deterministic for a given (participantId, testId) pair.
 *
 * Ties on the hash key (practically impossible at 128 bits) fall back to
 * canonical position so the result is always a total order.
 */
export function shuffleQuestionsForParticipant<T extends ShufflableQuestion>(
  questions: T[],
  participantId: string,
  testId: string,
): T[] {
  if (questions.length < 2) return [...questions];

  return questions
    .map((question) => ({ question, key: sortKey(participantId, testId, question.questionId) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.question.position - b.question.position))
    .map((entry) => entry.question);
}
