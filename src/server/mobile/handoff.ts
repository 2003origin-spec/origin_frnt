/**
 * One-time login-handoff tokens for the app → external-browser link-out
 * (ANDROID_HYBRID_APP_PLAN.md §5.4 / ledger #17).
 *
 * The app runs its session inside the WebView cookie jar; Chrome Custom Tabs
 * is a separate browser profile where the user is usually signed out. When
 * the app link-outs (e.g. "Get Premium on the web"), it first asks
 * POST /api/mobile/link-out for a handoff URL; opening that URL bootstraps
 * the SAME user's session in the external browser and redirects to the
 * purpose's page.
 *
 * Security properties: 32-byte random token, 60 s TTL, single-use
 * (atomic delete-on-read), bound to user + purpose server-side (the token
 * carries no user input; the redirect target comes from the purpose
 * allowlist below — no open-redirect surface). Rate-limited at issue time.
 *
 * Storage: Upstash Redis when configured (same env contract as
 * src/lib/rate-limit.ts). Dev fallback is an in-process Map with TTL — fine
 * for a single local server, and hosted production without Redis logs the
 * same degraded warning pattern as the rate limiter.
 */

import { randomBytes } from "node:crypto";

import { Redis } from "@upstash/redis";

const HANDOFF_TTL_SECONDS = 60;
const KEY_PREFIX = "mobile:handoff:";

/** Allowed link-out purposes → the app-internal path the browser lands on. */
export const HANDOFF_PURPOSES = {
  premium: "/premium",
} as const;

export type HandoffPurpose = keyof typeof HANDOFF_PURPOSES;

export function isHandoffPurpose(value: string): value is HandoffPurpose {
  return Object.prototype.hasOwnProperty.call(HANDOFF_PURPOSES, value);
}

type HandoffRecord = {
  userId: string;
  purpose: HandoffPurpose;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const memoryStore = new Map<string, { record: HandoffRecord; expiresAt: number }>();

function sweepMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

export async function issueHandoffToken(userId: string, purpose: HandoffPurpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const record: HandoffRecord = { userId, purpose };

  if (redis) {
    await redis.set(`${KEY_PREFIX}${token}`, JSON.stringify(record), { ex: HANDOFF_TTL_SECONDS });
  } else {
    sweepMemoryStore();
    memoryStore.set(token, { record, expiresAt: Date.now() + HANDOFF_TTL_SECONDS * 1000 });
  }
  return token;
}

/** Atomically consume (single-use). Null = unknown, expired, or replayed. */
export async function consumeHandoffToken(token: string): Promise<HandoffRecord | null> {
  if (!token || token.length > 128) return null;

  if (redis) {
    const raw = await redis.getdel<string | HandoffRecord>(`${KEY_PREFIX}${token}`);
    if (!raw) return null;
    try {
      const parsed = typeof raw === "string" ? (JSON.parse(raw) as HandoffRecord) : raw;
      if (!parsed || typeof parsed.userId !== "string" || !isHandoffPurpose(parsed.purpose)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  sweepMemoryStore();
  const entry = memoryStore.get(token);
  if (!entry) return null;
  memoryStore.delete(token);
  return entry.record;
}
