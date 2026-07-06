/**
 * Client-safe CBT test model (types only). Under lib/ so client components can
 * import it without pulling server code.
 */

import type { CbtQuestionType } from "./question-model";

export type CbtTestStatus = "draft" | "ready" | "archived";

export type CbtTest = {
  id: string;
  teacherId: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: CbtTestStatus;
  questionCount: number;
  maxScore: number;
  createdAt: string;
  updatedAt: string;
};

export type CbtTestQuestion = {
  position: number;
  questionId: string;
  marks: number;
  negativeMarks: number;
  questionType: CbtQuestionType;
  stem: string;
  subject: string | null;
};

export type CbtTestWithQuestions = CbtTest & {
  questions: CbtTestQuestion[];
};

export type CbtTestQuestionInput = {
  questionId: string;
  marks?: number;
  negativeMarks?: number;
};
