/**
 * Client-safe CBT question model (types + the type list). Lives under lib/ (no
 * server imports) so both the server service and client components can import
 * it without pulling `pg`/server code into the browser bundle.
 */

export const CBT_QUESTION_TYPES = [
  "mcq",
  "msq",
  "numerical",
  "numerical_with_units",
  "symbolic_expression",
  "equation",
  "matrix_match",
  "subjective",
] as const;

export type CbtQuestionType = (typeof CBT_QUESTION_TYPES)[number];

export type CbtQuestionOption = { text: string };

export type CbtQuestionAnswer = {
  correctOption?: number | null;
  correctOptions?: number[] | null;
  answerText?: string | null;
  tolerance?: number | null;
  units?: string | null;
  matrixData?: Record<string, unknown> | null;
};

export type CbtQuestionSource = "manual" | "imported";

export type CbtQuestion = {
  id: string;
  teacherId: string;
  questionType: CbtQuestionType;
  stem: string;
  options: CbtQuestionOption[];
  answer: CbtQuestionAnswer;
  explanation: string | null;
  subject: string | null;
  chapter: string | null;
  concept: string | null;
  difficulty: string | null;
  source: CbtQuestionSource;
  importJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CbtQuestionInput = {
  questionType: string;
  stem: string;
  options?: unknown;
  answer?: unknown;
  explanation?: string | null;
  subject?: string | null;
  chapter?: string | null;
  concept?: string | null;
  difficulty?: string | null;
};
