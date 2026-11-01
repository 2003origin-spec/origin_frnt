import { NextResponse } from "next/server";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { isNowSolver } from "@/server/now/teacher-entry";
import { dbFindUserById } from "@/server/db-users";
import { requireWorkspaceMember, requireWorkspaceOwnerOrAdmin } from "@/server/workspaces/authz";
import { listBatches } from "@/server/workspaces/batches";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { listWorkspaceImportJobs } from "@/server/workspaces/document-import-service";
import { listAccessibleWorkspaces } from "@/server/workspaces/service";
import { listCodesForWorkspace, listMembers } from "@/server/workspaces/store";
import { listTeacherRooms } from "@/server/workspaces/teacher-rooms";
import { listTeacherTests } from "@/server/workspaces/tests-service";

/**
 * Teacher endpoints for the app. The website builds these screens in server
 * components (teacher/workspaces/[id]/page.tsx), so the app gets them as one
 * call each; everything else the teacher app does uses the existing
 * /api/teacher/* REST routes with its Bearer token.
 */

/** The teacher's workspaces (with their role in each) and whether they're an Origin NOW tutor. */
export async function teacherMe(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth.role !== "teacher" && auth.role !== "admin") {
    return NextResponse.json({ detail: "This is for teacher accounts." }, { status: 403 });
  }
  const [workspaces, solver] = await Promise.all([
    isFeatureEnabled("workspaces") ? listAccessibleWorkspaces(auth.userId) : Promise.resolve([]),
    isFeatureEnabled("originNow") ? isNowSolver(auth.userId).catch(() => false) : Promise.resolve(false),
  ]);
  return NextResponse.json({
    workspaces: workspaces
      .filter((w) => w.memberStatus === "active")
      .map((w) => ({ id: w.id, displayName: w.displayName, workspaceType: w.workspaceType, status: w.status, role: w.role, city: w.city ?? null })),
    nowSolver: solver,
  });
}

export const isActiveRoom = (status: string) => status === "lobby" || status === "in_test";
export const isUpcomingTest = (status: string) => status === "scheduled" || status === "live";

/** The Today screen: what needs the teacher in one workspace. */
export async function teacherHome(request: Request, workspaceId: string): Promise<Response> {
  const ctx = await requireWorkspaceMember(request, workspaceId);
  const role = ctx.effectiveRole;
  // Join codes are owner/admin-only on the web (GET .../codes), so the code is shown to them only.
  const canSeeCode = role === "owner" || role === "admin" || role === "platform_admin";
  const [enrollments, imports, rooms, codes, tests, batches] = await Promise.all([
    listEnrollments(workspaceId, { status: "all" }),
    isFeatureEnabled("documentImport") ? listWorkspaceImportJobs(workspaceId).catch(() => []) : Promise.resolve([]),
    isFeatureEnabled("teacherRooms") ? listTeacherRooms(workspaceId).catch(() => []) : Promise.resolve([]),
    canSeeCode ? listCodesForWorkspace(workspaceId) : Promise.resolve([]),
    isFeatureEnabled("teacherTests") ? listTeacherTests(workspaceId, { status: "all" }) : Promise.resolve([]),
    listBatches(workspaceId, { status: "active" }),
  ]);
  const code = codes.find((c) => c.codeType === "student_join" && c.status === "active") ?? null;
  return NextResponse.json({
    workspace: { id: ctx.workspace.id, displayName: ctx.workspace.displayName, workspaceType: ctx.workspace.workspaceType, city: ctx.workspace.city ?? null },
    role,
    counts: {
      students: enrollments.filter((e) => e.status === "active").length,
      unassigned: enrollments.filter((e) => e.status === "unassigned").length,
      batches: batches.length,
      importsToReview: imports.filter((j) => j.status === "needs_review" || j.status === "failed").length,
    },
    joinCode: code ? { id: code.id, code: code.displayCode, expiresAt: code.expiresAt } : null,
    activeRooms: rooms
      .filter((r) => isActiveRoom(r.status))
      .map((r) => ({ id: r.id, name: r.name, status: r.status, batchId: r.batchId, startedAt: r.startedAt })),
    upcomingTests: tests
      .filter((t) => isUpcomingTest(t.status))
      .slice(0, 10)
      .map((t) => ({ id: t.id, title: t.title, status: t.status, subject: t.subject, totalQuestions: t.totalQuestions, durationMinutes: t.durationMinutes })),
    batches: batches.map((b) => ({ id: b.id, name: b.name, subject: b.subject, classLevel: b.classLevel, scheduleText: b.scheduleText })),
  });
}

/**
 * The workspace's staff with names (the web's settings page reads them in a
 * server component). Owner / admin only, like inviting and changing staff.
 */
export async function teacherMembers(request: Request, workspaceId: string): Promise<Response> {
  await requireWorkspaceOwnerOrAdmin(request, workspaceId);
  const members = (await listMembers(workspaceId)).filter((m) => m.status !== "removed");
  const users = await Promise.all(members.map((m) => dbFindUserById(m.userId).catch(() => null)));
  return NextResponse.json({
    members: members.map((m, i) => ({
      userId: m.userId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      name: users[i]?.name ?? null,
      email: users[i]?.email ?? null,
    })),
  });
}
