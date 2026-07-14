/**
 * Client-safe CBT attempt model (types only). The sanitized question shape here
 * NEVER carries the answer, explanation, or matrix correct-pairs — those are
 * stripped server-side in getStudentTestPayload before the payload leaves the
 * server. Keep this file free of any correct-answer field.
 */

import type { CbtQuestionType } from "./question-model";

export type CbtPaletteStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked"
  | "answered_marked";

/** What a student submits for one question (mirrors StoredUserAnswer subset). */
export type CbtStudentAnswer = {
  answerText?: string | null;
  selectedOption?: number | null;
  selectedOptions?: number[] | null;
  matrixPairs?: number[][] | null;
};

/** A question as delivered to the student — no answer/explanation ever. */
export type CbtSanitizedQuestion = {
  position: number;
  questionId: string;
  questionType: CbtQuestionType;
  stem: string;
  /** Public diagram URL when the question has an attached image. */
  image: string | null;
  options: string[];
  marks: number;
  negativeMarks: number;
  subject: string | null;
  chapter: string | null;
  /** matrix_match display structure only (rows/columns); correct pairs removed. */
  matrixData?: Record<string, unknown>;
};

export type CbtTestSection = {
  subject: string;
  questions: CbtSanitizedQuestion[];
};

export type CbtTestPayload = {
  testId: string;
  title: string;
  startedAt: string;
  durationSeconds: number;
  totalQuestions: number;
  maxScore: number;
  sections: CbtTestSection[];
};

export type CbtDraftState = {
  answers: Record<number, CbtStudentAnswer>;
  palette: Record<number, CbtPaletteStatus>;
};

export function isAnswered(answer: CbtStudentAnswer | undefined): boolean {
  if (!answer) return false;
  if (typeof answer.answerText === "string" && answer.answerText.trim() !== "") return true;
  if (typeof answer.selectedOption === "number") return true;
  if (Array.isArray(answer.selectedOptions) && answer.selectedOptions.length > 0) return true;
  if (Array.isArray(answer.matrixPairs) && answer.matrixPairs.length > 0) return true;
  return false;
}
