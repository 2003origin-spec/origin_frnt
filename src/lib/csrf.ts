/**
 * Browser-side CSRF helpers.
 *
 * The middleware enforces a double-submit CSRF check on every mutating
 * /api/* request: the `origin_csrf` cookie must equal the
 * `x-csrf-token` header. Client components that hit the API with bare
 * `fetch()` would silently fail with 403 "Invalid CSRF token." until
 * this helper was added.
 */

import { attemptTokenRefresh } from "@/lib/api";

const CSRF_COOKIE_NAME = "origin_csrf";

export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  for (const cookie of document.cookie.split("; ")) {
    const [name, ...rest] = cookie.split("=");
    if (name === CSRF_COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Returns headers to merge into a mutating fetch() call. */
export function csrfHeaders(): Record<string, string> {
  const csrf = readCsrfCookie();
  return csrf ? { "x-csrf-token": csrf } : {};
}

/**
 * A mutating fetch that self-heals an expired session.
 *
 * The `origin_csrf` cookie shares the access token's short (10-minute) TTL, so a
 * mutation fired from a long-lived client surface — e.g. an editor dialog left
 * open, or a page sat on past the access-token lifetime — can reach the server
 * after the cookie has lapsed and fail the middleware's double-submit CSRF check
 * with 403 "Invalid CSRF token." Bare `fetch()` + `csrfHeaders()` has no way to
 * recover: it just sends an empty CSRF header.
 *
 * This wrapper ensures a token before sending (refreshing the session — which
 * re-issues both the access and CSRF cookies — when the cookie is gone) and, if
 * the request still comes back 401/403, refreshes once and retries. It returns
 * the raw Response so callers keep their existing res.ok / res.json() handling.
 * `credentials` and the CSRF header are always set by this helper; callers pass
 * only `method`, `body`, and any extra headers. FormData bodies are left without
 * a forced content-type so the browser can set the multipart boundary.
 */
export async function mutateJson(url: string, init: RequestInit = {}): Promise<Response> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const build = (): RequestInit => {
    const headers = new Headers(init.headers);
    if (!isForm && !headers.has("content-type")) headers.set("content-type", "application/json");
    const csrf = readCsrfCookie();
    if (csrf) headers.set("x-csrf-token", csrf);
    return { ...init, headers, credentials: "include" };
  };
  if (!readCsrfCookie()) await attemptTokenRefresh();
  let res = await fetch(url, build());
  if ((res.status === 401 || res.status === 403) && (await attemptTokenRefresh()) === "ok") {
    res = await fetch(url, build());
  }
  return res;
}
