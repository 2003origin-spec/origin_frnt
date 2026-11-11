/**
 * Typed GA4 events for the Rank Predictor, college finder and "Get the app"
 * (SEO_APP_DOWNLOAD_NOTES.md). Pure: no GA import, so it is unit-testable;
 * `trackEvent` in `src/lib/analytics.ts` wires it to `track()`.
 *
 * PRIVACY (owner rule, non-negotiable): never send marks, ranks, percentile,
 * category, PwD, gender or home state to GA. Only coarse values: exam name,
 * signed in yes/no, where on the site, which platform. Enforced three ways:
 *  1. the event map below only has coarse fields (compile time);
 *  2. every key must be in ALLOWED_PARAM_KEYS and none may look like a
 *     forbidden one (run time);
 *  3. values must be booleans or short lowercase tokens: no numbers at all,
 *     no free text (a state name or a rank cannot slip through as a value).
 * A bad event is dropped, never sent.
 */

export type AnalyticsExam = "neet" | "jee-main" | "jee-advanced";
export type CounsellingExamParam = "jee" | "neet";
/** Where a Rank Predictor action happened. */
export type PredictorPlacement = "page" | "landing";
export type AppPlatform = "android" | "ios" | "desktop";
export type AppPlacement = "landing_nav" | "landing_menu" | "landing_section" | "landing_pill" | "app_rail" | "app_more";
/** open_sheet = dialog opened, tab_* = tab switched, play_store = store opened, copy_link / share. */
export type AppDownloadClick = "play_store" | "open_sheet" | "tab_android" | "tab_ios" | "copy_link" | "share";
/** Strings, not booleans: GA4 event params are strings or numbers. */
export type YesNo = "yes" | "no";

export function yesNo(value: boolean): YesNo {
  return value ? "yes" : "no";
}

export type AnalyticsEventMap = {
  /** A prediction the user asked for (not the automatic re-run after login or from a mock result). */
  rank_predictor_submit: { exam: AnalyticsExam; signed_in: YesNo; placement: PredictorPlacement };
  rank_predictor_result: { exam: AnalyticsExam; signed_in: YesNo; placement: PredictorPlacement };
  rank_predictor_limit_reached: { exam: AnalyticsExam; placement: PredictorPlacement };
  /** "See full details" from the landing widget to /rank-predictor. */
  rank_predictor_details_click: { exam: AnalyticsExam; placement: PredictorPlacement };
  /** Sign-up / log-in clicks from the daily limit or the college finder teaser. */
  auth_cta_click: {
    action: "sign_up" | "log_in";
    source: "predictor_limit" | "predictor_page" | "college_teaser" | "predictor_colleges";
    placement?: PredictorPlacement;
  };
  college_finder_search: { exam: CounsellingExamParam };
  /** "See colleges for this rank" on a prediction result. */
  college_finder_handoff: { exam: AnalyticsExam; signed_in: YesNo };
  app_download_click: { platform: AppPlatform; placement: AppPlacement; action: AppDownloadClick };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;
export type AnalyticsParams = Record<string, string | boolean>;

export const ALLOWED_PARAM_KEYS: ReadonlySet<string> = new Set(["exam", "signed_in", "placement", "source", "action", "platform"]);

/**
 * Word pieces that must never appear in a param key (split on _ - . and
 * camelCase). Belt and braces next to the allow-list above.
 */
export const FORBIDDEN_KEY_PARTS: readonly string[] = [
  "mark",
  "marks",
  "score",
  "rank",
  "air",
  "crl",
  "percentile",
  "category",
  "caste",
  "pwd",
  "pwbd",
  "disability",
  "gender",
  "sex",
  "state",
  "domicile",
  "email",
  "name",
  "phone",
];

const VALUE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

export class UnsafeAnalyticsParamsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeAnalyticsParamsError";
  }
}

function keyParts(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Throws UnsafeAnalyticsParamsError unless every key and value is allowed. */
export function assertSafeAnalyticsParams(params: Record<string, unknown>): asserts params is AnalyticsParams {
  for (const [key, value] of Object.entries(params)) {
    const parts = keyParts(key);
    const bad = parts.find((p) => FORBIDDEN_KEY_PARTS.includes(p));
    if (bad) throw new UnsafeAnalyticsParamsError(`Analytics param "${key}" is not allowed (personal data: ${bad}).`);
    if (!ALLOWED_PARAM_KEYS.has(key)) throw new UnsafeAnalyticsParamsError(`Analytics param "${key}" is not on the allow-list.`);
    if (typeof value === "boolean") continue;
    if (typeof value !== "string" || !VALUE_PATTERN.test(value)) {
      throw new UnsafeAnalyticsParamsError(`Analytics param "${key}" must be a boolean or a short lowercase token.`);
    }
  }
}

export type AnalyticsSink = (event: string, params: AnalyticsParams) => void;

/**
 * Build a typed tracker over a sink. An unsafe event is dropped (never sent)
 * and reported to `onReject` (console in dev; tests assert on it).
 */
export function createEventTracker(sink: AnalyticsSink, onReject: (error: Error) => void = () => undefined) {
  return function trackEvent<E extends AnalyticsEventName>(event: E, params: AnalyticsEventMap[E]): void {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) if (value !== undefined) copy[key] = value;
    try {
      assertSafeAnalyticsParams(copy);
    } catch (error) {
      onReject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    sink(event, copy);
  };
}
