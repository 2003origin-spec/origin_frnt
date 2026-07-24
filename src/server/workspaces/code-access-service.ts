/**
 * Orchestration for Feature A — admin-gated teacher code access (teacher side).
 * Assembles the state the teacher dashboard needs and handles request / cancel.
 * Admin approve/reject lives in code-access-admin-service. Quota enforcement at
 * redeem time lives in the join path (A4). Guarded by the teacherCodeApproval
 * flag at the API layer. See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import { recordAuditEvent } from "./audit";
import {
  cancelPendingRequest,
  countConnectedStudents,
  CodeAccessError,
  getPendingRequestForWorkspace,
  insertCodeRequest,
  setWorkspaceCodeAccess,
  type TeacherCodeRequest,
} from "./code-access-store";
import { getWorkspaceById, listCodesForWorkspace } from "./store";
import { getTeacherCodeSupportPhone } from "@/server/platform-settings";
import type { CodeAccessStatus } from "./types";

/** The maximum a teacher can request in one go — a sanity bound, not a policy. */
export const MAX_REQUEST_STUDENT_COUNT = 100_000;

/**
 * Validates + normalizes a requested student count (pure — unit tested).
 * Floors to an integer; rejects <= 0, non-finite, and above the sanity bound.
 */
export function normalizeRequestedStudentCount(raw: number): number {
  const count = Math.floor(raw);
  if (!Number.isFinite(count) || count <= 0) {
    throw new CodeAccessError(400, "Enter how many students you want to connect with.");
  }
  if (count > MAX_REQUEST_STUDENT_COUNT) {
    throw new CodeAccessError(400, `That's above the maximum of ${MAX_REQUEST_STUDENT_COUNT.toLocaleString()}.`);
  }
  return count;
}

export type CodeAccessState = {
  codeAccessStatus: CodeAccessStatus;
  studentQuota: number | null;
  connectedStudents: number;
  /** True once a quota is set and filled — the code is revoked, teacher blocked. */
  quotaFilled: boolean;
  /** The live student-join code, if one is active. */
  activeCode: { id: string; displayCode: string } | null;
  /** The teacher's open request, if any. */
  pendingRequest:
    | { id: string; requestedStudentCount: number; aiAccess: boolean; createdAt: string }
    | null;
  /** Admin-editable support number to discuss pricing (D4); null if unset. */
  supportPhone: string | null;
};

/** Everything the teacher dashboard needs to render the code-access section. */
export async function getCodeAccessState(workspaceId: string): Promise<CodeAccessState> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) throw new CodeAccessError(404, "Workspace not found.");

  const [codes, connectedStudents, pending, supportPhone] = await Promise.all([
    listCodesForWorkspace(workspaceId, "student_join"),
    countConnectedStudents(workspaceId),
    getPendingRequestForWorkspace(workspaceId),
    getTeacherCodeSupportPhone(),
  ]);

  const activeCode = codes.find((c) => c.status === "active") ?? null;
  const quota = workspace.studentQuota;
  const quotaFilled =
    quota !== null && connectedStudents >= quota && activeCode === null && workspace.codeAccessStatus === "quota_filled";

  return {
    codeAccessStatus: workspace.codeAccessStatus,
    studentQuota: quota,
    connectedStudents,
    quotaFilled,
    activeCode: activeCode ? { id: activeCode.id, displayCode: activeCode.displayCode } : null,
    pendingRequest: pending
      ? {
          id: pending.id,
          requestedStudentCount: pending.requestedStudentCount,
          aiAccess: pending.aiAccess,
          createdAt: pending.createdAt,
        }
      : null,
    supportPhone,
  };
}

export type CreateCodeRequestResult = {
  request: TeacherCodeRequest;
  supportPhone: string | null;
};

/**
 * Teacher requests code access: N students + AI on/off. One open request per
 * workspace (enforced by a partial unique index → CodeAccessError 409).
 */
export async function createCodeRequest(input: {
  workspaceId: string;
  actorUserId: string;
  studentCount: number;
  aiAccess: boolean;
  requestId?: string | null;
}): Promise<CreateCodeRequestResult> {
  const count = normalizeRequestedStudentCount(input.studentCount);

  const workspace = await getWorkspaceById(input.workspaceId);
  if (!workspace) throw new CodeAccessError(404, "Workspace not found.");

  const request = await insertCodeRequest({
    workspaceId: input.workspaceId,
    requestedBy: input.actorUserId,
    requestedStudentCount: count,
    aiAccess: input.aiAccess,
  });

  // Reflect "a request is open" only when there's no live grant to preserve; a
  // raise-quota request from a granted/quota_filled workspace keeps that label.
  if (workspace.codeAccessStatus === "none") {
    await setWorkspaceCodeAccess(input.workspaceId, { codeAccessStatus: "requested" });
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "teacher_code_request",
    entityId: request.id,
    action: "code_request.created",
    after: request,
    requestId: input.requestId ?? null,
  });

  return { request, supportPhone: await getTeacherCodeSupportPhone() };
}

/** Teacher cancels their own pending request. */
export async function cancelCodeRequest(input: {
  workspaceId: string;
  requestId: string;
  actorUserId: string;
  requestIdHeader?: string | null;
}): Promise<TeacherCodeRequest> {
  const cancelled = await cancelPendingRequest(input.workspaceId, input.requestId);
  if (!cancelled) throw new CodeAccessError(404, "No matching pending request to cancel.");

  const workspace = await getWorkspaceById(input.workspaceId);
  if (workspace && workspace.codeAccessStatus === "requested") {
    await setWorkspaceCodeAccess(input.workspaceId, { codeAccessStatus: "none" });
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "teacher_code_request",
    entityId: cancelled.id,
    action: "code_request.cancelled",
    before: cancelled,
    after: { ...cancelled, status: "cancelled" },
    requestId: input.requestIdHeader ?? null,
  });

  return cancelled;
}
