/**
 * Launch controls — admin-toggled runtime settings backed by Redis with an
 * in-memory fallback (mirrors src/server/incidents.ts). Controls:
 *   - allowLogin   : whether users can log in           (default true)
 *   - allowSignup  : whether users can register         (default true)
 *   - coverEnabled : show the pre-launch cover page      (default false)
 *   - launchAt     : ISO datetime the countdown targets  (default null)
 *
 * Without Redis (dev/CI) the settings are pod-local; in production Redis makes
 * them consistent across pods.
 */

import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const KEY = "launch:settings";
const SNAPSHOT_TTL_MS = 10_000;

export type LaunchSettings = {
  allowLogin: boolean;
  allowSignup: boolean;
  coverEnabled: boolean;
  launchAt: string | null;
};

const DEFAULTS: LaunchSettings = {
  allowLogin: true,
  allowSignup: true,
  coverEnabled: false,
  launchAt: null,
};

const memory: LaunchSettings = { ...DEFAULTS };
let snapshot: { value: LaunchSettings; fetchedAt: number } | null = null;

function normalize(raw: unknown): LaunchSettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<LaunchSettings>;
  return {
    allowLogin: obj.allowLogin === undefined ? DEFAULTS.allowLogin : Boolean(obj.allowLogin),
    allowSignup: obj.allowSignup === undefined ? DEFAULTS.allowSignup : Boolean(obj.allowSignup),
    coverEnabled: Boolean(obj.coverEnabled),
    launchAt: typeof obj.launchAt === "string" && obj.launchAt.trim() ? obj.launchAt : null,
  };
}

export async function getLaunchSettings(): Promise<LaunchSettings> {
  if (snapshot && Date.now() - snapshot.fetchedAt < SNAPSHOT_TTL_MS) {
    return snapshot.value;
  }
  if (!redis) {
    snapshot = { value: { ...memory }, fetchedAt: Date.now() };
    return snapshot.value;
  }
  try {
    const raw = await redis.get(KEY);
    const value = normalize(typeof raw === "string" ? JSON.parse(raw) : raw);
    snapshot = { value, fetchedAt: Date.now() };
    return value;
  } catch (err) {
    console.error("[launch-settings] Redis read failed; using last known/defaults", err);
    const value = snapshot?.value ?? { ...memory };
    snapshot = { value, fetchedAt: Date.now() };
    return value;
  }
}

export async function updateLaunchSettings(patch: Partial<LaunchSettings>): Promise<LaunchSettings> {
  const current = await getLaunchSettings();
  const next = normalize({ ...current, ...patch });
  if (redis) {
    await redis.set(KEY, JSON.stringify(next));
  } else {
    Object.assign(memory, next);
  }
  snapshot = { value: next, fetchedAt: Date.now() };
  return next;
}

/**
 * Whether the pre-launch cover should hide the site right now: enabled AND the
 * launch time is in the future (or unset). Once launchAt passes, the cover
 * auto-reveals even without an admin change.
 */
export function isCoverActive(settings: LaunchSettings): boolean {
  if (!settings.coverEnabled) return false;
  if (!settings.launchAt) return true;
  const target = new Date(settings.launchAt).getTime();
  if (Number.isNaN(target)) return true;
  return Date.now() < target;
}
