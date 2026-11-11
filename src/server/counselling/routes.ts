import "server-only";

/**
 * /api/assessments/counselling/* — the college finder (plan §7.3), branched
 * from the assessments catch-all (no new route file: the Next 16
 * new-route-404 rule).
 *
 *   GET  meta?exam=jee|neet   bodies, years, rounds, filter options, data dates
 *   POST search               one page (≤ 50) of Safe / Likely / Reach seats
 *
 * Signed-in only; any role (any self-registered account, plan Q9); no daily
 * cap, only the shared per-user burst limiter (Q15). 404 while the
 * collegeCounselling flag is off. Category, PwD, gender and home state are
 * used for this one answer and never stored or logged (plan §12.1).
 */

import { checkRateLimit, generalLimiter } from "@/lib/rate-limit";
import { MAX_BODY_BYTES, validateSearchInput } from "@/lib/counselling/validate";
import { resolveTokenToUser } from "@/server/auth";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { isFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { badRequest, json, notFound, ok, serviceUnavailable, unauthorized } from "@/server/http";

import { getCounsellingMeta, searchCounselling } from "./service";

const NO_STORE = { "Cache-Control": "private, no-store" };

type Gate = { userId: string } | Response;

async function gate(request: Request): Promise<Gate> {
  if (!(await isFeatureEnabledRuntime("collegeCounselling"))) {
    return json({ code: "feature_off", detail: "Not found." }, { status: 404 });
  }
  let user;
  try {
    user = await resolveTokenToUser(request);
  } catch (error) {
    if (isAuthServiceUnavailableError(error)) return serviceUnavailable(error.message);
    throw error;
  }
  if (!user) return unauthorized();
  const limited = await checkRateLimit(generalLimiter, user.id);
  if (limited) return limited;
  return { userId: user.id };
}

export async function handleCounsellingGet(request: Request, slug: string[]): Promise<Response> {
  const g = await gate(request);
  if (g instanceof Response) return g;
  const [, action, extra] = slug;
  if (action !== "meta" || extra) return notFound();
  const exam = new URL(request.url).searchParams.get("exam");
  if (exam !== "jee" && exam !== "neet") return badRequest("Pick JEE or NEET.", { field: "exam" });
  try {
    return ok(await getCounsellingMeta(exam), { headers: NO_STORE });
  } catch (error) {
    console.error("[counselling] meta failed", error instanceof Error ? error.message : "unknown");
    return serviceUnavailable("Could not load the college data. Please try again.");
  }
}

export async function handleCounsellingPost(request: Request, slug: string[]): Promise<Response> {
  const g = await gate(request);
  if (g instanceof Response) return g;
  const [, action, extra] = slug;
  if (action !== "search" || extra) return notFound();

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ detail: "Request too large." }, { status: 413 });
  let raw: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ detail: "Request too large." }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return badRequest("Send a JSON body.", { field: "body" });
  }
  const parsed = validateSearchInput(raw);
  if (!parsed.ok) return badRequest(parsed.error.message, { field: parsed.error.field });

  try {
    return ok(await searchCounselling(parsed.value), { headers: NO_STORE });
  } catch (error) {
    // Never log the request: it holds category / PwD / gender / home state.
    console.error("[counselling] search failed", error instanceof Error ? error.message : "unknown");
    return serviceUnavailable("Could not search the college data. Please try again.");
  }
}
