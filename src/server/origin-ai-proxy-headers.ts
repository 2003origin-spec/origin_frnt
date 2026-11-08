/**
 * Header allowlist for Next → origin-ai proxy calls.
 *
 * Only `FORWARDED_CLIENT_HEADERS` cross the proxy. Everything else the browser
 * or a native app sends (Authorization, Cookie, X-Forwarded-*, X-Origin-User-*)
 * stops here: Python authenticates the *service*, never the end user, and the
 * user identity it trusts is whatever Next resolved from the session (bug U3).
 *
 * Pure (no request/Next imports) so the allowlist can be unit-tested directly.
 */

import { studyModeSubjects, type StudyMode } from "@/lib/study-mode";
import { REQUEST_ID_HEADER } from "@/lib/request-id";
import type { StoredUser } from "@/server/store";

export const FORWARDED_CLIENT_HEADERS = ["x-origin-ai-session-id", "accept-language"] as const;

/** The minimum of a StoredUser the header set needs. */
export type ProxyHeaderUser = Pick<
  StoredUser,
  "id" | "name" | "email" | "role" | "streak" | "studentClass" | "selectedCourse"
>;

/**
 * Builds the header set for a Next → origin-ai call. The service bearer is set
 * LAST and unconditionally so nothing — not a forwarded client header, not an
 * `extra` entry — can override it.
 */
export function buildOriginAiServiceHeaders(
  incomingHeaders: Headers,
  user: ProxyHeaderUser,
  serviceToken: string,
  requestId: string,
  studyMode: StudyMode,
  extra: Record<string, string> = {},
): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    [REQUEST_ID_HEADER]: requestId,
    "X-Origin-User-Id": user.id,
    "X-Origin-User-Name": user.name || "",
    "X-Origin-User-Email": user.email || "",
    "X-Origin-User-Role": user.role || "student",
    "X-Origin-User-Streak": String(user.streak || 0),
    "X-Origin-User-Student-Class": user.studentClass ?? "",
    "X-Origin-User-Selected-Course": user.selectedCourse ?? "",
    // Study Mode — which subjects this student is actually working in, so
    // the model stops volunteering off-mode examples. Additive: the Python
    // service ignores unknown headers, so this is safe to ship ahead of it.
    "X-Origin-User-Study-Mode": studyMode,
    "X-Origin-User-Mode-Subjects": studyModeSubjects(studyMode).join(","),
    ...extra,
  });
  for (const name of FORWARDED_CLIENT_HEADERS) {
    const value = incomingHeaders.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Authorization", `Bearer ${serviceToken}`);
  return headers;
}
