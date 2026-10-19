/**
 * /teacher/workspaces/:id/now — the Origin NOW solver shift and dashboard
 * inside the teacher area (pilot readiness item 4, decision B83). Same screen
 * as /now/solver; only teachers who are approved solvers get here.
 */

import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-server";
import NowSolverDashboard from "@/sections/now/NowSolverDashboard";
import { isNowSolver } from "@/server/now/teacher-entry";

type Props = { params: Promise<{ workspaceId: string }> };

export default async function TeacherNowPage({ params }: Props) {
  const { workspaceId } = await params;
  if (!(await isNowSolver((await getServerUser())?.id))) {
    redirect(`/teacher/workspaces/${workspaceId}`);
  }
  return <NowSolverDashboard />;
}
