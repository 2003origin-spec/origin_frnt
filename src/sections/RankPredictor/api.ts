/**
 * Browser calls for the Rank Predictor page. All maths runs on the server
 * (POST /api/public/rank-predictor); this file only moves JSON.
 *
 * The public endpoint is called with plain fetch, not apiCall: apiCall treats a
 * missing CSRF cookie on a POST as "session expired", which is every logged-out
 * visitor. The endpoint is CSRF-exempt (/api/public/*) and sets its own
 * HttpOnly device cookie.
 */

import { apiCall, attemptTokenRefresh, resolveApiBaseUrl } from "@/lib/api";
import type { AttemptFill, AttemptSummary } from "@/lib/rank-predictor/attempt-mapping";
import type { Access, Prediction, PredictInput, RankBand, RankPredictorExam } from "@/lib/rank-predictor/types";
import type { WhatIfBand } from "@/lib/rank-predictor/what-if";

export type { Access };

export type PredictionResponse = {
  prediction: Prediction;
  sources: { publisher: string; url: string; official: boolean; fetchedOn: string }[];
  checkedOn: string;
  disclaimer: string;
  whatIf: WhatIfBand[];
  access: Access;
};

export type AttemptFillResponse = AttemptFill & { preview?: { air: RankBand | null; topText: string | null } | null };

/** A failed call, with the server's machine-readable code (and `access` on a 429). */
export class PredictorError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly access: Access | null,
  ) {
    super(message);
    this.name = "PredictorError";
  }
}

/** A message a student can act on (network failures surface as "Failed to fetch"). */
export function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) return "Could not reach Origin. Check your internet and try again.";
  return error instanceof Error && error.message ? error.message : fallback;
}

const PUBLIC_PATH = "/public/rank-predictor";

function publicFetch(init: RequestInit & { anonymous?: boolean }): Promise<Response> {
  const { anonymous, ...rest } = init;
  return fetch(`${resolveApiBaseUrl(undefined, window.location.origin)}${PUBLIC_PATH}`, {
    ...rest,
    cache: "no-store",
    credentials: "include",
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(anonymous ? { "x-rp-anonymous": "1" } : {}),
    },
  });
}

async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * One call with the session dance (plan §8.2): a 401 `session_refresh` means
 * the access token expired but a refresh cookie exists, so refresh and retry.
 * If the refresh fails, retry as a visitor instead of looping.
 */
async function callPublic<T>(init: RequestInit): Promise<T> {
  let res = await publicFetch(init);
  let data = await bodyOf(res);
  if (res.status === 401 && data.code === "session_refresh") {
    const refreshed = await attemptTokenRefresh();
    // A network blip is not a logout: never count a signed-in user as a visitor for it.
    if (refreshed === "transient") throw new PredictorError("Could not reach Origin. Check your internet and try again.", null, null);
    res = await publicFetch({ ...init, anonymous: refreshed === "expired" });
    data = await bodyOf(res);
  }
  if (!res.ok) {
    throw new PredictorError(
      String(data.detail ?? "Something went wrong. Try again."),
      typeof data.code === "string" ? data.code : null,
      (data.access as Access | undefined) ?? null,
    );
  }
  return data as T;
}

export function requestPrediction(input: PredictInput): Promise<PredictionResponse> {
  return callPublic<PredictionResponse>({ method: "POST", body: JSON.stringify(input) });
}

/** Free checks left today for this device (never uses one). */
export async function fetchAccess(): Promise<Access> {
  return (await callPublic<{ access: Access }>({ method: "GET" })).access;
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
