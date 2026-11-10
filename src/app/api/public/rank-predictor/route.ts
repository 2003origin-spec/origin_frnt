/**
 * /api/public/rank-predictor — the one prediction endpoint for the web page,
 * the landing widget (Stage 4) and the app (plan §7.1).
 *
 *   POST  run a prediction. Signed in: unlimited (60/min burst). Logged out:
 *         2 distinct checks per IST day per device (plan §8.3), then 429
 *         `login_required`.
 *   GET   how many free checks this device has left today (never uses one).
 *
 * Public at the edge (PUBLIC_API_PATHS) and CSRF-exempt like every
 * /api/public/* route: a visitor has no session or CSRF cookie. The only state
 * a POST changes is the visitor's own counter. The handler verifies the access
 * JWT itself (cookie or bearer, plus the token-version check) and never trusts
 * a client header such as x-origin-user-id (plan §8.2).
 *
 * Privacy (plan §12.1): marks, category, PwD, gender and home state are used
 * for this calculation only — never stored and never logged. The raw IP is
 * only ever used inside an HMAC (src/server/rank-predictor/public-limit.ts).
 */

import type { NextRequest } from "next/server";

import { isWithinLimit, rankPredictorAnonLimiter, rankPredictorLimiter, rankPredictorStatusLimiter } from "@/lib/rate-limit";
import { MAX_BODY_BYTES, validatePredictRequest } from "@/lib/rank-predictor/validate";
import type { Access, PredictInput } from "@/lib/rank-predictor/types";
import { extractRefreshTokenCookie, resolveTokenToUser } from "@/server/auth";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { isFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { json } from "@/server/http";
import { rankPredictorShiftIds, runPrediction, whatIfBands } from "@/server/rank-predictor/predictor-service";
import {
  chargeFreeCheck,
  clientIp,
  deviceCookieHeader,
  deviceIdFromRequest,
  FREE_CHECKS_PER_DAY,
  freeCheckStore,
  hashInput,
  hashIp,
  istDay,
  limitKey,
  newDeviceId,
  nowMs,
  remainingFreeChecks,
  signDeviceId,
} from "@/server/rank-predictor/public-limit";

const NO_STORE = { "Cache-Control": "no-store" };

/** Sent by the page after a failed token refresh: "count me as a visitor". */
const ANONYMOUS_HEADER = "x-rp-anonymous";

const SIGNED_IN: Access = { signedIn: true, remainingToday: null, limit: null };
const visitor = (remainingToday: number): Access => ({ signedIn: false, remainingToday, limit: FREE_CHECKS_PER_DAY });

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

function reply(status: number, body: Record<string, unknown>, setCookie?: string | null) {
  const res = json(body, { status, headers: status === 429 ? { ...NO_STORE, "Retry-After": "60" } : NO_STORE });
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}

type Identity = { kind: "user"; userId: string } | { kind: "visitor" };

const REFRESH = { code: "session_refresh", detail: "Your session needs a refresh." };

/**
 * Flag check + who is calling, shared by GET and POST (a Response ends the
 * request). A valid access JWT (cookie or bearer) → user. No valid access token
 * but a refresh cookie → 401 `session_refresh`: the page refreshes and retries,
 * so a logged-in user never uses up a free check (plan §8.2). Anything else, a
 * forged token included, is a visitor.
 */
async function gate(request: Request): Promise<Identity | Response> {
  if (!(await isFeatureEnabledRuntime("rankPredictor"))) {
    return reply(404, { code: "feature_off", detail: "Not found." });
  }
  let user;
  try {
    user = await resolveTokenToUser(request);
  } catch (err) {
    if (isAuthServiceUnavailableError(err)) return reply(503, { detail: err.message });
    throw err;
  }
  if (user) return { kind: "user", userId: user.id };
  if (extractRefreshTokenCookie(request) && request.headers.get(ANONYMOUS_HEADER) !== "1") return reply(401, REFRESH);
  return { kind: "visitor" };
}

type Parsed = { error: Response } | { input: PredictInput; honeypot: boolean };

async function parseBody(request: Request): Promise<Parsed> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { error: reply(400, { detail: "Request is too large.", field: "body" }) };
  const text = await readBodyCapped(request, MAX_BODY_BYTES);
  if (text === null) return { error: reply(400, { detail: "Request is too large.", field: "body" }) };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: reply(400, { detail: "Send a JSON object.", field: "body" }) };
  }
  const checked = validatePredictRequest(body, rankPredictorShiftIds());
  if (!checked.ok) return { error: reply(400, { detail: checked.message, field: checked.field }) };
  const { hp, ...input } = checked.value;
  return { input: input as PredictInput, honeypot: Boolean(hp) };
}

function predictionBody(input: PredictInput, access: Access) {
  return { ...runPrediction(input), whatIf: whatIfBands(input), access };
}

/** A filled honeypot: shaped like an answer, with no ranks in it (plan §8.3). */
function decoyBody(input: PredictInput, access: Access) {
  const real = runPrediction(input);
  return {
    ...real,
    // The spread and notes text carry per-year ranks too, so they go as well.
    prediction: { ...real.prediction, air: null, percentile: null, categoryRank: null, pwdRank: null, stateRank: null, topText: null, eligibility: null, qualifying: null, spread: [], notes: [] },
    whatIf: [],
    access,
  };
}

const SLOW_DOWN = { code: "slow_down", detail: "Too many checks in a minute. Wait a moment and try again." };

export async function POST(request: NextRequest) {
  const who = await gate(request);
  if (who instanceof Response) return who;

  if (who.kind === "user") {
    if (!(await isWithinLimit(rankPredictorLimiter, who.userId))) return reply(429, SLOW_DOWN);
    const parsed = await parseBody(request);
    if ("error" in parsed) return parsed.error;
    return reply(200, predictionBody(parsed.input, SIGNED_IN));
  }

  // Logged-out visitor: device cookie + hashed IP (plan §8.3).
  const key = limitKey();
  let deviceId = deviceIdFromRequest(request, key);
  let setCookie: string | null = null;
  if (!deviceId) {
    deviceId = newDeviceId();
    setCookie = deviceCookieHeader(signDeviceId(deviceId, key), { secure: process.env.NODE_ENV === "production" });
  }
  const ipHash = hashIp(clientIp(request), key);

  if (!(await isWithinLimit(rankPredictorAnonLimiter, `${deviceId}:${ipHash}`))) return reply(429, SLOW_DOWN, setCookie);

  const parsed = await parseBody(request);
  if ("error" in parsed) {
    if (setCookie) parsed.error.headers.append("Set-Cookie", setCookie);
    return parsed.error;
  }

  const decision = await chargeFreeCheck(freeCheckStore(), {
    day: istDay(nowMs()),
    deviceId,
    ipHash,
    inputHash: hashInput(parsed.input, key),
  });
  if (!decision.allowed) {
    return reply(
      429,
      {
        code: "login_required",
        detail: "You have used today's free checks. Log in for unlimited checks.",
        access: visitor(0),
      },
      setCookie,
    );
  }
  const access = visitor(decision.remaining);
  return reply(200, parsed.honeypot ? decoyBody(parsed.input, access) : predictionBody(parsed.input, access), setCookie);
}

export async function GET(request: NextRequest) {
  const who = await gate(request);
  if (who instanceof Response) return who;
  if (who.kind === "user") return reply(200, { access: SIGNED_IN });

  const key = limitKey();
  if (!(await isWithinLimit(rankPredictorStatusLimiter, hashIp(clientIp(request), key)))) return reply(429, SLOW_DOWN);
  const deviceId = deviceIdFromRequest(request, key);
  let remaining: number = FREE_CHECKS_PER_DAY;
  try {
    remaining = await remainingFreeChecks(freeCheckStore(), istDay(nowMs()), deviceId);
  } catch {
    // The store already fails open; a read that still throws shows the full allowance.
  }
  return reply(200, { access: visitor(remaining) });
}
