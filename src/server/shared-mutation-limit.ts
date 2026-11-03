/**
 * The shared per-user mutation budget (`u:<userId>` on `mutationLimiter`) for
 * the student app surfaces, charged in the Node route handler instead of the
 * Edge middleware.
 *
 * The middleware runs in bom1 (Mumbai) and Upstash sits next to iad1, so
 * charging the budget there cost every app write one Mumbai → US round trip
 * before the request even left the edge. The route handlers run in iad1, a few
 * ms from Redis. Same limiter, same identifier, same incident mode (lockdown
 * included, via checkRateLimit) — only where the check runs changed.
 *
 * Each catch-all handler under these prefixes calls
 * `checkSharedMutationLimit` once per request, before it dispatches. Their own
 * narrower budgets (`push-token:`, `linkout:`, `now-*:`, `notes:`) are separate
 * keys and stay as they are.
 */

import { checkRateLimit, mutationLimiter } from "@/lib/rate-limit";
import { getApiRoutePolicy, normalizePathname } from "@/server/route-policy";

/** Prefixes the middleware leaves to the route handlers (and must therefore
 * NOT charge again). */
export const HANDLER_LIMITED_MUTATION_PREFIXES = ["/api/mobile/", "/api/notes/", "/api/now/"] as const;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isHandlerLimitedMutationPath(pathname: string): boolean {
  return HANDLER_LIMITED_MUTATION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Charges one hit to `u:<userId>` for a write on an authenticated path, and
 * returns the 429 to send back when the budget (or lockdown) refuses it.
 *
 * Skipped, exactly as the middleware skipped them: reads, and the public
 * sub-paths (/api/mobile/auth/*, /api/mobile/link-out/consume,
 * /api/now/consent/confirm ...) — those have their own limiters, and on them
 * an `x-origin-user-id` header is whatever the client sent.
 */
export async function checkSharedMutationLimit(request: Request, userId: string | null | undefined): Promise<Response | null> {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null;
  if (!userId) return null;
  const policy = getApiRoutePolicy(normalizePathname(new URL(request.url).pathname));
  if (policy.kind === "public" || policy.kind === "internal" || policy.kind === "unconfigured") return null;
  return checkRateLimit(mutationLimiter, `u:${userId}`);
}
