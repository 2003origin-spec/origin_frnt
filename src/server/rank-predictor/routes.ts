import "server-only";

/**
 * GET /api/assessments/rank-predictor/* — the signed-in "Fill from my tests"
 * reads (plan §7.2), branched from the assessments catch-all (no new route
 * file: the Next 16 new-route-404 rule).
 *
 *   attempts?exam=neet          → the caller's attempts that can fill this exam
 *   attempt/:resultId[?exam=…]  → that attempt mapped to the mark boxes (owner only; else 404)
 *   average?exam=neet           → average of the last ≤ 3 full mocks
 *
 * Student role only (teachers/admins 403). The prediction itself always goes
 * through POST /api/public/rank-predictor.
 */

import { isExamPresetId } from "@/lib/exam-blueprints";
import { checkRateLimit, generalLimiter } from "@/lib/rate-limit";
import type { RankPredictorExam } from "@/lib/rank-predictor/types";
import { resolveTokenToUser } from "@/server/auth";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { isFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { badRequest, forbidden, json, notFound, ok, serviceUnavailable, unauthorized } from "@/server/http";

import {
  getRankPredictorAttemptFill,
  getRankPredictorAverageFill,
  listRankPredictorAttempts,
} from "./predictor-service";

const RESULT_ID = /^[A-Za-z0-9_-]{1,80}$/;
const NO_STORE = { "Cache-Control": "private, no-store" };

function readExam(request: Request): RankPredictorExam | null | "invalid" {
  const raw = new URL(request.url).searchParams.get("exam");
  if (raw === null || raw === "") return null;
  return isExamPresetId(raw) ? raw : "invalid";
}

export async function handleRankPredictorGet(request: Request, slug: string[]): Promise<Response> {
  if (!(await isFeatureEnabledRuntime("rankPredictor"))) {
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
  if (user.role !== "student") return forbidden("Only students can fill the Rank Predictor from their tests.");

  const limited = await checkRateLimit(generalLimiter, user.id);
  if (limited) return limited;

  const [, action, id, extra] = slug;
  const exam = readExam(request);
  if (exam === "invalid") return badRequest("Unknown exam.", { field: "exam" });

  try {
    if (action === "attempts" && !id) {
      if (!exam) return badRequest("Pick an exam.", { field: "exam" });
      return ok(await listRankPredictorAttempts(user.id, exam), { headers: NO_STORE });
    }
    if (action === "average" && !id) {
      if (!exam) return badRequest("Pick an exam.", { field: "exam" });
      const fill = await getRankPredictorAverageFill(user.id, exam);
      return fill ? ok(fill, { headers: NO_STORE }) : notFound("No full-length mocks for this exam yet.");
    }
    if (action === "attempt" && id && !extra) {
      if (!RESULT_ID.test(id)) return notFound();
      const fill = await getRankPredictorAttemptFill(user.id, id, exam);
      return fill ? ok(fill, { headers: NO_STORE }) : notFound();
    }
  } catch (error) {
    console.error("[rank-predictor] attempts read failed", error instanceof Error ? error.message : "unknown");
    return serviceUnavailable("Could not load your tests. Please try again.");
  }
  return notFound();
}
