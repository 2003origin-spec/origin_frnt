/**
 * Student-side join: redeem an organization code to enroll into the
 * corresponding workspace. The enrollment status starts as 'unassigned'
 * unless the code is batch-specific (Phase 6+); for Phase 3 the student
 * lands in the unassigned queue and waits for staff to place them in a batch.
 *
 * Feature A (admin-gated code access): when teacherCodeApproval is ON and the
 * workspace has a student_quota, redeeming is quota-enforced inside a per-
 * workspace FOR UPDATE transaction (race-safe): once the connected count would
 * exceed the quota the code is auto-revoked and the redeem is refused; the seat
 * that fills the quota disables the code proactively. A NULL quota (legacy /
 * ungranted) means unlimited — the pre-feature behaviour. See
 * V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getUserPostgresPool } from "@/server/user-postgres";

import { recordAuditEvent } from "./audit";
import { normalizeCode } from "./codes";
import { countConnectedStudents, setWorkspaceCodeAccess } from "./code-access-store";
import { enrollStudent } from "./enrollments";
import { findWorkspaceByActiveStudentJoinCode, revokeWorkspaceCode } from "./store";
import type { WorkspaceStudentEnrollment, TeacherWorkspace, WorkspaceCode } from "./types";

export class JoinCodeError extends Error {
  status: 400 | 404 | 409;
  constructor(status: 400 | 404 | 409, message: string) {
    super(message);
    this.status = status;
  }
}

export type JoinByCodeResult = {
  workspace: TeacherWorkspace;
  enrollment: WorkspaceStudentEnrollment;
  isNew: boolean;
};

/**
 * Whether redeeming will make the student newly occupy a seat. enrollStudent
 * only (re)connects a student who has no enrollment or whose status is 'left'
 * (its ON CONFLICT keeps 'active'/'unassigned'/'suspended' as-is), so only those
 * cases count against the quota. Pure — unit tested.
 */
export function wouldConsumeSeat(currentStatus: string | null): boolean {
  return currentStatus === null || currentStatus === "left";
}

async function finalizeJoin(
  workspace: TeacherWorkspace,
  enrollment: WorkspaceStudentEnrollment,
  isNew: boolean,
  studentId: string,
  requestId?: string | null,
): Promise<JoinByCodeResult> {
  if (isNew) {
    await recordAuditEvent({
      actorUserId: studentId,
      workspaceId: workspace.id,
      entityType: "workspace_student_enrollment",
      entityId: enrollment.id,
      action: "enrollment.created",
      after: enrollment,
      requestId,
    });
  }
  return { workspace, enrollment, isNew };
}

/**
 * Quota-enforced enrollment inside a per-workspace FOR UPDATE transaction so
 * concurrent redeems can't overshoot the cap. Throws JoinCodeError(409) (after
 * committing the code revoke) when the quota is full.
 */
async function enrollWithQuota(input: {
  workspace: TeacherWorkspace;
  code: WorkspaceCode;
  studentId: string;
  requestId?: string | null;
}): Promise<JoinByCodeResult> {
  const pool = getUserPostgresPool();
  if (!pool) {
    // Workspaces are Postgres-only, so a resolved workspace implies a pool.
    throw new JoinCodeError(409, "This workspace is not accepting enrollments right now.");
  }
  const client = await pool.connect();
  let outcome:
    | { kind: "ok"; enrollment: WorkspaceStudentEnrollment; isNew: boolean }
    | { kind: "blocked" };
  try {
    await client.query("BEGIN");
    // Serialise concurrent redeems for this workspace + read the live quota.
    const wsRes = await client.query(
      "SELECT student_quota FROM app.teacher_workspaces WHERE id = $1 FOR UPDATE",
      [input.workspace.id],
    );
    const rawQuota = wsRes.rows[0]?.student_quota;
    const quota = rawQuota === null || rawQuota === undefined ? null : Number(rawQuota);

    const curRes = await client.query(
      "SELECT status FROM app.workspace_student_enrollments WHERE workspace_id = $1 AND student_id = $2",
      [input.workspace.id, input.studentId],
    );
    const currentStatus = (curRes.rows[0]?.status as string | undefined) ?? null;

    if (quota !== null && wouldConsumeSeat(currentStatus)) {
      const connected = await countConnectedStudents(input.workspace.id, client);
      if (connected >= quota) {
        // Full — disable the code and refuse.
        await revokeWorkspaceCode(input.code.id, input.workspace.id, client);
        await setWorkspaceCodeAccess(input.workspace.id, { codeAccessStatus: "quota_filled" }, client);
        await client.query("COMMIT");
        outcome = { kind: "blocked" };
      } else {
        const enrolled = await enrollStudent({
          workspaceId: input.workspace.id,
          studentId: input.studentId,
          source: "code",
          joinCodeId: input.code.id,
          client,
        });
        // Proactively disable the code the moment this seat fills the quota.
        if (connected + 1 >= quota) {
          await revokeWorkspaceCode(input.code.id, input.workspace.id, client);
          await setWorkspaceCodeAccess(input.workspace.id, { codeAccessStatus: "quota_filled" }, client);
        }
        await client.query("COMMIT");
        outcome = { kind: "ok", enrollment: enrolled.enrollment, isNew: enrolled.isNew };
      }
    } else {
      // Unlimited (NULL quota) or an idempotent re-redeem by a connected student.
      const enrolled = await enrollStudent({
        workspaceId: input.workspace.id,
        studentId: input.studentId,
        source: "code",
        joinCodeId: input.code.id,
        client,
      });
      await client.query("COMMIT");
      outcome = { kind: "ok", enrollment: enrolled.enrollment, isNew: enrolled.isNew };
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (outcome.kind === "blocked") {
    throw new JoinCodeError(
      409,
      "This institute has reached its student limit. Please contact the institute for access.",
    );
  }
  return finalizeJoin(input.workspace, outcome.enrollment, outcome.isNew, input.studentId, input.requestId);
}

export async function joinByCode(input: {
  studentId: string;
  rawCode: string;
  requestId?: string | null;
}): Promise<JoinByCodeResult> {
  const trimmed = input.rawCode.trim();
  if (!trimmed) {
    throw new JoinCodeError(400, "Enter a join code.");
  }
  const normalized = normalizeCode(trimmed);
  if (!normalized) {
    throw new JoinCodeError(400, "Invalid join code format.");
  }
  const hit = await findWorkspaceByActiveStudentJoinCode(normalized);
  if (!hit) {
    throw new JoinCodeError(404, "We could not find an active workspace for that code.");
  }
  const { workspace, code } = hit;
  if (workspace.status === "suspended" || workspace.status === "closed") {
    throw new JoinCodeError(409, "This workspace is not accepting enrollments right now.");
  }

  // Feature A: enforce the admin-granted quota (race-safe) only when the flag is
  // on AND a quota is set. Grandfathered workspaces (NULL quota) skip enforcement.
  if (isFeatureEnabled("teacherCodeApproval") && workspace.studentQuota !== null) {
    return enrollWithQuota({ workspace, code, studentId: input.studentId, requestId: input.requestId });
  }

  const { enrollment, isNew } = await enrollStudent({
    workspaceId: workspace.id,
    studentId: input.studentId,
    source: "code",
    joinCodeId: code.id,
  });
  return finalizeJoin(workspace, enrollment, isNew, input.studentId, input.requestId);
}
