/**
 * Admin-side orchestration for Feature A — the /admin/teacher-code-requests
 * console. Lists code-access requests, approves one (sets the workspace quota +
 * AI rule and issues/reactivates the student_join code), or rejects one. Also
 * reads/writes the global support phone (D4). Contract mirrors
 * premium-access-admin-service: store DML → side effects → recordAuditEvent.
 * See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import { recordAuditEvent } from "./audit";
import {
  CodeAccessError,
  getCodeRequestById,
  listCodeRequestsWithContext,
  setWorkspaceCodeAccess,
  updateCodeRequestDecision,
  type CodeRequestStatus,
  type CodeRequestWithContext,
} from "./code-access-store";
import { createCode, generateDefaultPersonalCode } from "./codes";
import { activateWorkspaceCodeById, getWorkspaceById, listCodesForWorkspace } from "./store";
import { setAiAccessRule } from "@/server/ai-access-service";
import { createNotification } from "@/server/notifications";
import {
  getTeacherCodeSupportPhone,
  setTeacherCodeSupportPhone,
} from "@/server/platform-settings";
import type { TeacherWorkspace, WorkspaceCode } from "./types";

export async function listCodeAccessRequests(
  status?: CodeRequestStatus | "all",
): Promise<CodeRequestWithContext[]> {
  return listCodeRequestsWithContext({ status: status ?? "pending" });
}

/**
 * Pure decision (unit tested) for how to get an ACTIVE student_join code when
 * approving a request, preferring — in order — an existing active code, the
 * reserved (institute) code, a prior revoked/expired code's display value (so
 * already-shared codes keep working — D6), else a freshly generated default.
 */
export type CodeIssuanceDecision =
  | { kind: "reuse-active"; code: WorkspaceCode }
  | { kind: "activate-reserved"; codeId: string }
  | { kind: "reuse-display"; displayCode: string }
  | { kind: "generate" };

export function decideCodeIssuance(codes: WorkspaceCode[]): CodeIssuanceDecision {
  const active = codes.find((c) => c.status === "active");
  if (active) return { kind: "reuse-active", code: active };
  const reserved = codes.find((c) => c.status === "reserved");
  if (reserved) return { kind: "activate-reserved", codeId: reserved.id };
  const reusable = codes.find((c) => c.status === "revoked" || c.status === "expired");
  if (reusable) return { kind: "reuse-display", displayCode: reusable.displayCode };
  return { kind: "generate" };
}

async function issueOrReactivateStudentJoinCode(
  workspace: TeacherWorkspace,
  actorUserId: string,
  requestId?: string | null,
): Promise<WorkspaceCode> {
  const codes = await listCodesForWorkspace(workspace.id, "student_join");
  const decision = decideCodeIssuance(codes);

  if (decision.kind === "reuse-active") return decision.code;
  if (decision.kind === "activate-reserved") {
    const activated = await activateWorkspaceCodeById(decision.codeId, workspace.id);
    if (activated) return activated;
  }

  const rawDisplay =
    decision.kind === "reuse-display"
      ? decision.displayCode
      : generateDefaultPersonalCode(workspace.displayName).display;
  return createCode({
    workspaceId: workspace.id,
    createdBy: actorUserId,
    codeType: "student_join",
    rawDisplay,
    requestId,
    metadata: { source: "admin_code_grant" },
    status: "active",
  });
}

export type ApproveResult = {
  quota: number;
  aiAccess: boolean;
  code: WorkspaceCode;
  /** Set when the granted quota is below the currently-connected count. */
  warning: string | null;
};

/** Approves a pending request: sets quota + AI, issues/reactivates the code. */
export async function approveCodeRequest(input: {
  actorUserId: string;
  requestId: string;
  grantedQuota: number;
  aiAccess?: boolean;
  note?: string | null;
  requestIdHeader?: string | null;
}): Promise<ApproveResult> {
  const quota = Math.floor(input.grantedQuota);
  if (!Number.isFinite(quota) || quota <= 0) {
    throw new CodeAccessError(400, "Enter a valid student quota (a positive whole number).");
  }

  const request = await getCodeRequestById(input.requestId);
  if (!request || request.status !== "pending") {
    throw new CodeAccessError(409, "This request is no longer pending.");
  }
  const workspace = await getWorkspaceById(request.workspaceId);
  if (!workspace) throw new CodeAccessError(404, "Workspace not found.");

  const aiAccess = input.aiAccess ?? request.aiAccess;

  const code = await issueOrReactivateStudentJoinCode(workspace, input.actorUserId, input.requestIdHeader);

  await setWorkspaceCodeAccess(workspace.id, {
    codeAccessStatus: "granted",
    studentQuota: quota,
    codeAiAccess: aiAccess,
  });

  // Best-effort: govern the connected cohort's AI via a workspace-scope rule
  // (D5). 'on' forces AI on for this workspace's students; 'off' disables it. A
  // hiccup here must not fail the grant — the decision is also on the workspace.
  try {
    await setAiAccessRule(
      { userId: input.actorUserId },
      { scopeType: "workspace", scopeId: workspace.id, value: aiAccess ? "on" : "off" },
    );
  } catch (error) {
    console.error("[code-access] workspace AI rule set failed", error instanceof Error ? error.message : error);
  }

  await updateCodeRequestDecision({
    id: request.id,
    status: "approved",
    grantedQuota: quota,
    grantedCodeId: code.id,
    adminNote: input.note ?? null,
    decidedBy: input.actorUserId,
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: workspace.id,
    entityType: "teacher_code_request",
    entityId: request.id,
    action: "code_request.approved",
    after: { quota, aiAccess, codeId: code.id, displayCode: code.displayCode },
    requestId: input.requestIdHeader ?? null,
  });

  // Best-effort teacher notification.
  await createNotification(request.requestedBy, {
    type: "success",
    title: "Code access approved",
    message: `Your institute code is active for up to ${quota} students${aiAccess ? " (with AI access)" : ""}.`,
    href: `/teacher/workspaces/${workspace.id}`,
  });

  return { quota, aiAccess, code, warning: null };
}

/** Rejects a pending request. */
export async function rejectCodeRequest(input: {
  actorUserId: string;
  requestId: string;
  note?: string | null;
  requestIdHeader?: string | null;
}): Promise<void> {
  const request = await getCodeRequestById(input.requestId);
  if (!request || request.status !== "pending") {
    throw new CodeAccessError(409, "This request is no longer pending.");
  }

  await updateCodeRequestDecision({
    id: request.id,
    status: "rejected",
    adminNote: input.note ?? null,
    decidedBy: input.actorUserId,
  });

  const workspace = await getWorkspaceById(request.workspaceId);
  if (workspace && workspace.codeAccessStatus === "requested") {
    await setWorkspaceCodeAccess(request.workspaceId, { codeAccessStatus: "none" });
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: request.workspaceId,
    entityType: "teacher_code_request",
    entityId: request.id,
    action: "code_request.rejected",
    after: { note: input.note ?? null },
    requestId: input.requestIdHeader ?? null,
  });

  await createNotification(request.requestedBy, {
    type: "info",
    title: "Code access request update",
    message: input.note?.trim()
      ? `Your code-access request needs a follow-up: ${input.note.trim()}`
      : "Your code-access request was not approved. Please contact the team.",
    href: `/teacher/workspaces/${request.workspaceId}`,
  });
}

// ─── Support phone (D4) ────────────────────────────────────────────────────────

export async function getSupportPhone(): Promise<string | null> {
  return getTeacherCodeSupportPhone();
}

export async function setSupportPhone(input: {
  actorUserId: string;
  phone: string | null;
  requestIdHeader?: string | null;
}): Promise<string | null> {
  await setTeacherCodeSupportPhone(input.phone, input.actorUserId);
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "platform_setting",
    entityId: "teacher_code_support_phone",
    action: "setting.updated",
    after: { teacherCodeSupportPhone: input.phone },
    requestId: input.requestIdHeader ?? null,
  });
  return getTeacherCodeSupportPhone();
}
