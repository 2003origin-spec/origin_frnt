/**
 * Where a successful login may send the user back to, from `/auth?next=…`.
 *
 * The login flows (AuthContext, /auth page) send everyone to their role home.
 * A few public pages ask the visitor to log in and want them back afterwards
 * (the Rank Predictor login prompt, V1/PERCENTILE_PREDICTOR_PLAN.md §8.4), so
 * only `next` values on this allow-list are honoured — any other `next` keeps
 * today's behaviour. Validated with safeNext (no open redirect).
 */

import { safeNext } from "./safe-next";
import { EXAM_PAGE_LIST } from "./seo/rank-predictor-seo";

/** The predictor, its exam pages (/rank-predictor/neet …) and the college finder. */
const LOGIN_RETURN_PATHS: readonly string[] = ["/rank-predictor", ...EXAM_PAGE_LIST.map((page) => page.path), "/rank-predictor/colleges"];

/** The allowed return path from a raw `next` value, or null. */
export function loginReturnPath(rawNext: string | null | undefined): string | null {
  const next = safeNext(rawNext, "");
  if (!next) return null;
  const path = next.split(/[?#]/u)[0];
  return LOGIN_RETURN_PATHS.includes(path) ? path : null;
}

/** Same, read from the current page's `?next=` (browser only). */
function loginReturnPathFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return loginReturnPath(new URLSearchParams(window.location.search).get("next"));
}

/**
 * Where to go after a successful login (onboarding is decided by the caller):
 * admins to /admin; others to an allowed `?next=` page, else their home.
 */
export function homeAfterLogin(role: string | null | undefined): string {
  if (role === "admin") return "/admin";
  return loginReturnPathFromLocation() ?? (role === "teacher" ? "/teacher" : "/dashboard");
}
