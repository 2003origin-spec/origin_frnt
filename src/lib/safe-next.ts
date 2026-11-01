/**
 * Shared validator for `next=` redirect targets (bug-fix spec 01-auth.md §A5).
 *
 * Edge-safe: no Node imports — the middleware runs on the Edge runtime and
 * imports this alongside `src/app/auth/refresh/route.ts`.
 *
 * The old local checks (`startsWith("/") && !startsWith("//")`) let
 * `/\evil.com` through: WHATWG URL treats `\` as `/` for http(s), so
 * `new URL("/\\evil.com", "https://www.o3origin.com")` is `https://evil.com/`.
 */

const DEFAULT_NEXT = "/dashboard";
const MAX_NEXT_LENGTH = 2048;
const SENTINEL_ORIGIN = "https://origin.invalid";

/** Same-origin paths that must never be a post-login landing page. */
const BLOCKED_PREFIXES = ["/api/", "/auth/refresh", "/_next/"] as const;

function hasBackslashOrControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0x5c || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Returns a same-origin, path-only `next` (normalised `pathname + search +
 * hash`) or `fallback`. Never a protocol-relative, backslash, absolute or
 * dot-segment URL, and never an API / refresh / build-asset path.
 */
export function safeNext(rawNext: string | null | undefined, fallback: string = DEFAULT_NEXT): string {
  if (typeof rawNext !== "string" || rawNext.length === 0 || rawNext.length > MAX_NEXT_LENGTH) return fallback;
  if (hasBackslashOrControlChar(rawNext)) return fallback;
  // Percent-encoded backslash: harmless to WHATWG URL, but some proxies and
  // older clients decode it before resolving — refuse it outright.
  if (/%5c/i.test(rawNext)) return fallback;
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return fallback;
  if (rawNext.includes("/..")) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(rawNext, SENTINEL_ORIGIN);
  } catch {
    return fallback;
  }
  if (parsed.origin !== SENTINEL_ORIGIN || !parsed.pathname.startsWith("/")) return fallback;

  const { pathname } = parsed;
  if (pathname.startsWith("//") || pathname.includes("/..")) return fallback;
  if (pathname === "/auth" || pathname === "/api" || pathname === "/_next") return fallback;
  if (BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return fallback;

  return `${pathname}${parsed.search}${parsed.hash}`;
}

/** True only when `value` is already a safe, normalised `next` target. */
export function isSafeAppNext(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && safeNext(value, "") === value;
}
