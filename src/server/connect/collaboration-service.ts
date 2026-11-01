/**
 * Collaboration service (Phase 14, section A + D).
 *
 * Teachers REQUEST a collaboration from their institute workspace settings; a
 * platform admin APPROVES (or pauses/terminates/rejects) it. Every state change
 * is audited via recordAuditEvent. Both enrollment flows are gated on
 * isActiveCollaborator().
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "@/server/workspaces/audit";
import { getActiveMembership, getWorkspaceById } from "@/server/workspaces/store";

import { revokeConnectGrantsForWorkspaces } from "./grant-revocation";
import {
  getCollaborationByWorkspace,
  isActiveCollaboration,
  listCollaborations,
  setCollaborationStatus,
  upsertCollaborationRequest,
  type Collaboration,
  type CollaborationFlow,
  type CollaborationStatus,
  type CollaborationWithWorkspace,
} from "./collaboration-store";

const TEACHER_ADMIN_ROLES = new Set(["owner", "admin"]);

/**
 * Auto-approve toggle. **Default OFF** (manual admin approval — what the
 * phase14-collaboration test expects). Set `CONNECT_AUTO_APPROVE=1` to make a
 * teacher's request go live immediately with no admin login. Reversible by
 * unsetting the env; the admin panel can still pause/terminate. See
 * PREMIUM_AND_TEACHER_CONNECTION_PLAN.md Phase 2F.4.
 */
function isConnectAutoApproveEnabled(): boolean {
  const raw = process.env.CONNECT_AUTO_APPROVE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

/**
 * Deployed production (not a preview, not local dev). Same signals as
 * src/lib/rate-limit.ts and /api/health use.
 */
function isHostedProduction(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    Boolean(process.env.FLY_APP_NAME) ||
    process.env.ORIGIN_DEPLOYMENT_ENV === "production"
  );
}

const AUTO_APPROVE_PROD_WARNING =
  "[connect] CONNECT_AUTO_APPROVE is ON in hosted production: any self-registered teacher's " +
  "institute becomes an ACTIVE collaborator (Flow 1 + Flow 2 enabled) the moment they click " +
  "Request, with no admin review — every student who redeems its join code gets a free subject. " +
  "This is a business decision; unset CONNECT_AUTO_APPROVE to require approval in /admin/collaborations.";

/**
 * Loud, non-blocking warning when auto-approve is on in hosted production.
 * Behaviour is unchanged (it is a business decision); this only makes sure it
 * is a visible one. Logged once per server process at module load ("boot"),
 * and again on every auto-approval it actually performs.
 */
export function warnIfAutoApproveInProduction(): boolean {
  if (!isConnectAutoApproveEnabled() || !isHostedProduction()) return false;
  console.warn(AUTO_APPROVE_PROD_WARNING);
  return true;
}

declare global {
  var __originConnectAutoApproveWarned: boolean | undefined;
}
if (!globalThis.__originConnectAutoApproveWarned) {
  globalThis.__originConnectAutoApproveWarned = true;
  warnIfAutoApproveInProduction();
}

/**
 * True iff the workspace is a live collaborator (status active + institute +
 * active workspace) and, when `flow` is given, that flow's admin toggle is on.
 */
export async function isActiveCollaborator(
  workspaceId: string,
  flow?: CollaborationFlow,
): Promise<boolean> {
  return isActiveCollaboration(workspaceId, flow);
}

/**
 * Throws 403 unless the workspace is a live collaborator — and, with `flow`,
 * unless that enrollment flow is enabled for it. Flow 1 = code redeem + free
 * subject pick; Flow 2 = paid batch checkout.
 */
export async function assertActiveCollaborator(
  workspaceId: string,
  flow?: CollaborationFlow,
): Promise<void> {
  if (await isActiveCollaborator(workspaceId, flow)) return;
  if (flow && (await isActiveCollaborator(workspaceId))) {
    throw new AuthzError(
      403,
      flow === "flow1"
        ? "This institute is not accepting ORIGIN code redemptions right now."
        : "This institute is not accepting paid enrollments through ORIGIN right now.",
    );
  }
  throw new AuthzError(403, "This institute is not an active ORIGIN collaborator.");
}

/**
 * Teacher-initiated request to become an ORIGIN collaborator. Requires the actor
 * to be an owner/admin of an `institute` workspace. Idempotent — re-requesting an
 * existing collaboration returns it unchanged.
 */
export async function requestCollaboration(input: {
  workspaceId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<Collaboration> {
  const workspace = await getWorkspaceById(input.workspaceId);
  if (!workspace) throw new AuthzError(404, "Workspace not found.");
  if (workspace.workspaceType !== "institute") {
    throw new AuthzError(400, "Only institute workspaces can request a collaboration.");
  }
  const membership = await getActiveMembership(input.workspaceId, input.actorUserId);
  if (!membership || membership.status !== "active" || !TEACHER_ADMIN_ROLES.has(membership.role)) {
    throw new AuthzError(403, "Only the institute owner or an admin can request a collaboration.");
  }

  const { collaboration, created } = await upsertCollaborationRequest({
    workspaceId: input.workspaceId,
    requestedBy: input.actorUserId,
  });

  if (created) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "origin_collaboration",
      entityId: collaboration.id,
      action: "collaboration.requested",
      after: collaboration,
      requestId: input.requestId,
    });
  }

  // Auto-approve (launch default in prod via CONNECT_AUTO_APPROVE=1): take the
  // request live immediately with both enrollment flows enabled — no admin login
  // required. Reversible by unsetting the env; the admin panel can still
  // pause/terminate. Only acts on a freshly-`pending` row so it never reopens a
  // paused/terminated lifecycle.
  if (collaboration.status === "pending" && isConnectAutoApproveEnabled()) {
    warnIfAutoApproveInProduction();
    return setCollaborationStatusService({
      workspaceId: input.workspaceId,
      status: "active",
      adminUserId: input.actorUserId,
      flow1Enabled: true,
      flow2Enabled: true,
      requestId: input.requestId,
    });
  }

  return collaboration;
}

/** Read the current collaboration for a workspace (teacher settings + admin). */
export async function getCollaboration(workspaceId: string): Promise<Collaboration | null> {
  return getCollaborationByWorkspace(workspaceId);
}

/** Admin list of collaborations (optionally filtered by status). */
export async function listCollaborationsService(filter?: {
  status?: CollaborationStatus | "all";
}): Promise<CollaborationWithWorkspace[]> {
  return listCollaborations(filter);
}

/**
 * Platform-admin transition of a collaboration's lifecycle. `approveCollaboration`
 * is the common case (→ active); pause/terminate/reject reuse the same path.
 */
export async function setCollaborationStatusService(input: {
  workspaceId: string;
  status: CollaborationStatus;
  adminUserId: string;
  commissionBps?: number | null;
  razorpayRouteAccountId?: string | null;
  flow1Enabled?: boolean | null;
  flow2Enabled?: boolean | null;
  requestId?: string | null;
}): Promise<Collaboration> {
  const before = await getCollaborationByWorkspace(input.workspaceId);
  if (!before) throw new AuthzError(404, "No collaboration request found for this workspace.");

  const updated = await setCollaborationStatus(input.workspaceId, {
    status: input.status,
    approvedBy: input.adminUserId,
    commissionBps: input.commissionBps,
    razorpayRouteAccountId: input.razorpayRouteAccountId,
    flow1Enabled: input.flow1Enabled,
    flow2Enabled: input.flow2Enabled,
  });
  if (!updated) throw new Error("Failed to update collaboration status.");

  await recordAuditEvent({
    actorUserId: input.adminUserId,
    workspaceId: input.workspaceId,
    entityType: "origin_collaboration",
    entityId: updated.id,
    action: `collaboration.${input.status}`,
    before,
    after: updated,
    requestId: input.requestId,
  });

  // Ending the partnership ends the free Flow-1 subjects it issued. `paused`
  // is reversible and keeps them (new grants are refused while paused, since
  // the active-collaboration gate fails); terminated/rejected are final.
  if (input.status === "terminated" || input.status === "rejected") {
    await revokeConnectGrantsForWorkspaces({
      workspaceIds: [input.workspaceId],
      actorUserId: input.adminUserId,
      reason: input.status === "terminated" ? "collaboration_terminated" : "collaboration_rejected",
      requestId: input.requestId,
    });
  }

  return updated;
}

export async function approveCollaboration(input: {
  workspaceId: string;
  adminUserId: string;
  commissionBps?: number | null;
  razorpayRouteAccountId?: string | null;
  requestId?: string | null;
}): Promise<Collaboration> {
  return setCollaborationStatusService({ ...input, status: "active" });
}
