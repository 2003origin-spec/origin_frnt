/**
 * The logged-out "2 free checks a day" limit for POST /api/public/rank-predictor
 * (V1/PERCENTILE_PREDICTOR_PLAN.md §8.3). A soft marketing wall, not security:
 * it fails OPEN (in-memory fallback) when Redis is down.
 *
 * - Device: an HttpOnly cookie `rp_did` = random 128-bit id + HMAC signature.
 *   Main counter: `rp:anon:<IST day>:dev:<device id>`, at most 2 members.
 * - IP backstop: `rp:anon:<IST day>:ip:<HMAC(ip)>`, at most 30 members, so a
 *   college Wi-Fi or a mobile carrier's shared IP is never blocked at 2.
 * - Members are keyed hashes of the INPUT (marks, category, …), so sending the
 *   same input again does not use up a check. Sets expire after 36 h.
 * - The IST day rolls over at 00:00 IST (18:30 UTC), not at UTC midnight.
 *
 * Privacy (plan §12.1): nothing here logs or stores marks, category, PwD,
 * gender, home state or the raw IP. Redis holds only the random device id and
 * HMAC-SHA256 digests made with a server-only key (derived from
 * AUTH_JWT_SECRET_CURRENT), which cannot be reversed without that key.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { Redis } from "@upstash/redis";

import { istDateKeyFromMs } from "@/lib/ist-day";
import { metric } from "@/lib/metrics";
import { FREE_CHECKS_PER_DAY, type PredictInput } from "@/lib/rank-predictor/types";
import { readCookie } from "@/server/auth-jwt";

export { FREE_CHECKS_PER_DAY, readCookie };

const IP_CHECKS_PER_DAY = 30;
const CHECK_SET_TTL_SECONDS = 36 * 60 * 60;
export const DEVICE_COOKIE_NAME = "rp_did";
const DEVICE_COOKIE_PATH = "/api/public/rank-predictor";
const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const KEY_LABEL = "origin:rank-predictor:limit:v1";

/** Wall clock. A function on the module so tests can swap it (fake clock). */
export function nowMs(): number {
  return Date.now();
}

/** The IST calendar day (YYYY-MM-DD) of `ms`: the same day key as streaks (src/lib/ist-day.ts). */
export const istDay = istDateKeyFromMs;

// ─── Server key ─────────────────────────────────────────────────────────────

let devFallbackKey: Buffer | null = null;
let warnedMissingKey = false;

/**
 * The HMAC key for device ids, IP hashes and input hashes. Derived from
 * AUTH_JWT_SECRET_CURRENT (already required in production), so no new env var.
 * When it is missing (it never is in a working deploy: login needs it too) a
 * random per-process key is used and one warning is logged; device cookies then
 * reset when the process restarts, which only gives out extra free checks.
 */
export function limitKey(env: Readonly<Record<string, string | undefined>> = process.env): Buffer {
  const raw = env.AUTH_JWT_SECRET_CURRENT?.trim();
  if (raw) return createHmac("sha256", raw).update(KEY_LABEL).digest();
  if (!warnedMissingKey) {
    warnedMissingKey = true;
    console.error("[rank-predictor] AUTH_JWT_SECRET_CURRENT is not set; using a per-process key for the free-check limit.");
  }
  devFallbackKey ??= randomBytes(32);
  return devFallbackKey;
}

function mac(key: Buffer, label: string, value: string, bytes = 16): string {
  return createHmac("sha256", key).update(`${label}\0${value}`).digest().subarray(0, bytes).toString("base64url");
}

// ─── Device cookie ──────────────────────────────────────────────────────────

const DEVICE_ID = /^[A-Za-z0-9_-]{22}$/;

export function newDeviceId(): string {
  return randomBytes(16).toString("base64url");
}

/** `<id>.<signature>`: no personal data, only a random id. */
export function signDeviceId(id: string, key: Buffer): string {
  return `${id}.${mac(key, "did", id)}`;
}

/** The device id from the request's `rp_did` cookie, or null (missing, malformed, bad signature). */
export function deviceIdFromRequest(request: Request, key: Buffer): string | null {
  try {
    return verifyDeviceCookie(readCookie(request, DEVICE_COOKIE_NAME), key);
  } catch {
    return null; // e.g. a broken %-escape: treat it as no cookie, never a 500
  }
}

/** The device id inside a well-formed, correctly signed cookie value; otherwise null. */
export function verifyDeviceCookie(value: string | null | undefined, key: Buffer): string | null {
  if (!value || value.length > 80) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  if (!DEVICE_ID.test(id)) return null;
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(mac(key, "did", id));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}

export function deviceCookieHeader(value: string, opts: { secure: boolean }): string {
  return [
    `${DEVICE_COOKIE_NAME}=${value}`,
    `Path=${DEVICE_COOKIE_PATH}`,
    `Max-Age=${DEVICE_COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(opts.secure ? ["Secure"] : []),
  ].join("; ");
}

// ─── IP and input hashes ────────────────────────────────────────────────────

/** Client IP as Vercel resolves it (it overwrites x-forwarded-for). Never logged. */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashIp(ip: string, key: Buffer): string {
  return mac(key, "ip", ip);
}

/**
 * Keyed hash of what decides the answer. Display-only changes (and the unused
 * wrong-answer counts) give the same hash, so they never use up a check.
 */
export function hashInput(input: PredictInput, key: Buffer): string {
  const marks = Object.keys(input.marks)
    .sort()
    .map((id) => `${id}=${input.marks[id]}`)
    .join(",");
  const canonical = [
    input.exam,
    marks,
    input.category,
    input.pwd ? "pwd" : "-",
    input.homeState ?? "",
    input.jeeMainShift ?? "",
    input.source?.kind ?? "manual",
  ].join("|");
  return mac(key, "input", canonical);
}

// ─── Set store (Redis + in-memory fallback) ─────────────────────────────────

export interface CheckSetStore {
  /** SADD + TTL; `added` = the member was new, `size` = members after the add. */
  add(key: string, member: string, ttlSeconds: number): Promise<{ added: boolean; size: number }>;
  remove(key: string, member: string): Promise<void>;
  size(key: string): Promise<number>;
}

/** The Upstash calls the Redis store uses (lets tests pass a fake Redis). */
interface SetPipeline {
  sadd(key: string, member: string): SetPipeline;
  scard(key: string): SetPipeline;
  expire(key: string, seconds: number): SetPipeline;
  exec(): Promise<unknown[]>;
}
interface SetRedis {
  pipeline(): SetPipeline;
  scard(key: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
}

export function createRedisCheckStore(redis: SetRedis): CheckSetStore {
  return {
    // One round trip: SADD + SCARD + EXPIRE (re-setting the TTL is harmless:
    // the key names one IST day, so it still dies within 36 h of that day).
    async add(key, member, ttlSeconds) {
      const [added, size] = await redis.pipeline().sadd(key, member).scard(key).expire(key, ttlSeconds).exec();
      return { added: Number(added) === 1, size: Number(size) };
    },
    async remove(key, member) {
      await redis.srem(key, member);
    },
    size: (key) => redis.scard(key),
  };
}

/** Per-instance store; bounded (cleared past 10k keys). */
export function createMemoryCheckStore(now: () => number = () => nowMs()): CheckSetStore {
  const sets = new Map<string, { members: Set<string>; expiresAt: number }>();
  const live = (key: string) => {
    const entry = sets.get(key);
    if (entry && entry.expiresAt <= now()) {
      sets.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    async add(key, member, ttlSeconds) {
      let entry = live(key);
      if (!entry) {
        if (sets.size >= 10_000) sets.clear();
        entry = { members: new Set(), expiresAt: now() + ttlSeconds * 1000 };
        sets.set(key, entry);
      }
      const added = !entry.members.has(member);
      if (added) entry.members.add(member);
      return { added, size: entry.members.size };
    },
    async remove(key, member) {
      live(key)?.members.delete(member);
    },
    async size(key) {
      return live(key)?.members.size ?? 0;
    },
  };
}

/** Uses `primary`; on any error answers from `fallback` instead (fail open). */
export function createFailOpenStore(primary: CheckSetStore, fallback: CheckSetStore): CheckSetStore {
  const degrade = (error: unknown) => {
    // No keys or identifiers in the log line, only that the fallback is in use.
    console.error("[rank-predictor] free-check store failed; using the in-memory fallback", error instanceof Error ? error.name : "error");
    metric("origin.rate_limit.degraded", { reason: "rank_predictor_store" });
  };
  return {
    async add(key, member, ttl) {
      try {
        return await primary.add(key, member, ttl);
      } catch (error) {
        degrade(error);
        return fallback.add(key, member, ttl);
      }
    },
    async remove(key, member) {
      try {
        await primary.remove(key, member);
      } catch (error) {
        degrade(error);
        await fallback.remove(key, member);
      }
    },
    async size(key) {
      try {
        return await primary.size(key);
      } catch (error) {
        degrade(error);
        return fallback.size(key);
      }
    },
  };
}

let store: CheckSetStore | null = null;

/** Upstash when configured (with the memory fallback), else memory only. */
export function freeCheckStore(): CheckSetStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const memory = createMemoryCheckStore();
  store = url && token ? createFailOpenStore(createRedisCheckStore(new Redis({ url, token }) as unknown as SetRedis), memory) : memory;
  return store;
}

// ─── The rule ───────────────────────────────────────────────────────────────

type FreeCheckKeys = { day: string; deviceId: string; ipHash: string; inputHash: string };

type FreeCheckDecision = { allowed: boolean; remaining: number };

const deviceKey = (day: string, deviceId: string) => `rp:anon:${day}:dev:${deviceId}`;
const ipKey = (day: string, ipHash: string) => `rp:anon:${day}:ip:${ipHash}`;

/**
 * Charge one free check for `keys.inputHash`. A repeat of an input this device
 * already checked today is free. Add-then-check keeps two parallel requests
 * from both slipping past the cap.
 */
export async function chargeFreeCheck(s: CheckSetStore, keys: FreeCheckKeys): Promise<FreeCheckDecision> {
  const dKey = deviceKey(keys.day, keys.deviceId);
  const dev = await s.add(dKey, keys.inputHash, CHECK_SET_TTL_SECONDS);
  if (!dev.added) return { allowed: true, remaining: Math.max(0, FREE_CHECKS_PER_DAY - dev.size) };
  if (dev.size > FREE_CHECKS_PER_DAY) {
    await s.remove(dKey, keys.inputHash);
    return { allowed: false, remaining: 0 };
  }
  // The IP set counts device+input pairs, so 30 different devices behind one
  // IP each get their first check before the backstop closes.
  const iKey = ipKey(keys.day, keys.ipHash);
  const ipMember = `${keys.deviceId}:${keys.inputHash}`;
  const ip = await s.add(iKey, ipMember, CHECK_SET_TTL_SECONDS);
  if (ip.added && ip.size > IP_CHECKS_PER_DAY) {
    await s.remove(iKey, ipMember);
    await s.remove(dKey, keys.inputHash);
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: Math.max(0, FREE_CHECKS_PER_DAY - dev.size) };
}

/** Checks left today for this device, without using one. */
export async function remainingFreeChecks(s: CheckSetStore, day: string, deviceId: string | null): Promise<number> {
  if (!deviceId) return FREE_CHECKS_PER_DAY;
  return Math.max(0, FREE_CHECKS_PER_DAY - (await s.size(deviceKey(day, deviceId))));
}
