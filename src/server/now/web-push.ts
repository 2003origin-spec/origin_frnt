/**
 * Web Push for solver offers (decision B85): browser push subscriptions and
 * payload-less, VAPID-signed sends. The service worker asks
 * /api/now/helper/offers/current what to show, so no message encryption and
 * no new dependency are needed (ES256 signing via `jose`).
 *
 * Env (all optional; without the key pair the feature is hidden):
 *   NOW_WEB_PUSH_PUBLIC_KEY   — VAPID public key, base64url (65-byte point)
 *   NOW_WEB_PUSH_PRIVATE_KEY  — VAPID private key, base64url (32 bytes)
 *   NOW_WEB_PUSH_SUBJECT      — contact for push services, e.g. mailto:team@o3origin.com
 */

import { SignJWT, importJWK } from "jose";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";

import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { MAX_ENDPOINT_LENGTH, isAllowedPushEndpoint, isGoneStatus, vapidAudience, vapidJwk } from "./web-push-rules";

const DEFAULT_SUBJECT = "mailto:support@o3origin.com";
const SEND_TIMEOUT_MS = 5_000;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
let fetchOverride: FetchLike | null = null;

/** Test seam. */
export function __setWebPushFetchForTests(fn: FetchLike | null): void {
  fetchOverride = fn;
}

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export function getWebPushConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.NOW_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.NOW_WEB_PUSH_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey || !vapidJwk(publicKey, privateKey)) return null;
  return { publicKey, privateKey, subject: process.env.NOW_WEB_PUSH_SUBJECT?.trim() || DEFAULT_SUBJECT };
}

/** The key the browser subscribes with; null hides the "Offer alerts" control. */
export function webPushPublicKey(): string | null {
  return getWebPushConfig()?.publicKey ?? null;
}

async function requireSolver(userId: string): Promise<void> {
  const res = await (await db()).query(`SELECT 1 FROM now.helpers WHERE user_id = $1 AND kind = 'human'`, [userId]);
  if (res.rowCount === 0) throw new NowError(403, "not_a_solver", "Only approved solvers can turn on offer alerts.");
}

export type SubscriptionInput = { endpoint: string; keys?: { p256dh?: string | null; auth?: string | null } | null };

/** Saves this browser's subscription for the user (a browser moves to whoever signed in last). */
export async function saveWebPushSubscription(userId: string, input: SubscriptionInput, userAgent: string | null): Promise<void> {
  if (!getWebPushConfig()) throw new NowError(503, "push_unavailable", "Offer alerts are not available right now.");
  await requireSolver(userId);
  if (!isAllowedPushEndpoint(input.endpoint)) throw new NowError(400, "bad_endpoint", "That browser push address is not supported.");
  await (await db()).query(
    `INSERT INTO now.push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent, failures = 0, updated_at = NOW()`,
    [
      createPrefixedId("npsub"),
      userId,
      input.endpoint,
      input.keys?.p256dh?.slice(0, 200) ?? null,
      input.keys?.auth?.slice(0, 100) ?? null,
      userAgent?.slice(0, 300) ?? null,
    ],
  );
}

export async function deleteWebPushSubscription(userId: string, endpoint: string): Promise<void> {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) return;
  await (await db()).query(`DELETE FROM now.push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]);
}

export async function hasWebPushSubscription(userId: string): Promise<boolean> {
  if (!getWebPushConfig()) return false;
  const res = await (await db()).query(`SELECT 1 FROM now.push_subscriptions WHERE user_id = $1 LIMIT 1`, [userId]);
  return (res.rowCount ?? 0) > 0;
}

async function vapidHeader(endpoint: string, config: NonNullable<ReturnType<typeof getWebPushConfig>>, now: Date): Promise<string> {
  const key = await importJWK(vapidJwk(config.publicKey, config.privateKey)!, "ES256");
  const jwt = await new SignJWT({ sub: config.subject })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setAudience(vapidAudience(endpoint))
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 12 * 60 * 60)
    .sign(key);
  return `vapid t=${jwt}, k=${config.publicKey}`;
}

export type WebPushResult = { attempted: number; delivered: number; pruned: number };

/**
 * A payload-less push to every browser the user turned alerts on in. Expired
 * subscriptions (404/410) are deleted; anything else is counted and left.
 */
export async function sendWebPushToUser(
  userId: string,
  options: { ttlSeconds: number; urgency?: "high" | "normal" },
  now: Date = new Date(),
): Promise<WebPushResult> {
  const config = getWebPushConfig();
  const result: WebPushResult = { attempted: 0, delivered: 0, pruned: 0 };
  if (!config) return result;
  const pool = await db();
  const subs = await pool.query<{ id: string; endpoint: string }>(`SELECT id, endpoint FROM now.push_subscriptions WHERE user_id = $1`, [userId]);
  const doFetch = fetchOverride ?? ((url: string, init: RequestInit) => fetch(url, init));
  for (const sub of subs.rows) {
    if (!isAllowedPushEndpoint(sub.endpoint)) continue;
    result.attempted += 1;
    try {
      const res = await doFetch(sub.endpoint, {
        method: "POST",
        headers: {
          Authorization: await vapidHeader(sub.endpoint, config, now),
          TTL: String(Math.max(0, Math.round(options.ttlSeconds))),
          Urgency: options.urgency ?? "high",
          "Content-Length": "0",
        },
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (res.ok) {
        result.delivered += 1;
        await pool.query(`UPDATE now.push_subscriptions SET last_success_at = $2, failures = 0 WHERE id = $1`, [sub.id, now]);
      } else if (isGoneStatus(res.status)) {
        result.pruned += 1;
        await pool.query(`DELETE FROM now.push_subscriptions WHERE id = $1`, [sub.id]);
      } else {
        await pool.query(`UPDATE now.push_subscriptions SET failures = failures + 1 WHERE id = $1`, [sub.id]);
      }
    } catch (error) {
      console.warn("[origin-now] web push failed", sub.id, error instanceof Error ? error.message : error);
      await pool.query(`UPDATE now.push_subscriptions SET failures = failures + 1 WHERE id = $1`, [sub.id]).catch(() => undefined);
    }
  }
  return result;
}
