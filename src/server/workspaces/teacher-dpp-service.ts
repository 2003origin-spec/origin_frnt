/**
 * Teacher test → batch DPP shares.
 * Plan: V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md (Phase 2)
 *
 * A teacher pushes an authored test to their batches as a DPP. The share is
 * stored once, batch-scoped; each student's personal DPP row is materialized
 * lazily on read (src/server/teacher-dpp-materializer.ts) so roster changes
 * propagate and a revoke stays a one-row operation.
 */

import { AuthzError } from "@/server/authz";
import { getUserPostgresPool } from "@/server/user-postgres";

import { recordAuditEvent } from "./audit";
import { listBatches } from "./batches";
import { createTeacherDppShareId } from "./ids";
import {
  deleteExpiredTeacherDppShares,
  getTeacherDppShare,
  insertTeacherDppShare,
  listActiveTeacherDppSharesForStudent,
  listLiveSharedBatchIdsForTest,
  listTeacherDppSharesForWorkspace,
  revokeTeacherDppShareRow,
} from "./teacher-dpp-store";
import { getTestWithQuestions } from "./tests-store";
import { getWorkspaceById } from "./store";
import type {
  TeacherDppQuestionMarks,
  TeacherDppShare,
  TeacherDppShareForStudent,
  TestQuestion,
} from "./types";

/** A shared DPP lives for 30 days, then the sweeper removes it. */
export const TEACHER_DPP_LIFETIME_DAYS = 30;

/** Only a test with a settled question set can be shared — never a draft. */
const SHAREABLE_TEST_STATUSES = new Set(["published", "scheduled", "live", "closed"]);

export function isTestShareableAsDpp(status: string): boolean {
  return SHAREABLE_TEST_STATUSES.has(status);
}

/**
 * Ordered question-id snapshot for a share (decision D5).
 *
 * A test row carries either an OG Code id or a Question Bag (content.questions)
 * id depending on `sourceBank`; buildQuestionLookup already resolves both
 * families, so a mixed-source test needs no extra plumbing. Positions are
 * preserved and duplicates dropped — analytics.dpp_questions is keyed on
 * (dpp_id, position) and a repeated question would render twice.
 */
export function resolveShareQuestionIds(questions: TestQuestion[]): string[] {
  return resolveShareQuestions(questions).questionIds;
}

/**
 * Ordered question-id snapshot PLUS the per-question marks the teacher assigned
 * in the source test (decision D1), so a correct answer in the shared DPP is
 * worth exactly what it was worth in the test. The two arrays are parallel by
 * construction — they are built in the same pass, which is what the scoring
 * override relies on.
 */
export function resolveShareQuestions(questions: TestQuestion[]): {
  questionIds: string[];
  questionMarks: TeacherDppQuestionMarks[];
} {
  const ordered = [...questions].sort((a, b) => a.position - b.position);
  const seen = new Set<string>();
  const questionIds: string[] = [];
  const questionMarks: TeacherDppQuestionMarks[] = [];
  for (const question of ordered) {
    const id =
      question.sourceBank === "ogcode"
        ? question.ogcodeQuestionId
        : question.contentQuestionId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    questionIds.push(id);
    questionMarks.push({
      m: Number.isFinite(question.marks) ? question.marks : 4,
      // Stored as-is: a teacher who set 0 negative marks gets no negative
      // marking in the DPP either. Their number always wins (decision D2).
      n: Number.isFinite(question.negativeMarks) ? question.negativeMarks : 0,
    });
  }
  return { questionIds, questionMarks };
}

/**
 * Narrows the requested batch ids to the ones we may actually share to, and
 * explains every rejection. Pure so the rules are unit-testable without a DB.
 */
export function resolveShareableBatchIds(input: {
  requested: string[];
  workspaceBatchIds: string[];
  alreadyLiveBatchIds: string[];
}): { accepted: string[]; unknown: string[]; duplicates: string[] } {
  const owned = new Set(input.workspaceBatchIds);
  const live = new Set(input.alreadyLiveBatchIds);
  const accepted: string[] = [];
  const unknown: string[] = [];
  const duplicates: string[] = [];
  for (const batchId of [...new Set(input.requested)]) {
    if (!owned.has(batchId)) unknown.push(batchId);
    else if (live.has(batchId)) duplicates.push(batchId);
    else accepted.push(batchId);
  }
  return { accepted, unknown, duplicates };
}

export function teacherDppExpiryFrom(now: Date): string {
  return new Date(now.getTime() + TEACHER_DPP_LIFETIME_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Institute branding for the highlighted student card (decision D6). Resolved
 * once at share time and stored on the share, so a later logo re-upload cannot
 * break an in-flight DPP and the student read path needs no USER-pool lookup.
 * The logo is optional — the card falls back to the name alone.
 */
async function resolveInstituteBranding(
  workspaceId: string,
): Promise<{ displayName: string; logoUrl: string | null }> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) throw new AuthzError(404, "Workspace not found.");

  let logoUrl: string | null = null;
  if (workspace.logoAssetId) {
    try {
      const p = getUserPostgresPool();
      const result = await p?.query(
        `SELECT public_url FROM content.assets WHERE id = $1`,
        [workspace.logoAssetId],
      );
      logoUrl = (result?.rows[0]?.public_url as string | null) ?? null;
    } catch (error) {
      // Branding is decoration — never fail a share because the logo lookup did.
      console.error("[teacher-dpp] logo lookup failed", { workspaceId, error });
    }
  }

  return { displayName: workspace.displayName, logoUrl };
}

export async function shareTestAsDpp(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  batchIds: string[];
  requestId?: string | null;
}): Promise<TeacherDppShare> {
  const test = await getTestWithQuestions(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (!isTestShareableAsDpp(test.status)) {
    throw new AuthzError(400, "Publish the test before sharing it as a DPP.");
  }

  const { questionIds, questionMarks } = resolveShareQuestions(test.questions);
  if (questionIds.length === 0) {
    throw new AuthzError(400, "This test has no questions to share.");
  }

  const [batches, alreadyLiveBatchIds] = await Promise.all([
    listBatches(input.workspaceId, { status: "active" }),
    listLiveSharedBatchIdsForTest(input.workspaceId, input.testId),
  ]);

  const { accepted, unknown, duplicates } = resolveShareableBatchIds({
    requested: input.batchIds,
    workspaceBatchIds: batches.map((batch) => batch.id),
    alreadyLiveBatchIds,
  });

  if (unknown.length > 0) {
    throw new AuthzError(403, "One or more batches do not belong to this workspace.");
  }
  if (accepted.length === 0) {
    throw new AuthzError(
      400,
      duplicates.length > 0
        ? "This test is already shared as a live DPP with the selected batches."
        : "Select at least one batch.",
    );
  }

  const branding = await resolveInstituteBranding(input.workspaceId);

  const share = await insertTeacherDppShare({
    id: createTeacherDppShareId(),
    workspaceId: input.workspaceId,
    testId: input.testId,
    title: test.title,
    subject: test.subject,
    summary: test.description,
    durationMinutes: test.durationMinutes,
    questionIds,
    questionMarks,
    teacherDisplayName: branding.displayName,
    teacherLogoUrl: branding.logoUrl,
    sharedBy: input.actorUserId,
    expiresAt: teacherDppExpiryFrom(new Date()),
    batchIds: accepted,
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "teacher_dpp_share",
    entityId: share.id,
    action: "test.shared_as_dpp",
    after: share,
    requestId: input.requestId,
  });

  return share;
}

export async function listTeacherDppShares(
  workspaceId: string,
  filter?: { testId?: string; liveOnly?: boolean },
): Promise<TeacherDppShare[]> {
  return listTeacherDppSharesForWorkspace(workspaceId, filter);
}

export async function revokeTeacherDppShare(input: {
  actorUserId: string;
  workspaceId: string;
  shareId: string;
  requestId?: string | null;
}): Promise<void> {
  const share = await getTeacherDppShare(input.workspaceId, input.shareId);
  if (!share) throw new AuthzError(404, "Shared DPP not found.");

  const revoked = await revokeTeacherDppShareRow(input.workspaceId, input.shareId);
  if (!revoked) return; // already revoked — idempotent

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "teacher_dpp_share",
    entityId: input.shareId,
    action: "test.dpp_share_revoked",
    before: share,
    requestId: input.requestId,
  });
}

export async function listActiveTeacherDppSharesFor(
  studentId: string,
): Promise<TeacherDppShareForStudent[]> {
  return listActiveTeacherDppSharesForStudent(studentId);
}

export async function deleteSweptTeacherDppShares(limit: number): Promise<string[]> {
  return deleteExpiredTeacherDppShares(limit);
}
