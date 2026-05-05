import type { StoredQuestion, StoredUserAnswer } from "@/server/store";
import { getRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

type RemoteEvaluationRequest = {
  question: {
    id: string;
    subject: string | null;
    chapter: string | null;
    concept: string | null;
    question_type: string;
    answer_text: string | null;
    explanation: string | null;
    hint: string | null;
    tolerance: number | null;
    answer_spec?: unknown;
  };
  submitted_answer: {
    answer_text: string | null;
    selected_option: number | null;
    selected_options: number[];
    matrix_pairs: number[][];
    time_spent_seconds: number;
  };
  user_id: string | null;
  attempt_ref: string | null;
};

type RemoteEvaluationResponse = {
  is_correct: boolean;
  score: number;
  threshold: number;
  grading_mode: string;
  grading_method: string;
  semantic_band: string;
  credit_awarded: number;
  needs_review?: boolean;
  reason_codes?: string[];
  matched_terms?: string[];
  missing_terms?: string[];
  normalized_expected?: string | null;
  normalized_submitted?: string | null;
  correct_answer_text?: string | null;
  explanation?: string | null;
  hint?: string | null;
  trace_id?: string | null;
};

type GradeResult = {
  isCorrect: boolean;
  info: Record<string, unknown>;
};

function isGraderConfigured(): boolean {
  return Boolean(process.env.GRADER_SERVICE_URL);
}

function buildRequestPayload(question: StoredQuestion, answer: StoredUserAnswer, userId: string): RemoteEvaluationRequest {
  return {
    question: {
      id: question.id,
      subject: question.subject ?? null,
      chapter: question.chapter ?? null,
      concept: question.concept ?? null,
      question_type: question.questionType,
      answer_text: question.answerText ?? null,
      explanation: question.explanation ?? null,
      hint: question.hint ?? null,
      tolerance: question.tolerance ?? null,
      answer_spec: question.answerSpec ?? null,
    },
    submitted_answer: {
      answer_text: answer.answerText ?? null,
      selected_option: answer.selectedOption,
      selected_options: answer.selectedOptions ?? [],
      matrix_pairs: answer.matrixPairs ?? [],
      time_spent_seconds: answer.timeSpent,
    },
    user_id: userId,
    attempt_ref: null,
  };
}

function buildHeaders(requestId: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [REQUEST_ID_HEADER]: requestId,
  };
  if (process.env.GRADER_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GRADER_SERVICE_TOKEN}`;
  }
  return headers;
}

export async function gradePracticeAnswerWithService(
  question: StoredQuestion,
  answer: StoredUserAnswer,
  userId: string,
): Promise<GradeResult | null> {
  if (!isGraderConfigured()) {
    return null;
  }

  if (!process.env.GRADER_SERVICE_TOKEN) {
    throw new Error('[grader-client] GRADER_SERVICE_TOKEN must be set when GRADER_SERVICE_URL is configured');
  }

  if (question.questionType !== "subjective" && question.questionType !== "numerical") {
    return null;
  }

  const timeoutMs = Number(process.env.GRADER_SERVICE_TIMEOUT_MS ?? 4500);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = getRequestId();

  try {
    const response = await fetch(`${process.env.GRADER_SERVICE_URL}/v1/evaluate`, {
      method: "POST",
      headers: buildHeaders(requestId),
      body: JSON.stringify(buildRequestPayload(question, answer, userId)),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('[grader-client] Remote grader returned error status — falling back to local grading', {
        requestId,
        status: response.status,
        questionId: question.id,
      });
      return null;
    }

    const payload = (await response.json()) as RemoteEvaluationResponse;
    return {
      isCorrect: Boolean(payload.is_correct),
      info: {
        correctAnswerText: payload.correct_answer_text ?? question.answerText,
        correct_answer_text: payload.correct_answer_text ?? question.answerText,
        explanation: payload.explanation ?? question.explanation,
        hint: payload.hint ?? question.hint,
        semanticScore: Number((payload.score ?? 0).toFixed(3)),
        semantic_score: Number((payload.score ?? 0).toFixed(3)),
        semanticThreshold: Number((payload.threshold ?? 0).toFixed(3)),
        semantic_threshold: Number((payload.threshold ?? 0).toFixed(3)),
        semanticBand: payload.semantic_band ?? "weak_match",
        semantic_band: payload.semantic_band ?? "weak_match",
        creditAwarded: Number((payload.credit_awarded ?? 0).toFixed(3)),
        credit_awarded: Number((payload.credit_awarded ?? 0).toFixed(3)),
        matchMethod: payload.grading_method ?? "python_grader",
        match_method: payload.grading_method ?? "python_grader",
        matchedTerms: payload.matched_terms ?? [],
        matched_terms: payload.matched_terms ?? [],
        missingTerms: payload.missing_terms ?? [],
        missing_terms: payload.missing_terms ?? [],
        reasonCodes: payload.reason_codes ?? [],
        reason_codes: payload.reason_codes ?? [],
        needsReview: Boolean(payload.needs_review),
        needs_review: Boolean(payload.needs_review),
        gradingMode: payload.grading_mode ?? question.questionType,
        grading_mode: payload.grading_mode ?? question.questionType,
        gradingTraceId: payload.trace_id ?? null,
        grading_trace_id: payload.trace_id ?? null,
        normalizedExpected: payload.normalized_expected ?? null,
        normalized_expected: payload.normalized_expected ?? null,
        normalizedSubmitted: payload.normalized_submitted ?? null,
        normalized_submitted: payload.normalized_submitted ?? null,
        evaluationSource: "python_grader",
        evaluation_source: "python_grader",
      },
    };
  } catch (err) {
    console.error('[grader-client] Remote grader call failed — falling back to local grading', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      questionId: question.id,
    });
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
