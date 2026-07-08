/**
 * AI Feature Toggle epic — access resolver + cache + request guards.
 *
 * Two independent concerns live here:
 *  1. evaluateAiAccess() — a PURE precedence function (no IO), unit-tested
 *     against the doc 02 §4 truth table.
 *  2. A Redis projection of app.ai_access_rules: an `ai-access:rules` blob
 *     (all non-user scopes) read behind a 5s in-process snapshot (the proven
 *     src/server/incidents.ts idiom), plus per-student `ai-access:uctx:<id>`
 *     (120s TTL). Steady-state cost per AI request: ≤1 Redis GET, zero Postgres.
 *
 * Postgres is the source of truth. Redis is rebuilt on every write and
 * self-heals from Postgres when a key is missing. If Redis and Postgres are
 * both unreachable we keep the last snapshot (stale-if-error) or fail OPEN —
 * a broken kill-switch must not take AI down (auth + the premium gate still
 * apply independently).
 *
 * Design: V1/ai-feature-toggle/02-system-design.md, 03-database-and-cache.md,
 * 04-server-enforcement-and-apis.md.
 */

import { NextResponse, type NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { metric } from "@/lib/metrics";
import { getAuthContext } from "@/server/authz";
import {
  getUserAiContexts,
  listRules,
  type AiRuleRow,
  type AiUserContext,
} from "@/server/ai-access-store";
import {
  evaluateAiAccess,
  type AiAccessDecision,
  type AiFeature,
  type RulePair,
  type RulesSnapshot,
} from "@/server/ai-access-eval";

// Re-export the pure core + its types so callers can import everything from
// "@/server/ai-access". Unit tests import evaluateAiAccess from the pure module
// directly (no IO), but production code uses this barrel.
export {
  evaluateAiAccess,
  type AiAccessDecision,
  type AiDecisionSource,
  type AiEvalContext,
  type AiFeature,
  type RulesSnapshot,
} from "@/server/ai-access-eval";

// ---------------------------------------------------------------------------
// Redis projection + 5s in-process snapshot.
// ---------------------------------------------------------------------------

const RULES_KEY = "ai-access:rules";
const uctxKey = (userId: string) => `ai-access:uctx:${userId}`;
const UCTX_TTL_SECONDS = 120;

const SNAPSHOT_TTL_MS = (() => {
  const raw = process.env.AI_ACCESS_SNAPSHOT_TTL_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5_000;
})();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const DEFAULT_SNAPSHOT: RulesSnapshot = {
  v: 1,
  global: { o: true, e: true },
  tier: {},
  workspace: {},
  batch: {},
};

let snapshot: { rules: RulesSnapshot; fetchedAt: number } | null = null;
let warnedDegraded = false;

function warnDegradedOnce(reason: string) {
  metric("origin.ai_access.degraded", { reason });
  if (warnedDegraded) return;
  warnedDegraded = true;
  console.error(`[ai-access] degraded (${reason}) — using fallback access state`);
}

export function isAiAccessRedisConfigured(): boolean {
  return redis !== null;
}

function buildSnapshotFromRows(rows: AiRuleRow[]): RulesSnapshot {
  const snap: RulesSnapshot = {
    v: 1,
    global: { o: true, e: true },
    tier: {},
    workspace: {},
    batch: {},
  };
  for (const row of rows) {
    const pair: RulePair = { o: row.oriEnabled, e: row.explainerEnabled };
    switch (row.scopeType) {
      case "global":
        snap.global = { o: row.oriEnabled ?? true, e: row.explainerEnabled ?? true };
        break;
      case "tier":
        if (row.scopeId === "free" || row.scopeId === "premium") snap.tier[row.scopeId] = pair;
        break;
      case "workspace":
        snap.workspace[row.scopeId] = pair;
        break;
      case "batch":
        snap.batch[row.scopeId] = pair;
        break;
      // 'user' rules ride in the per-student uctx, never the shared blob.
      default:
        break;
    }
  }
  return snap;
}

async function buildFromDb(): Promise<RulesSnapshot> {
  return buildSnapshotFromRows(await listRules());
}

/** Rebuild the Redis blob from Postgres (source of truth). Called after every
 * non-user write and when the blob is missing. */
export async function rebuildRulesCache(): Promise<RulesSnapshot> {
  const rules = await buildFromDb();
  if (redis) {
    try {
      await redis.set(RULES_KEY, rules);
    } catch (err) {
      warnDegradedOnce("redis_set_error");
      console.error("[ai-access] failed to write rules blob to Redis", err);
    }
  }
  return rules;
}

async function loadRulesSnapshot(): Promise<RulesSnapshot> {
  if (snapshot && Date.now() - snapshot.fetchedAt < SNAPSHOT_TTL_MS) {
    return snapshot.rules;
  }
  // No Redis (dev/CI): read through to Postgres, memoized by the snapshot TTL.
  if (!redis) {
    try {
      const rules = await buildFromDb();
      snapshot = { rules, fetchedAt: Date.now() };
      return rules;
    } catch (err) {
      return keepOrDefault("db_error_no_redis", err);
    }
  }
  try {
    const blob = await redis.get<RulesSnapshot>(RULES_KEY);
    if (blob && blob.v === 1 && blob.global) {
      snapshot = { rules: blob, fetchedAt: Date.now() };
      return blob;
    }
    // Missing/flushed blob → self-heal from Postgres and repopulate.
    const rules = await rebuildRulesCache();
    snapshot = { rules, fetchedAt: Date.now() };
    return rules;
  } catch (err) {
    warnDegradedOnce("redis_error");
    console.error("[ai-access] rules snapshot load failed; trying Postgres", err);
    try {
      const rules = await buildFromDb();
      snapshot = { rules, fetchedAt: Date.now() };
      return rules;
    } catch (err2) {
      return keepOrDefault("db_and_redis_error", err2);
    }
  }
}

function keepOrDefault(reason: string, err: unknown): RulesSnapshot {
  warnDegradedOnce(reason);
  console.error(`[ai-access] ${reason}`, err);
  if (snapshot) {
    // stale-if-error: keep serving the last known state.
    snapshot.fetchedAt = Date.now();
    return snapshot.rules;
  }
  // fail OPEN — a broken kill-switch must not take AI down.
  snapshot = { rules: DEFAULT_SNAPSHOT, fetchedAt: Date.now() };
  return DEFAULT_SNAPSHOT;
}

/** Drop the in-process snapshot so the same pod sees its own write at once. */
export function invalidateAiAccessSnapshot(): void {
  snapshot = null;
}

/** DEL the per-student uctx key so membership/tier/override changes propagate
 * immediately (the 120s TTL is only a backstop). Fire-and-forget safe. */
export async function invalidateUserAiContext(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(uctxKey(userId));
  } catch (err) {
    console.error("[ai-access] failed to invalidate uctx", err);
  }
}

async function getUserContext(userId: string): Promise<AiUserContext> {
  if (redis) {
    try {
      const cached = await redis.get<AiUserContext>(uctxKey(userId));
      if (cached) return cached;
    } catch (err) {
      warnDegradedOnce("uctx_redis_error");
      console.error("[ai-access] uctx read failed; reading Postgres", err);
    }
  }
  const map = await getUserAiContexts([userId]);
  const ctx: AiUserContext = map.get(userId) ?? {
    tier: "free",
    wsIds: [],
    batchIds: [],
    userRule: null,
  };
  if (redis) {
    try {
      await redis.set(uctxKey(userId), ctx, { ex: UCTX_TTL_SECONDS });
    } catch (err) {
      console.error("[ai-access] uctx write failed", err);
    }
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// 3. IO wrappers.
// ---------------------------------------------------------------------------

async function resolveForUser(
  user: { id: string; role: string } | null,
): Promise<AiAccessDecision> {
  const flagEnabled = isFeatureEnabled("aiAccessControls");
  // Non-students (incl. unauthenticated) are denied by role first — no IO.
  if (!user || user.role !== "student") {
    return evaluateAiAccess(
      DEFAULT_SNAPSHOT,
      { role: user?.role ?? "guest", tier: "free", batchIds: [], wsIds: [], userRule: null },
      flagEnabled,
    );
  }
  const [rules, uctx] = await Promise.all([loadRulesSnapshot(), getUserContext(user.id)]);
  return evaluateAiAccess(
    rules,
    {
      role: "student",
      tier: uctx.tier,
      batchIds: uctx.batchIds,
      wsIds: uctx.wsIds,
      userRule: uctx.userRule,
    },
    flagEnabled,
  );
}

/** Resolve from a NextRequest (JWT only, no DB in steady state). */
export async function resolveAiAccessForRequest(
  request: NextRequest,
): Promise<AiAccessDecision> {
  const ctx = await getAuthContext(request);
  return resolveForUser(ctx ? { id: ctx.userId, role: ctx.role } : null);
}

/** Resolve for an already-resolved user (RSC callers: root layout, doubt-solver). */
export async function resolveAiAccessForUser(
  user: { id: string; role: string } | null,
): Promise<AiAccessDecision> {
  return resolveForUser(user);
}

/** Request guard. Returns null when allowed, else a 403 AI_DISABLED response. */
export async function requireAiFeature(
  request: NextRequest,
  feature: AiFeature,
): Promise<Response | null> {
  const decision = await resolveAiAccessForRequest(request);
  if (decision[feature]) return null;
  return NextResponse.json(
    {
      error: "AI features are currently disabled for your account.",
      code: "AI_DISABLED",
      feature,
      decidedBy: decision.decidedBy[feature],
    },
    { status: 403 },
  );
}

/** Bulk resolve for admin member/student lists — one blob + one SQL, no N+1.
 * Callers pass student ids; unknown ids resolve to the default student ctx. */
export async function resolveAiAccessBulk(
  userIds: string[],
): Promise<Map<string, AiAccessDecision>> {
  const flagEnabled = isFeatureEnabled("aiAccessControls");
  const out = new Map<string, AiAccessDecision>();
  if (userIds.length === 0) return out;
  const [rules, ctxMap] = await Promise.all([
    loadRulesSnapshot(),
    getUserAiContexts(userIds),
  ]);
  for (const id of userIds) {
    const uctx = ctxMap.get(id) ?? {
      tier: "free" as const,
      wsIds: [],
      batchIds: [],
      userRule: null,
    };
    out.set(
      id,
      evaluateAiAccess(
        rules,
        {
          role: "student",
          tier: uctx.tier,
          batchIds: uctx.batchIds,
          wsIds: uctx.wsIds,
          userRule: uctx.userRule,
        },
        flagEnabled,
      ),
    );
  }
  return out;
}

/** Global-only decision for the unauthenticated demo-solve endpoint. */
export async function getGlobalAiAccess(): Promise<{
  originAi: boolean;
  aiExplainer: boolean;
}> {
  const flagEnabled = isFeatureEnabled("aiAccessControls");
  if (!flagEnabled) return { originAi: true, aiExplainer: true };
  const rules = await loadRulesSnapshot();
  return { originAi: rules.global.o !== false, aiExplainer: rules.global.e !== false };
}
