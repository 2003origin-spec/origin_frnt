/**
 * Generic Redis Streams + code-token KV helpers, extracted from rooms-redis.ts
 * so multiple realtime surfaces (study rooms, CBT rooms) can share one battle-
 * tested implementation. A "namespace" binds a set of key-prefix functions to
 * the shared Redis client (or the in-memory dev fallback). Behavior is
 * byte-identical to the original rooms-redis implementation.
 */

import { Redis } from "@upstash/redis";

type StreamEnvelope<E> = {
  id: string;
  event: E;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const sharedRedis: Redis | null =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

// Shared in-memory fallback stores (keys are namespaced by prefix, so multiple
// namespaces coexist safely in one process).
const localCodes = new Map<string, { value: string; expiresAt: number }>();
const localStreams = new Map<string, StreamEnvelope<unknown>[]>();
let localStreamSequence = 0;

/**
 * Stream keys are MAXLEN-trimmed but were never expired, so every room that was
 * abandoned (never finished/closed, so never `deleteStream`ed) kept up to ~500
 * entries in Upstash forever. Every append refreshes this TTL, so a live room
 * never loses its stream; one idle for a week is reclaimed.
 */
export const STREAM_TTL_SECONDS = 7 * 24 * 3600;

function canUseLocalFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

function setLocal(key: string, value: string, ttlSeconds: number, nx = false): boolean {
  const now = Date.now();
  const current = localCodes.get(key);
  if (current && current.expiresAt <= now) {
    localCodes.delete(key);
  }
  if (nx && localCodes.has(key)) {
    return false;
  }
  localCodes.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return true;
}

function getLocal(key: string): string | null {
  const current = localCodes.get(key);
  if (!current) {
    return null;
  }
  if (current.expiresAt <= Date.now()) {
    localCodes.delete(key);
    return null;
  }
  return current.value;
}

/** Margin subtracted from "now" when an SSE connection picks its start id. */
export const STREAM_START_SKEW_MS = 2_000;

/**
 * Where an SSE connection should start reading. Never "$": with XREAD BLOCK,
 * "$" only returns entries added while that one read is blocked, so an event
 * published between two reads (e.g. after a keepalive timeout, or between the
 * client's snapshot fetch and the first read) is silently lost. A concrete id
 * a little in the past is stable across reads; the replayed overlap is
 * harmless because every consumer applies events idempotently.
 */
export function streamStartCursor(lastEventId: string | null | undefined, now = Date.now()): string {
  const resumeFrom = lastEventId?.trim();
  if (resumeFrom) return resumeFrom;
  return `${now - STREAM_START_SKEW_MS}-0`;
}

function parseStreamId(id: string): [number, number] {
  const [milliseconds, sequence] = id.split("-").map((part) => Number(part));
  return [milliseconds || 0, sequence || 0];
}

/** Orders stream ids as (ms, seq) pairs, the way Redis does. */
function compareStreamIds(a: string, b: string): number {
  const [aMs, aSeq] = parseStreamId(a);
  const [bMs, bSeq] = parseStreamId(b);
  return aMs - bMs || aSeq - bSeq;
}

function parseRedisFields(fields: unknown): Record<string, string> {
  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    return fields as Record<string, string>;
  }
  if (!Array.isArray(fields)) {
    return {};
  }
  const output: Record<string, string> = {};
  for (let index = 0; index < fields.length; index += 2) {
    output[String(fields[index])] = String(fields[index + 1] ?? "");
  }
  return output;
}

function parseRedisStreamResponse<E>(response: unknown): StreamEnvelope<E>[] {
  if (!Array.isArray(response) || response.length === 0) {
    return [];
  }
  const firstStream = response[0];
  if (!Array.isArray(firstStream)) {
    return [];
  }
  const entries = firstStream[1];
  if (!Array.isArray(entries)) {
    return [];
  }
  const parsed: StreamEnvelope<E>[] = [];
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const [id, fields] = entry;
    const fieldMap = parseRedisFields(fields);
    if (!fieldMap.payload) continue;
    try {
      parsed.push({ id: String(id), event: JSON.parse(fieldMap.payload) as E });
    } catch {
      // Ignore malformed stream entries rather than killing the SSE connection.
    }
  }
  return parsed;
}

export type RedisStreamNamespace<E> = {
  setCodeToken(code: string, jwt: string, id: string, ttlSeconds: number): Promise<boolean>;
  getCodeToken(code: string): Promise<string | null>;
  deleteCode(code: string, id?: string): Promise<void>;
  deleteActiveCode(id: string): Promise<void>;
  getActiveCode(id: string): Promise<{ code: string; ttlSeconds: number } | null>;
  deleteStream(id: string): Promise<void>;
  appendStreamEvent(id: string, event: E): Promise<string | null>;
  readStreamEvents(
    id: string,
    cursor: string,
    options?: { count?: number; blockMs?: number; signal?: AbortSignal },
  ): Promise<StreamEnvelope<E>[]>;
};

export function createRedisStreamNamespace<E>(config: {
  /** Warning label, e.g. "study-rooms" / "cbt". */
  label: string;
  codeKey: (code: string) => string;
  activeCodeKey: (id: string) => string;
  streamKey: (id: string) => string;
  /** Test seam: a Redis client (or null for the local fallback). Defaults to the shared Upstash client. */
  client?: Redis | null;
}): RedisStreamNamespace<E> {
  const { label, codeKey, activeCodeKey, streamKey } = config;
  const redis = config.client === undefined ? sharedRedis : config.client;
  let warnedLocalFallback = false;

  function maybeWarnLocalFallback() {
    if (redis || warnedLocalFallback || process.env.NODE_ENV === "production") {
      return;
    }
    warnedLocalFallback = true;
    console.warn(
      `[${label}] UPSTASH_REDIS_REST_URL/TOKEN are not set. Using in-memory codes and streams in local development.`,
    );
  }

  function requireRedis(): Redis {
    if (!redis) {
      throw new Error(
        `UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for ${label} in production.`,
      );
    }
    return redis;
  }

  async function readLocalStream(
    id: string,
    cursor: string,
    count: number,
    blockMs: number,
    signal?: AbortSignal,
  ): Promise<StreamEnvelope<E>[]> {
    maybeWarnLocalFallback();
    const key = streamKey(id);
    const deadline = Date.now() + blockMs;
    // Like Redis, "$" means "after the newest entry at the moment this read
    // starts", so it only sees entries appended while this call is waiting.
    const after = cursor === "$" ? (localStreams.get(key)?.at(-1)?.id ?? "0-0") : cursor;

    while (!signal?.aborted) {
      const stream = localStreams.get(key) ?? [];
      const events = stream
        .filter((entry) => compareStreamIds(entry.id, after) > 0)
        .slice(0, count) as StreamEnvelope<E>[];
      if (events.length > 0 || Date.now() >= deadline) {
        return events;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return [];
  }

  return {
    async setCodeToken(code, jwt, id, ttlSeconds) {
      if (!redis) {
        if (!canUseLocalFallback()) requireRedis();
        maybeWarnLocalFallback();
        const didSet = setLocal(codeKey(code), jwt, ttlSeconds, true);
        if (didSet) {
          setLocal(activeCodeKey(id), code, ttlSeconds);
        }
        return didSet;
      }
      const result = await redis.set(codeKey(code), jwt, { ex: ttlSeconds, nx: true });
      if (result === "OK") {
        await redis.set(activeCodeKey(id), code, { ex: ttlSeconds });
        return true;
      }
      return false;
    },

    async getCodeToken(code) {
      if (!redis) {
        if (!canUseLocalFallback()) requireRedis();
        maybeWarnLocalFallback();
        return getLocal(codeKey(code));
      }
      return await redis.get<string>(codeKey(code));
    },

    async deleteCode(code, id) {
      if (!redis) {
        localCodes.delete(codeKey(code));
        if (id) localCodes.delete(activeCodeKey(id));
        return;
      }
      await redis.del(codeKey(code));
      if (id) await redis.del(activeCodeKey(id));
    },

    async deleteActiveCode(id) {
      if (!redis) {
        localCodes.delete(activeCodeKey(id));
        return;
      }
      await redis.del(activeCodeKey(id));
    },

    async getActiveCode(id) {
      if (!redis) {
        if (!canUseLocalFallback()) requireRedis();
        maybeWarnLocalFallback();
        const key = activeCodeKey(id);
        const code = getLocal(key);
        const entry = localCodes.get(key);
        if (!code || !entry) return null;
        return { code, ttlSeconds: Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)) };
      }
      const key = activeCodeKey(id);
      const [code, ttl] = await Promise.all([redis.get<string>(key), redis.ttl(key)]);
      if (!code || ttl <= 0) {
        return null;
      }
      return { code, ttlSeconds: ttl };
    },

    async deleteStream(id) {
      if (!redis) {
        localStreams.delete(streamKey(id));
        return;
      }
      await redis.del(streamKey(id));
    },

    async appendStreamEvent(id, event) {
      if (!redis) {
        if (!canUseLocalFallback()) requireRedis();
        maybeWarnLocalFallback();
        const key = streamKey(id);
        const stream = localStreams.get(key) ?? [];
        const entryId = `${Date.now()}-${(localStreamSequence += 1)}`;
        stream.push({ id: entryId, event });
        localStreams.set(key, stream.slice(-500));
        return entryId;
      }
      const payload = JSON.stringify(event);
      const key = streamKey(id);
      const entryId = await redis.xadd(
        key,
        "*",
        { type: (event as { type?: string })?.type ?? "event", payload },
        { trim: { type: "MAXLEN", comparison: "~", threshold: 500 } },
      );
      try {
        await redis.expire(key, STREAM_TTL_SECONDS);
      } catch (error) {
        // The event is already published; a missed TTL refresh is retried by
        // the next append, so don't fail the caller over it.
        console.warn(`[${label}] failed to refresh stream TTL for ${key}:`, error);
      }
      return entryId;
    },

    async readStreamEvents(id, cursor, options = {}) {
      const count = options.count ?? 50;
      const blockMs = options.blockMs ?? 20_000;
      if (!redis) {
        if (!canUseLocalFallback()) requireRedis();
        return readLocalStream(id, cursor, count, blockMs, options.signal);
      }
      const response = await redis.xread(streamKey(id), cursor, { count, blockMS: blockMs });
      return parseRedisStreamResponse<E>(response);
    },
  };
}
