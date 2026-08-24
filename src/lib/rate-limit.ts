import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { metric } from "@/lib/metrics";
import { getRateLimitMode, isLockdown, rateLimitDivisor, type RateLimitMode } from "@/server/incidents";

type AppRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type AppRateLimiter = {
  limit(identifier: string): Promise<AppRateLimitResult>;
};

type SlidingWindowDuration = Parameters<typeof Ratelimit.slidingWindow>[1];

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

let hasWarnedMissingRedis = false;

function isHostedProduction(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    Boolean(process.env.FLY_APP_NAME) ||
    process.env.ORIGIN_DEPLOYMENT_ENV === "production"
  );
}

function createNoopLimiter(limit: number): AppRateLimiter {
  if (isHostedProduction() && !hasWarnedMissingRedis) {
    hasWarnedMissingRedis = true;
    const message = "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are not set. Using degraded no-op limiter.";
    console.error(message);
    metric("origin.rate_limit.degraded", { reason: "missing_redis" });
  }

  return {
    async limit() {
      return {
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 60_000,
      };
    },
  };
}

function createLimiter(
  limit: number,
  prefix: string,
  window: SlidingWindowDuration = "60 s",
): AppRateLimiter {
  if (!redis) {
    return createNoopLimiter(limit);
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
  });
}

export const authLimiter = createLimiter(5, "rl:auth");

// Outbound-email + OTP abuse guards. Server Actions bypass middleware, so the
// email-send / OTP-verify actions self-limit per IP (and per email at the call
// site) using these. `emailSendLimiter` is deliberately over a long window —
// the threat is outbound-mail volume (SES/SMTP domain-reputation), not latency.
// OTP limits are split per-EMAIL vs per-IP. Many students share one public IP
// (school / coaching-centre / hostel NAT + CGNAT), so a per-IP cap of a handful
// blocks a whole class. The real abuse vector is spamming ONE address / brute-
// forcing ONE code, which the per-email limits guard; the per-IP limiters are a
// loose backstop against a single IP blasting thousands of different addresses.
export const emailSendLimiter = createLimiter(6, "rl:email-send", "10 m"); // per email
export const emailSendIpLimiter = createLimiter(60, "rl:email-send-ip", "10 m"); // per IP (classroom-friendly)
export const otpVerifyEmailLimiter = createLimiter(10, "rl:otp-verify-email", "10 m"); // per email (brute-force guard)
export const otpVerifyLimiter = createLimiter(100, "rl:otp-verify", "10 m"); // per IP (loose backstop)

// Token-refresh flood guard. Generous on purpose: a single client can burst
// refreshes across tabs, and CGNAT pools share one Vercel-resolved IP, so this
// only trips single-IP floods — it must never look like an expired session to a
// real user. Keyed by IP.
export const refreshLimiter = createLimiter(120, "rl:refresh", "60 s");

export const aiLimiter = createLimiter(10, "rl:ai");

export const voiceLimiter = createLimiter(5, "rl:voice");

export const submitLimiter = createLimiter(20, "rl:submit");

/** Shared per-user budget for read-only GET endpoints (assessments, study,
 * notifications, ...). One OGCode list mount fires ~9 GETs (5 facet levels +
 * questions + stats + chapters) and a practice loop (list → question → back)
 * burns ~15, so the old 60/min cap 429'd active students mid-practice.
 * Tunable via ORIGIN_GENERAL_RATE_LIMIT (default 240/min). */
const generalCap = (() => {
  const raw = process.env.ORIGIN_GENERAL_RATE_LIMIT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 240;
})();
export const generalLimiter = createLimiter(generalCap, "rl:general");

/** Catch-all limiter for teacher/admin/enrollment mutation endpoints
 * applied in middleware. Per-route limiters (auth, ai, voice, submit,
 * room*) take precedence — this is the floor that catches everything
 * else. Tunable via ORIGIN_MUTATION_RATE_LIMIT (default 60/min). */
const mutationCap = (() => {
  const raw = process.env.ORIGIN_MUTATION_RATE_LIMIT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
})();
export const mutationLimiter = createLimiter(mutationCap, "rl:mut");

export const roomCreateLimiter = createLimiter(10, "rl:room-create", "1 h");

export const roomCodeLimiter = createLimiter(6, "rl:room-code", "1 h");

export const roomJoinLimiter = createLimiter(30, "rl:room-join", "1 h");

export const roomChatLimiter = createLimiter(10, "rl:room-chat", "60 s");

// Study Mode switches (Server Action; keyed per user). Bounds DB churn and
// cache-key thrash from someone hammering the toggle — NOT an abuse guard:
// switching modes grants nothing (the daily challenge carries no bonus points,
// only ordinary OG Code scoring). Generous enough that no real student trips it.
export const studyModeLimiter = createLimiter(20, "rl:study-mode", "1 h");

// CBT surface limiters. OTP is checked in the CBT auth server actions (which
// bypass middleware); the rest are applied in-handler on the public student
// surface. Keyed per-email/per-ip/per-room/per-participant by the caller.
export const cbtOtpLimiter = createLimiter(5, "rl:cbt-otp", "15 m");

// CBT student surface (in-handler; keyed per ip+room / ip+code / participant).
// Join throughput, keyed by (ip, room slug). A computer lab shares one NAT IP,
// so this ceiling has to fit a whole room plus the rejoins that follow a crash
// — the previous 10/hour blocked the 11th student of the hour outright. Brute
// force is guarded by cbtJoinFailureLimiter below, which only counts *wrong*
// room codes, so the real secret stays as protected as it was.
export const cbtJoinLimiter = createLimiter(120, "rl:cbt-join", "10 m");
export const cbtJoinFailureLimiter = createLimiter(10, "rl:cbt-join-fail", "1 h");
// Identity recovery: reclaiming an idle attempt by name, and the probe that
// offers it. Bounded so names can't be enumerated cheaply.
export const cbtReclaimLimiter = createLimiter(20, "rl:cbt-reclaim", "15 m");
export const cbtResumeLimiter = createLimiter(10, "rl:cbt-resume", "15 m");
export const cbtAutosaveLimiter = createLimiter(60, "rl:cbt-autosave", "60 s");
export const cbtExportLimiter = createLimiter(6, "rl:cbt-export", "1 h");
// Report cards. The student's CBT ID is the credential, so the FAILURE limiter
// is the one that matters — it is what makes guessing a classmate's 6-character
// code impractical. The throughput limiter is generous because a whole class
// opening the same link shares one NAT IP, and each of them will legitimately
// re-open the page (print, share, come back later).
export const cbtReportUnlockLimiter = createLimiter(60, "rl:cbt-report", "15 m");
export const cbtReportFailureLimiter = createLimiter(10, "rl:cbt-report-fail", "1 h");

// ── Payments (V1/RAZORPAY_PAYMENTS_PLAN.md E12, E10) ─────────────────────────
// Applied in-handler on /api/payments/*, keyed per user and per IP.
//
// Checkout creates a real Razorpay order on every call, so the per-USER cap is
// the meaningful one — it bounds how much junk a single account can push into
// the Razorpay dashboard. The per-IP cap is deliberately looser for the same
// reason as the CBT limiters above: coaching centres, hostels and CGNAT put
// whole cohorts behind one address, and a tight IP cap would block the 11th
// student of the hour from paying. Idempotency (not rate limiting) is what
// stops a double-tap becoming a double charge.
export const paymentsCheckoutLimiter = createLimiter(10, "rl:pay-checkout", "60 s");
export const paymentsCheckoutIpLimiter = createLimiter(60, "rl:pay-checkout-ip", "10 m");

// Coupon validation is a code-guessing surface: a student who can probe it
// cheaply can enumerate other people's discount codes. Mirrors the CBT
// join/report split — a generous THROUGHPUT cap so legitimate typing and
// re-checks never trip, plus a tight FAILURE cap that only counts codes that
// did not resolve, which is what actually makes enumeration impractical.
export const paymentsCouponLimiter = createLimiter(30, "rl:pay-coupon", "10 m");
export const paymentsCouponFailureLimiter = createLimiter(12, "rl:pay-coupon-fail", "1 h");

// Client-side payment verification (the post-checkout fast path). Generous —
// it is signature-verified and idempotent, and a student legitimately retries
// it if the first call races the page unload.
export const paymentsVerifyLimiter = createLimiter(30, "rl:pay-verify", "60 s");

/**
 * Fail-open per-key check for Server Actions, which need a boolean rather than
 * the Response that `checkRateLimit` returns. Never throws: a limiter backend
 * error allows the request, matching `checkRateLimit`'s degraded mode — a brief
 * Upstash blip must not (e.g.) block token refresh and log users out. Returns
 * true when the request may proceed. Does not consult incident mode.
 */
export async function isWithinLimit(limiter: AppRateLimiter, identifier: string): Promise<boolean> {
  try {
    const { success } = await limiter.limit(identifier);
    return success;
  } catch (error) {
    console.error("[rate-limit] limiter backend failed; allowing request in degraded mode", error);
    metric("origin.rate_limit.degraded", { reason: "backend_error" });
    return true;
  }
}

export async function checkRateLimit(
  limiter: AppRateLimiter,
  identifier: string,
  options?: { honorIncidentMode?: boolean },
): Promise<Response | null> {
  let mode: RateLimitMode = "normal";
  if (options?.honorIncidentMode !== false) {
    try {
      mode = await getRateLimitMode();
    } catch (error) {
      console.error("[rate-limit] failed to read incident mode; defaulting to 'normal'", error);
    }
    if (isLockdown(mode)) {
      return new Response(
        JSON.stringify({
          error: "Mutations are temporarily disabled by an active incident.",
          mode,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
            "X-RateLimit-Mode": mode,
          },
        },
      );
    }
  }

  let result: AppRateLimitResult;
  try {
    result = await limiter.limit(identifier);
  } catch (error) {
    console.error("[rate-limit] limiter backend failed; allowing request in degraded mode", error);
    metric("origin.rate_limit.degraded", { reason: "backend_error" });
    return null;
  }

  const { success, limit, remaining, reset } = result;
  // Apply incident-mode divisor on top of the raw success — relaxed
  // doubles the budget, strict halves it. Implementation: convert to a
  // virtual "effective remaining" against an effective cap.
  const divisor = rateLimitDivisor(mode);
  const effectiveLimit = divisor === 1 ? limit : Math.max(1, Math.floor(limit / divisor));
  const used = limit - remaining;
  const effectiveRemaining = Math.max(0, effectiveLimit - used);
  const effectiveSuccess = success && effectiveRemaining > 0;

  if (!effectiveSuccess) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(effectiveLimit),
          "X-RateLimit-Remaining": String(effectiveRemaining),
          "X-RateLimit-Reset": String(reset),
          "X-RateLimit-Mode": mode,
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }
  return null;
}
