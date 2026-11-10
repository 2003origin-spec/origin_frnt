/**
 * POST /api/public/rank-predictor — the one prediction endpoint for the web
 * page, the landing widget (Stage 4) and the app (plan §7.1).
 *
 * Public at the edge (PUBLIC_API_PATHS), so the middleware attaches no user:
 * the handler verifies the access JWT itself (cookie or bearer, plus the token
 * version check) and never trusts a client header (plan §8.2).
 *
 * Stage 2: signed-in only — no valid session answers 401. Stage 3 replaces the
 * 401 branch with the logged-out 2-per-day limit.
 *
 * Privacy (plan §12.1): marks, category, PwD, gender and home state are used
 * for this calculation only — never stored and never logged.
 */

import type { NextRequest } from "next/server";

import { checkRateLimit, rankPredictorLimiter } from "@/lib/rate-limit";
import { MAX_BODY_BYTES, validatePredictRequest } from "@/lib/rank-predictor/validate";
import { resolveTokenToUser } from "@/server/auth";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { isFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { json } from "@/server/http";
import { rankPredictorShiftIds, runPrediction } from "@/server/rank-predictor/predictor-service";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Read at most `max` bytes. Content-Length can be absent (chunked upload), so
 * the stream itself is capped: a bigger body is cancelled, never buffered.
 */
async function readBodyCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function error(status: number, body: Record<string, unknown>) {
  return json(body, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  if (!(await isFeatureEnabledRuntime("rankPredictor"))) {
    return error(404, { code: "feature_off", detail: "Not found." });
  }

  let user;
  try {
    user = await resolveTokenToUser(request);
  } catch (err) {
    if (isAuthServiceUnavailableError(err)) return error(503, { detail: err.message });
    throw err;
  }
  if (!user) {
    return error(401, { code: "login_required", detail: "Log in to use the Rank Predictor." });
  }

  const limited = await checkRateLimit(rankPredictorLimiter, user.id, { honorIncidentMode: false });
  if (limited) return limited;

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return error(400, { detail: "Request is too large.", field: "body" });
  }
  const text = await readBodyCapped(request, MAX_BODY_BYTES);
  if (text === null) {
    return error(400, { detail: "Request is too large.", field: "body" });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, { detail: "Send a JSON object.", field: "body" });
  }

  const checked = validatePredictRequest(body, rankPredictorShiftIds());
  if (!checked.ok) {
    return error(400, { detail: checked.message, field: checked.field });
  }
  // The honeypot only matters for logged-out visitors (Stage 3); drop it here.
  const { hp: _hp, ...input } = checked.value;
  void _hp;

  const result = runPrediction(input);
  return json(
    { ...result, access: { signedIn: true, remainingToday: null, limit: null } },
    { status: 200, headers: NO_STORE },
  );
}
