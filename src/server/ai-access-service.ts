/**
 * AI Feature Toggle epic — admin service (PR pair 2).
 *
 * Thin orchestration between the /api/admin/ai-access routes (and the RSC page)
 * and the stores: validation, entity-existence checks, write sequencing
 * (upsert/delete → cache ops → audit), and assembly of the overview / member
 * lists / why-chain payloads. All admin mutations flow through setAiAccessRule —
 * the only writer in the codebase.
 *
 * Design: V1/ai-feature-toggle/04-server-enforcement-and-apis.md §4–5,
 *         V1/ai-feature-toggle/05-admin-ui.md.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import {
  countRules,
  deleteRule,
  getRule,
  getUserAiContexts,
  listRules,
  upsertRule,
  type AiRuleRow,
  type AiRuleScopeType,
} from "@/server/ai-access-store";
import {
  invalidateAiAccessSnapshot,
  invalidateUserAiContext,
  isAiAccessRedisConfigured,
  rebuildRulesCache,
  resolveAiAccessBulk,
  resolveAiAccessForUser,
  type AiAccessDecision,
} from "@/server/ai-access";
import {
  getBatchInfo,
  getBatchNames,
  getStudentCountsByTier,
  getUserBasic,
  getUserOverrideValues,
  getWorkspaceNames,
  listBatchMembersForAdmin,
  listStudentsForAdmin,
  listWorkspacesForAdmin,
  type AdminMemberRow,
  type AdminUserBasic,
  type RuleValue,
} from "@/server/ai-access-admin-store";

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

function ruleValueOf(row: AiRuleRow | null): RuleValue {
  if (!row || row.oriEnabled === null) return "inherit";
  return row.oriEnabled ? "on" : "off";
}

const DEFAULT_DECISION: AiAccessDecision = {
  originAi: false,
  aiExplainer: false,
  decidedBy: { originAi: "default", aiExplainer: "default" },
};

function decisionView(d: AiAccessDecision | undefined) {
  const x = d ?? DEFAULT_DECISION;
  return { originAi: x.originAi, aiExplainer: x.aiExplainer, decidedBy: x.decidedBy };
}

function userView(u: AdminUserBasic) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    isPremium: u.isPremium,
  };
}

function memberView(
  m: AdminMemberRow,
  decision: AiAccessDecision | undefined,
  override: RuleValue | undefined,
) {
  return {
    userId: m.userId,
    name: m.name,
    username: m.username,
    email: m.email,
    isPremium: m.isPremium,
    override: override ?? "inherit",
    effective: decisionView(decision),
  };
}

// ---------------------------------------------------------------------------
// The single writer.
// ---------------------------------------------------------------------------

export async function setAiAccessRule(
  actor: { userId: string },
  input: { scopeType: AiRuleScopeType; scopeId: string; value: RuleValue },
): Promise<{ rule: AiRuleRow | null; previous: RuleValue }> {
  const { scopeType, scopeId, value } = input;

  if (scopeType === "global" && value === "inherit") {
    throw httpError(400, "The global switch cannot be set to inherit.");
  }

  // Entity existence + student-only (user scope) on on/off writes. 'inherit'
  // skips validation so it doubles as orphan-rule cleanup (doc 04 §4.2).
  let batchWorkspaceId: string | null = null;
  if (value !== "inherit") {
    if (scopeType === "workspace") {
      if (!(await getWorkspaceNames([scopeId])).has(scopeId)) {
        throw httpError(404, "Institute not found.");
      }
    } else if (scopeType === "batch") {
      const b = await getBatchInfo(scopeId);
      if (!b) throw httpError(404, "Batch not found.");
      batchWorkspaceId = b.workspaceId;
    } else if (scopeType === "user") {
      const u = await getUserBasic(scopeId);
      if (!u) throw httpError(404, "User not found.");
      if (u.role !== "student") {
        throw httpError(400, "AI overrides only apply to students.");
      }
    }
  }

  const previous = ruleValueOf(await getRule(scopeType, scopeId));

  let rule: AiRuleRow | null = null;
  if (value === "inherit") {
    await deleteRule(scopeType, scopeId);
  } else {
    const on = value === "on";
    rule = await upsertRule({ scopeType, scopeId, ori: on, explainer: on, updatedBy: actor.userId });
  }

  // Propagate: user scope drops just that student's uctx; every other scope
  // rebuilds the shared blob. Always drop the in-process snapshot (doc 03 §5).
  if (scopeType === "user") {
    await invalidateUserAiContext(scopeId).catch(() => {});
  } else {
    await rebuildRulesCache().catch(() => {});
  }
  invalidateAiAccessSnapshot();

  // Audit via the existing util (entity/action/before/after shape).
  let auditWorkspaceId: string | null = null;
  if (scopeType === "workspace") auditWorkspaceId = scopeId;
  else if (scopeType === "batch") auditWorkspaceId = batchWorkspaceId ?? (await getBatchInfo(scopeId))?.workspaceId ?? null;
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: auditWorkspaceId,
    entityType: "ai_access_rule",
    entityId: `${scopeType}:${scopeId}`,
    action: value === "inherit" ? "ai_access.rule_clear" : "ai_access.rule_set",
    before: { value: previous },
    after: { value },
  }).catch(() => {});

  return { rule, previous };
}

// ---------------------------------------------------------------------------
// Read assemblies.
// ---------------------------------------------------------------------------

export async function getAiAccessOverview() {
  const [rules, counts, studentCounts] = await Promise.all([
    listRules(),
    countRules(),
    getStudentCountsByTier(),
  ]);
  const find = (t: AiRuleScopeType, id: string) =>
    rules.find((r) => r.scopeType === t && r.scopeId === id) ?? null;
  const globalRow = find("global", "");
  const tierRow = (id: "free" | "premium") => find("tier", id);

  const wsRuleIds = rules.filter((r) => r.scopeType === "workspace").map((r) => r.scopeId);
  const batchRuleIds = rules.filter((r) => r.scopeType === "batch").map((r) => r.scopeId);
  const [wsNames, batchNames] = await Promise.all([
    getWorkspaceNames(wsRuleIds),
    getBatchNames(batchRuleIds),
  ]);
  const orphans = [
    ...wsRuleIds
      .filter((id) => !wsNames.has(id))
      .map((id) => ({ scopeType: "workspace" as const, scopeId: id, value: ruleValueOf(find("workspace", id)) })),
    ...batchRuleIds
      .filter((id) => !batchNames.has(id))
      .map((id) => ({ scopeType: "batch" as const, scopeId: id, value: ruleValueOf(find("batch", id)) })),
  ];

  return {
    flagEnabled: isFeatureEnabled("aiAccessControls"),
    redisConfigured: isAiAccessRedisConfigured(),
    global: {
      originAi: globalRow ? globalRow.oriEnabled !== false : true,
      aiExplainer: globalRow ? globalRow.explainerEnabled !== false : true,
      updatedAt: globalRow?.updatedAt ?? null,
      updatedBy: globalRow?.updatedBy ?? null,
    },
    tiers: {
      free: {
        value: ruleValueOf(tierRow("free")),
        updatedAt: tierRow("free")?.updatedAt ?? null,
        updatedBy: tierRow("free")?.updatedBy ?? null,
      },
      premium: {
        value: ruleValueOf(tierRow("premium")),
        updatedAt: tierRow("premium")?.updatedAt ?? null,
        updatedBy: tierRow("premium")?.updatedBy ?? null,
      },
    },
    counts,
    studentCounts,
    orphans,
  };
}

export async function getWorkspacesOverview(input: {
  query?: string;
  limit: number;
  offset: number;
}) {
  const [{ items, total }, rules] = await Promise.all([
    listWorkspacesForAdmin(input),
    listRules(),
  ]);
  const val = (t: AiRuleScopeType, id: string) =>
    ruleValueOf(rules.find((r) => r.scopeType === t && r.scopeId === id) ?? null);
  return {
    items: items.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      status: w.status,
      enrollmentCount: w.enrollmentCount,
      rule: val("workspace", w.id),
      batches: w.batches.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        memberCount: b.memberCount,
        rule: val("batch", b.id),
      })),
    })),
    total,
  };
}

export async function getBatchMembersOverview(input: {
  batchId: string;
  query?: string;
  limit: number;
  offset: number;
}) {
  const batch = await getBatchInfo(input.batchId);
  if (!batch) throw httpError(404, "Batch not found.");
  const { members, total } = await listBatchMembersForAdmin(input);
  const ids = members.map((m) => m.userId);
  const [effective, overrides, rules] = await Promise.all([
    resolveAiAccessBulk(ids),
    getUserOverrideValues(ids),
    listRules(),
  ]);
  const batchRule = ruleValueOf(
    rules.find((r) => r.scopeType === "batch" && r.scopeId === input.batchId) ?? null,
  );
  return {
    batch: { id: batch.id, name: batch.name, workspaceId: batch.workspaceId, rule: batchRule },
    members: members.map((m) => memberView(m, effective.get(m.userId), overrides.get(m.userId))),
    total,
  };
}

export async function getStudentsOverview(input: {
  tier: "free" | "premium";
  query?: string;
  limit: number;
  offset: number;
}) {
  const { members, total } = await listStudentsForAdmin(input);
  const ids = members.map((m) => m.userId);
  const [effective, overrides] = await Promise.all([
    resolveAiAccessBulk(ids),
    getUserOverrideValues(ids),
  ]);
  return {
    members: members.map((m) => memberView(m, effective.get(m.userId), overrides.get(m.userId))),
    total,
  };
}

export async function getUserWhyChain(userId: string) {
  const user = await getUserBasic(userId);
  if (!user) throw httpError(404, "User not found.");
  const effective = await resolveAiAccessForUser({ id: user.id, role: user.role });
  if (user.role !== "student") {
    return { user: userView(user), effective: decisionView(effective), chain: [] };
  }

  const [ctxMap, rules] = await Promise.all([getUserAiContexts([userId]), listRules()]);
  const uctx = ctxMap.get(userId);
  const find = (t: AiRuleScopeType, id: string) =>
    rules.find((r) => r.scopeType === t && r.scopeId === id) ?? null;
  const batchIds = uctx?.batchIds ?? [];
  const wsIds = uctx?.wsIds ?? [];
  const tier = uctx?.tier ?? "free";
  const [batchNames, wsNames] = await Promise.all([
    getBatchNames(batchIds),
    getWorkspaceNames(wsIds),
  ]);

  const globalRow = find("global", "");
  const chain = [
    { level: "global", value: (globalRow ? (globalRow.oriEnabled ? "on" : "off") : "on") as RuleValue },
    { level: "user", value: ruleValueOf(find("user", userId)) },
    {
      level: "batch",
      rules: batchIds.map((id) => ({ id, name: batchNames.get(id) ?? id, value: ruleValueOf(find("batch", id)) })),
    },
    {
      level: "workspace",
      rules: wsIds.map((id) => ({ id, name: wsNames.get(id) ?? id, value: ruleValueOf(find("workspace", id)) })),
    },
    { level: "tier", tier, value: ruleValueOf(find("tier", tier)) },
  ];
  return { user: userView(user), effective: decisionView(effective), chain };
}
