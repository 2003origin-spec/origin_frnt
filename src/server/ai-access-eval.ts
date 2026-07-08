/**
 * AI Feature Toggle epic — PURE precedence core (no IO).
 *
 * Split out of ai-access.ts so unit tests (tests/origin-ai/ai-access.test.ts)
 * can import evaluateAiAccess without pulling in next/server, @upstash/redis,
 * or the authz chain. ai-access.ts re-exports everything here.
 *
 * Precedence (doc 02 §4): role(non-student → deny) > flag-off(→ allow) >
 * global-OFF(absolute kill) > user > batch(OFF wins) > workspace(OFF wins) >
 * tier > default ON.
 */

export type AiFeature = "originAi" | "aiExplainer";

export type AiDecisionSource =
  | "flag_off"
  | "role"
  | "global"
  | "user"
  | "batch"
  | "workspace"
  | "tier"
  | "default";

export type AiAccessDecision = {
  originAi: boolean;
  aiExplainer: boolean;
  decidedBy: { originAi: AiDecisionSource; aiExplainer: AiDecisionSource };
};

export type RulePair = { o: boolean | null; e: boolean | null };

export type RulesSnapshot = {
  v: 1;
  global: { o: boolean; e: boolean };
  tier: Partial<Record<"free" | "premium", RulePair>>;
  workspace: Record<string, RulePair>;
  batch: Record<string, RulePair>;
};

export type AiEvalContext = {
  role: string;
  tier: "free" | "premium";
  batchIds: string[];
  wsIds: string[];
  userRule: { o: boolean | null; e: boolean | null } | null;
};

function decideFeature(
  f: "o" | "e",
  rules: RulesSnapshot,
  ctx: AiEvalContext,
  flagEnabled: boolean,
): { allow: boolean; by: AiDecisionSource } {
  // Role runs BEFORE the flag check: the student-only rule (D4) is unflagged.
  if (ctx.role !== "student") return { allow: false, by: "role" };
  if (!flagEnabled) return { allow: true, by: "flag_off" };
  // Global OFF is the absolute kill switch (beats even a user ON).
  if (rules.global?.[f] === false) return { allow: false, by: "global" };
  // Most-specific explicit rule wins; OFF wins ties within a layer.
  const ur = ctx.userRule;
  if (ur && ur[f] != null) return { allow: ur[f] as boolean, by: "user" };
  const batchVals = ctx.batchIds
    .map((id) => rules.batch[id]?.[f])
    .filter((v): v is boolean => v != null);
  if (batchVals.length > 0) return { allow: !batchVals.includes(false), by: "batch" };
  const wsVals = ctx.wsIds
    .map((id) => rules.workspace[id]?.[f])
    .filter((v): v is boolean => v != null);
  if (wsVals.length > 0) return { allow: !wsVals.includes(false), by: "workspace" };
  const tierVal = rules.tier[ctx.tier]?.[f];
  if (tierVal != null) return { allow: tierVal, by: "tier" };
  return { allow: true, by: "default" };
}

/** Pure precedence evaluation. Both features are evaluated independently. */
export function evaluateAiAccess(
  rules: RulesSnapshot,
  ctx: AiEvalContext,
  flagEnabled: boolean,
): AiAccessDecision {
  const o = decideFeature("o", rules, ctx, flagEnabled);
  const e = decideFeature("e", rules, ctx, flagEnabled);
  return {
    originAi: o.allow,
    aiExplainer: e.allow,
    decidedBy: { originAi: o.by, aiExplainer: e.by },
  };
}
