/**
 * Browser calls for the Rank Predictor page. All maths runs on the server
 * (POST /api/public/rank-predictor); this file only moves JSON.
 */

import { apiCall } from "@/lib/api";
import type { AttemptFill, AttemptSummary } from "@/lib/rank-predictor/attempt-mapping";
import type { Prediction, PredictInput, RankBand, RankPredictorExam } from "@/lib/rank-predictor/types";

export type PredictionResponse = {
  prediction: Prediction;
  sources: { publisher: string; url: string; official: boolean; fetchedOn: string }[];
  checkedOn: string;
  disclaimer: string;
  access: { signedIn: boolean; remainingToday: number | null; limit: number | null };
};

export type AttemptFillResponse = AttemptFill & { preview?: { air: RankBand | null; topText: string | null } | null };

/** A message a student can act on (network failures surface as "Failed to fetch"). */
export function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) return "Could not reach Origin. Check your internet and try again.";
  return error instanceof Error && error.message ? error.message : fallback;
}

export function requestPrediction(input: PredictInput): Promise<PredictionResponse> {
  return apiCall("/public/rank-predictor", { method: "POST", body: JSON.stringify(input) });
}

export function fetchAttempts(exam: RankPredictorExam): Promise<AttemptSummary[]> {
  return apiCall(`/assessments/rank-predictor/attempts?exam=${encodeURIComponent(exam)}`);
}

export function fetchAttemptFill(resultId: string, exam?: RankPredictorExam | null): Promise<AttemptFillResponse> {
  const query = exam ? `?exam=${encodeURIComponent(exam)}` : "";
  return apiCall(`/assessments/rank-predictor/attempt/${encodeURIComponent(resultId)}${query}`, { silentAuth: true });
}

export function fetchAverageFill(exam: RankPredictorExam): Promise<AttemptFill> {
  return apiCall(`/assessments/rank-predictor/average?exam=${encodeURIComponent(exam)}`);
}
