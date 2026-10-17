/**
 * Origin NOW realtime plumbing (plan doc, "Stream rules" and matching step 4):
 *
 * - Event streams over the shared Redis Streams helper (same as study rooms
 *   and CBT): one stream per request (`req:<id>`, read by its student and its
 *   solver) and one per helper (`helper:<id>`, incoming offers).
 * - Helper presence: a Redis sorted set per subject scored by last heartbeat,
 *   the ogcode-presence pattern. In-memory fallback outside production only.
 * - Timers: QStash messages with a delay, as an ACCELERATOR. The database
 *   rows (`expires_at`, `ends_at`) are the truth and the one-minute sweep is
 *   the backstop, so a missing or late QStash never breaks correctness.
 */

import { Client } from "@upstash/qstash";
import { Redis } from "@upstash/redis";

import { createRedisStreamNamespace } from "@/server/redis-streams";
import { sendPushToUser } from "@/server/push/fcm";

import { PRESENCE_WINDOW_MS } from "./types";
import { sendWebPushToUser } from "./web-push";

// ---------------------------------------------------------------------------
// Event streams.

export type NowEvent = { type: string; at: string; [key: string]: unknown };

const streams = createRedisStreamNamespace<NowEvent>({
  label: "origin-now",
  // Code-token helpers are unused here; keys are namespaced so they can never
  // collide with study-room or CBT codes.
  codeKey: (code) => `now:code:${code}`,
  activeCodeKey: (id) => `now:active-code:${id}`,
  streamKey: (id) => `now:stream:${id}`,
});

export const requestStreamId = (requestId: string) => `req:${requestId}`;
export const helperStreamId = (helperId: string) => `helper:${helperId}`;

/** Best effort: a failed publish only delays the client until its next refetch. */
export async function publishNowEvent(streamId: string, event: Omit<NowEvent, "at">): Promise<void> {
  try {
    await streams.appendStreamEvent(streamId, { ...event, at: new Date().toISOString() } as NowEvent);
  } catch (error) {
    console.warn("[origin-now] stream publish failed", streamId, error instanceof Error ? error.message : error);
  }
}

export function readNowEvents(
  streamId: string,
  cursor: string,
  options: { count?: number; blockMs?: number; signal?: AbortSignal },
) {
  return streams.readStreamEvents(streamId, cursor, options);
}

// ---------------------------------------------------------------------------
// Presence.

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis: Redis | null = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/** Upstash Redis is set (required in production for presence and live updates). */
export function isPresenceStoreConfigured(): boolean {
  return redis !== null;
}

const PRESENCE_KEY_TTL_SECONDS = 600;
const SUBJECTS = ["physics", "chemistry", "mathematics", "biology"] as const;
const presenceKey = (subject: string) => `now:online:${subject}`;

declare global {
  var __originNowLocalPresence: Map<string, Map<string, number>> | undefined;
}

function localPresence(): Map<string, Map<string, number>> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("UPSTASH_REDIS_REST_URL/TOKEN are required for Origin NOW presence in production.");
  }
  globalThis.__originNowLocalPresence ??= new Map();
  return globalThis.__originNowLocalPresence;
}

/**
 * Extra time a background heartbeat counts for (decision B85): browsers slow
 * hidden-tab timers to about one a minute, so a solver with offer alerts on
 * stays online for 90 s after each one instead of 60 s.
 */
export const BACKGROUND_PRESENCE_GRACE_MS = 30_000;

/** Marks a helper online for exactly these subjects (and offline for the rest). */
export async function heartbeatPresence(
  helperId: string,
  subjects: readonly string[],
  nowMs = Date.now(),
  options: { background?: boolean } = {},
): Promise<void> {
  const online = new Set(subjects);
  // The stored "last seen" runs ahead by the grace, so the usual 60 s window keeps it online longer.
  const score = nowMs + (options.background ? BACKGROUND_PRESENCE_GRACE_MS : 0);
  if (!redis) {
    const store = localPresence();
    for (const subject of SUBJECTS) {
      const set = store.get(subject) ?? new Map<string, number>();
      if (online.has(subject)) set.set(helperId, score);
      else set.delete(helperId);
      store.set(subject, set);
    }
    return;
  }
  await Promise.all(
    SUBJECTS.map(async (subject) => {
      const key = presenceKey(subject);
      if (online.has(subject)) {
        await redis.zadd(key, { score, member: helperId });
        await redis.expire(key, PRESENCE_KEY_TTL_SECONDS);
      } else {
        await redis.zrem(key, helperId);
      }
    }),
  );
}

export async function clearPresence(helperId: string): Promise<void> {
  await heartbeatPresence(helperId, []);
}

/** Helper ids seen for this subject within the presence window, with last-seen ms. */
export async function listOnlineHelpers(subject: string, nowMs = Date.now()): Promise<Map<string, number>> {
  const since = nowMs - PRESENCE_WINDOW_MS;
  if (!redis) {
    const set = localPresence().get(subject) ?? new Map<string, number>();
    return new Map([...set.entries()].filter(([, seen]) => seen >= since));
  }
  const raw = (await redis.zrange(presenceKey(subject), since, "+inf", { byScore: true, withScores: true })) as (
    | string
    | number
  )[];
  const out = new Map<string, number>();
  for (let i = 0; i + 1 < raw.length; i += 2) out.set(String(raw[i]), Number(raw[i + 1]));
  return out;
}

// ---------------------------------------------------------------------------
// Timers (QStash delayed messages).

export type NowTimer =
  | { kind: "offer_expired"; offerId: string }
  | { kind: "dispatch"; requestId: string }
  | { kind: "no_show"; sessionId: string }
  | { kind: "session_warn"; sessionId: string }
  | { kind: "session_end"; sessionId: string; endsAt: string };

export const TIMER_PATH = "/api/internal/now/timer";

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function siteOrigin(): string | null {
  const configured = env("NEXT_PUBLIC_SITE_URL");
  if (configured) return configured.replace(/\/$/u, "");
  const vercel = env("VERCEL_URL");
  return vercel ? `https://${vercel}` : null;
}

let timerClientOverride: Pick<Client, "publishJSON"> | null | undefined;

/** Test seam. */
export function __setNowTimerClientForTests(client: Pick<Client, "publishJSON"> | null | undefined): void {
  timerClientOverride = client;
}

function timerKey(timer: NowTimer): string {
  switch (timer.kind) {
    case "offer_expired":
      return `${timer.kind}:${timer.offerId}`;
    case "dispatch":
      return `${timer.kind}:${timer.requestId}:${Math.floor(Date.now() / 10_000)}`;
    case "session_end":
      return `${timer.kind}:${timer.sessionId}:${timer.endsAt}`;
    default:
      return `${timer.kind}:${timer.sessionId}`;
  }
}

/**
 * Schedules a timer callback. Returns false when QStash is not configured —
 * a normal state in dev; the sweep cron does the same work within a minute.
 */
export async function scheduleNowTimer(timer: NowTimer, delaySeconds: number): Promise<boolean> {
  const client =
    timerClientOverride !== undefined ? timerClientOverride : env("QSTASH_TOKEN") ? new Client({ token: env("QSTASH_TOKEN")!, enableTelemetry: false }) : null;
  const origin = siteOrigin();
  const internalToken = env("INTERNAL_CRON_TOKEN");
  if (!client || !origin || !internalToken) return false;
  try {
    await client.publishJSON({
      url: `${origin}${TIMER_PATH}`,
      body: timer,
      delay: Math.max(0, Math.round(delaySeconds)),
      deduplicationId: timerKey(timer).replace(/[^A-Za-z0-9_.:-]/g, "_"),
      retries: 2,
      headers: { "Upstash-Forward-Authorization": `Bearer ${internalToken}` },
    });
    return true;
  } catch (error) {
    console.warn("[origin-now] timer publish failed", timer.kind, error instanceof Error ? error.message : error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Push (only reaches helpers once the native push release ships; gap 9).

export async function pushOfferToHelper(userId: string, input: { offerId: string; expiresAt: string; subject: string }): Promise<void> {
  // Push is best effort; the shift screen's stream is the pilot channel.
  const ttlSeconds = Math.max(0, Math.round((Date.parse(input.expiresAt) - Date.now()) / 1000));
  await Promise.allSettled([
    // Native app (FCM), once the Android shell has push tokens.
    sendPushToUser(userId, {
      title: "New doubt waiting",
      body: `A ${input.subject} doubt is waiting for you. Tap to accept.`,
      route: "/now/solver",
      data: { kind: "now_offer", offerId: input.offerId, expiresAt: input.expiresAt },
    }),
    // Browsers that turned on offer alerts (decision B85); useless once the offer has lapsed.
    sendWebPushToUser(userId, { ttlSeconds, urgency: "high" }),
  ]);
}
