import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type AppRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type AppRateLimiter = {
  limit(identifier: string): Promise<AppRateLimitResult>;
};

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

function createNoopLimiter(limit: number): AppRateLimiter {
  if (process.env.NODE_ENV !== "production" && !hasWarnedMissingRedis) {
    hasWarnedMissingRedis = true;
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are not set. Using a no-op limiter in local development.",
    );
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

function createLimiter(limit: number, prefix: string): AppRateLimiter {
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      return {
        async limit() {
          throw new Error(
            "[rate-limit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production.",
          );
        },
      };
    }

    return createNoopLimiter(limit);
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, "60 s"),
    prefix,
  });
}

export const authLimiter = createLimiter(5, "rl:auth");

export const aiLimiter = createLimiter(10, "rl:ai");

export const voiceLimiter = createLimiter(5, "rl:voice");

export const submitLimiter = createLimiter(20, "rl:submit");

export const generalLimiter = createLimiter(60, "rl:general");

export async function checkRateLimit(
  limiter: AppRateLimiter,
  identifier: string
): Promise<Response | null> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  if (!success) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }
  return null;
}
