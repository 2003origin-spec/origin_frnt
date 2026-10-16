import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/server/authz";
import { getSlugSegments, parseJsonBody } from "@/server/http";
import { inviteToCohort, listCohort, loadPriceTable, removeFromCohort, savePriceTable } from "@/server/now/admin-store";
import { getWalletBalance, listWalletMovements } from "@/server/now/ledger-store";
import { handleNowError, NowError, nowJson } from "@/server/now/now-http";
import { getNowSettings, prepareSettingsUpdate, saveNowSettings, type NowSettings } from "@/server/now/now-settings";
import {
  approveApplication,
  ensureBotHelper,
  getApplicationForAdmin,
  listApplicationsForAdmin,
  rejectApplication,
} from "@/server/now/solver-service";
import { getRecordingLinkForAdmin } from "@/server/now/room-service";
import { APPLICATION_STATUSES, DIFFICULTIES, SOLVER_KINDS } from "@/server/now/types";
import { adminAdjustWallet, listCoinPacks, upsertCoinPack } from "@/server/now/wallet-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

/**
 * Origin NOW admin API (plan: V1/ORIGIN_NOW_PLAN.md, "Admin controls").
 * One catch-all route file (plan decision B1). "/api/admin" is an
 * authenticated prefix; the admin role is enforced here. The admin surface is
 * NOT behind the `originNow` flag, so prices, packs and the cohort can be set
 * up before the feature is switched on.
 *
 *   GET  /api/admin/now/settings                 PUT  /api/admin/now/settings
 *   GET  /api/admin/now/prices                   PUT  /api/admin/now/prices
 *   GET  /api/admin/now/packs                    POST /api/admin/now/packs
 *   GET  /api/admin/now/cohort                   POST /api/admin/now/cohort    DELETE /api/admin/now/cohort/:userId
 *   GET  /api/admin/now/wallets/:userId          POST /api/admin/now/wallets/:userId/adjust
 *   GET  /api/admin/now/applications?status=     GET  /api/admin/now/applications/:id
 *   POST /api/admin/now/applications/:id/approve POST /api/admin/now/applications/:id/reject
 *   POST /api/admin/now/bot                      (creates the Origin bot's helper row, idempotent)
 *   POST /api/admin/now/sessions/:id/recording   { reason } → 10-minute link, logged `recording.accessed`
 */

type RouteContext = { params: Promise<{ slug?: string[] }> };
type Method = "GET" | "POST" | "PUT" | "DELETE";
type Handler = (request: NextRequest, adminId: string, params: string[]) => Promise<Response>;

const PriceRowSchema = z.object({
  difficulty: z.enum(DIFFICULTIES),
  solverKind: z.enum(SOLVER_KINDS),
  priceCoins: z.number().int(),
  minutes: z.number().int(),
  extensionMinutes: z.number().int(),
  extensionCoins: z.number().int(),
  maxExtensions: z.number().int(),
});

const PackSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  coins: z.number().int(),
  pricePaise: z.number().int(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const CohortSchema = z.object({ identifiers: z.array(z.string()).min(1).max(1000) });
const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
const ApproveSchema = z.object({ demoPassed: z.boolean(), level: z.enum(["trainee", "verified", "expert"]).optional() });
const RejectSchema = z.object({ reason: z.string().min(5).max(500) });
const AdjustSchema = z.object({ coins: z.number().int().positive(), reason: z.string().min(5).max(500) });
const RecordingAccessSchema = z.object({ reason: z.string().trim().min(5).max(300) });

async function audit(adminId: string, action: string, metadata: Record<string, unknown>): Promise<void> {
  await recordAuditEvent({
    actorUserId: adminId,
    workspaceId: null,
    entityType: "origin_now",
    entityId: action,
    action,
    after: metadata,
  }).catch(() => undefined);
}

const ROUTES: { method: Method; pattern: string[]; handler: Handler }[] = [
  { method: "GET", pattern: ["settings"], handler: async () => nowJson({ settings: await getNowSettings() }) },
  {
    method: "PUT",
    pattern: ["settings"],
    handler: async (request, adminId) => {
      const patch = await parseJsonBody<Partial<NowSettings>>(request);
      const prepared = prepareSettingsUpdate(patch);
      if (!prepared.ok) throw new NowError(400, "invalid", prepared.errors.join(" "));
      await saveNowSettings(prepared.pairs, adminId);
      await audit(adminId, "now.settings.update", { keys: prepared.pairs.map(([k]) => k) });
      return nowJson({ settings: await getNowSettings() });
    },
  },
  { method: "GET", pattern: ["prices"], handler: async () => nowJson(await loadPriceTable()) },
  {
    method: "PUT",
    pattern: ["prices"],
    handler: async (request, adminId) => {
      const rows = z.array(PriceRowSchema).parse((await parseJsonBody<{ rows: unknown }>(request)).rows);
      await savePriceTable(rows, adminId);
      await audit(adminId, "now.prices.update", { rows: rows.length });
      return nowJson(await loadPriceTable());
    },
  },
  { method: "GET", pattern: ["packs"], handler: async () => nowJson({ packs: await listCoinPacks({ includeInactive: true }) }) },
  {
    method: "POST",
    pattern: ["packs"],
    handler: async (request, adminId) => {
      const pack = await upsertCoinPack(PackSchema.parse(await parseJsonBody(request)));
      await audit(adminId, "now.packs.upsert", { packId: pack.id, coins: pack.coins, pricePaise: pack.pricePaise });
      return nowJson({ pack });
    },
  },
  {
    method: "GET",
    pattern: ["applications"],
    handler: async (request) => {
      const status = ApplicationStatusSchema.parse(request.nextUrl.searchParams.get("status") ?? "submitted");
      return nowJson({ applications: await listApplicationsForAdmin(status) });
    },
  },
  {
    method: "GET",
    pattern: ["applications", ":id"],
    handler: async (_request, _adminId, [id]) => nowJson({ application: await getApplicationForAdmin(id) }),
  },
  {
    method: "POST",
    pattern: ["applications", ":id", "approve"],
    handler: async (request, adminId, [id]) => {
      const body = ApproveSchema.parse(await parseJsonBody(request));
      const result = await approveApplication({ applicationId: id, adminId, demoPassed: body.demoPassed, level: body.level });
      await audit(adminId, "now.application.approve", { applicationId: id, helperId: result.helperId });
      return nowJson(result);
    },
  },
  {
    method: "POST",
    pattern: ["applications", ":id", "reject"],
    handler: async (request, adminId, [id]) => {
      const { reason } = RejectSchema.parse(await parseJsonBody(request));
      await rejectApplication({ applicationId: id, adminId, reason });
      await audit(adminId, "now.application.reject", { applicationId: id });
      return nowJson({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["bot"],
    handler: async (_request, adminId) => {
      const helperId = await ensureBotHelper();
      await audit(adminId, "now.bot.ensure", { helperId });
      return nowJson({ helperId });
    },
  },
  { method: "GET", pattern: ["cohort"], handler: async () => nowJson({ members: await listCohort() }) },
  {
    method: "POST",
    pattern: ["cohort"],
    handler: async (request, adminId) => {
      const { identifiers } = CohortSchema.parse(await parseJsonBody(request));
      const result = await inviteToCohort(identifiers, adminId);
      await audit(adminId, "now.cohort.invite", { invited: result.invited.length, notFound: result.notFound.length });
      return nowJson(result);
    },
  },
  {
    method: "DELETE",
    pattern: ["cohort", ":id"],
    handler: async (_request, adminId, [userId]) => {
      await removeFromCohort(userId);
      await audit(adminId, "now.cohort.remove", { userId });
      return nowJson({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["wallets", ":id"],
    handler: async (_request, _adminId, [userId]) =>
      nowJson({ balance: await getWalletBalance(userId), movements: await listWalletMovements(userId, 200) }),
  },
  {
    method: "POST",
    pattern: ["wallets", ":id", "adjust"],
    handler: async (request, adminId, [userId]) => {
      const { coins, reason } = AdjustSchema.parse(await parseJsonBody(request));
      await adminAdjustWallet({ userId, coins, reason, adminId });
      await audit(adminId, "now.wallet.adjust", { userId, coins, reason });
      return nowJson({ balance: await getWalletBalance(userId) });
    },
  },
  {
    // POST, not GET: opening a recording is an audited action with a stated reason.
    method: "POST",
    pattern: ["sessions", ":id", "recording"],
    handler: async (request, adminId, [sessionId]) => {
      const { reason } = RecordingAccessSchema.parse(await parseJsonBody(request));
      const link = await getRecordingLinkForAdmin(adminId, sessionId, reason);
      await audit(adminId, "now.recording.access", { sessionId, reason });
      return nowJson(link, { headers: { "Cache-Control": "no-store" } });
    },
  },
];

function match(method: Method, segments: string[]): { handler: Handler; params: string[] } | null {
  for (const route of ROUTES) {
    if (route.method !== method || route.pattern.length !== segments.length) continue;
    const params: string[] = [];
    const ok = route.pattern.every((part, i) => {
      if (part === ":id") {
        params.push(segments[i]);
        return true;
      }
      return part === segments[i];
    });
    if (ok) return { handler: route.handler, params };
  }
  return null;
}

async function dispatch(method: Method, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const auth = await requireAdmin(request);
    const found = match(method, getSlugSegments(await context.params));
    if (!found) throw new NowError(404, "not_found", "Not found.");
    return await found.handler(request, auth.userId, found.params);
  } catch (error) {
    return handleNowError(error, "admin now");
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return dispatch("PUT", request, context);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}
