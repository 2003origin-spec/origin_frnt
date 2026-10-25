/**
 * Tenant-scoping decisions shared by the teacher services.
 *
 * Pure functions (no DB) so the rules are unit-testable in isolation; the
 * services load the owned / enrolled id sets and hand them in. Every refusal
 * is an AuthzError the teacher routes already map to a JSON response.
 *
 * Bug-fix refs: 11-new-teacher-admin N9 (cross-tenant batch targeting),
 * N10 (non-enrolled batch members), N12 (workspace create role gate + cap).
 */

import { AuthzError } from "@/server/authz";
import type { StoredUser } from "@/server/store";

/** Ids in `requested` that are not in `owned` (deduplicated, request order). */
export function findForeignIds(requested: string[], owned: Iterable<string>): string[] {
  const ownedSet = owned instanceof Set ? owned : new Set(owned);
  const seen = new Set<string>();
  const foreign: string[] = [];
  for (const id of requested) {
    if (ownedSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    foreign.push(id);
  }
  return foreign;
}

/** N9 — every targeted batch must belong to the acting workspace. */
export function assertBatchesBelongToWorkspace(
  requestedBatchIds: string[],
  workspaceBatchIds: Iterable<string>,
): void {
  if (findForeignIds(requestedBatchIds, workspaceBatchIds).length > 0) {
    throw new AuthzError(403, "One or more batches do not belong to this workspace.");
  }
}

/** N10 — a student can only be placed in a batch of a workspace they are enrolled in. */
export function assertStudentsEnrolled(
  requestedStudentIds: string[],
  enrolledStudentIds: Iterable<string>,
): void {
  if (findForeignIds(requestedStudentIds, enrolledStudentIds).length > 0) {
    throw new AuthzError(403, "One or more students are not enrolled in this workspace.");
  }
}

/**
 * N10 — which enrolment statuses may be (re)placed in a batch: every status
 * except `left`. `suspended` must stay assignable: it is how a lapsed
 * subscription is parked, and enrollStudent() keeps a suspended row as-is on
 * re-subscribe / marketplace payment / teacher re-add, so those flows revive
 * it through addStudentsToBatches (which then sets the enrolment active).
 * Ids with no enrolment row at all (foreign students) are still refused.
 */
export function isBatchAssignableEnrollmentStatus(status: string): boolean {
  return status === "unassigned" || status === "active" || status === "suspended";
}

/** N10 — the enrolled ids, from `{ student_id, status }` rows, that may be placed in a batch. */
export function batchAssignableStudentIds(
  rows: Array<{ student_id: string; status: string }>,
): string[] {
  return rows.filter((row) => isBatchAssignableEnrollmentStatus(row.status)).map((row) => row.student_id);
}

/** N12 — a single account may own at most this many (non-closed) workspaces. */
export const MAX_OWNED_WORKSPACES = 5;

/**
 * N12 — who may mint a teacher workspace through the raw API. Mirrors the
 * onboarding endpoint's role rule and adds the per-owner cap. Returns the
 * refusal to throw, or null when the create may proceed.
 */
export function evaluateWorkspaceCreate(input: {
  role: StoredUser["role"];
  ownedWorkspaceCount: number;
}): AuthzError | null {
  if (input.role !== "teacher" && input.role !== "admin") {
    return new AuthzError(403, "Only teacher or admin accounts can create workspaces.");
  }
  if (input.ownedWorkspaceCount >= MAX_OWNED_WORKSPACES) {
    return new AuthzError(
      409,
      `You already own ${MAX_OWNED_WORKSPACES} workspaces. Close one before creating another.`,
    );
  }
  return null;
}
