export const dynamic = "force-dynamic";

import { StudentsManagerHighFidelity } from "@/components/teacher/StudentsManagerHighFidelity";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listBatches } from "@/server/workspaces/batches";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import { getWorkspaceBatchMemberships } from "@/server/workspaces/student-directory-store";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceStudentsPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);

  // Batch memberships are roster data, not analytics — loaded unconditionally so
  // the directory shows REAL batch chips even with the deep-analytics flag off.
  // They replace the hash-derived placeholders this table used to render.
  const [enrollments, batches, memberships] = await Promise.all([
    listEnrollments(workspaceId, { status: "all" }),
    listBatches(workspaceId, { status: "active" }),
    getWorkspaceBatchMemberships(workspaceId).catch(() => new Map<string, string[]>()),
  ]);

  const canManage =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  const batchNameById = new Map(batches.map((batch) => [batch.id, batch.name]));
  const batchesByStudent: Record<string, Array<{ id: string; name: string }>> = {};
  for (const [studentId, batchIds] of memberships) {
    batchesByStudent[studentId] = batchIds
      .map((id) => {
        const name = batchNameById.get(id);
        return name ? { id, name } : null;
      })
      .filter((entry): entry is { id: string; name: string } => entry !== null);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students Directory</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Approve onboarding queue memberships, filter by batch rosters, and manage student statuses.
        </p>
      </div>

      <StudentsManagerHighFidelity
        workspaceId={workspaceId}
        students={enrollments}
        batches={batches}
        batchesByStudent={batchesByStudent}
        canManage={canManage}
        deepAnalyticsEnabled={isFeatureEnabled("teacherDeepAnalytics")}
      />
    </div>
  );
}
