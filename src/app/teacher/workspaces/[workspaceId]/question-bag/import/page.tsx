import { ImportJobsManager } from "@/components/teacher/ImportJobsManager";
import { listWorkspaceImportJobs } from "@/server/workspaces/document-import-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function DocumentImportReviewPage({ params }: Props) {
  const { workspaceId } = await params;
  await loadWorkspaceForRender(workspaceId);

  // Fetch ingestion jobs
  const jobs = await listWorkspaceImportJobs(workspaceId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Ingestion Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review extracted text from uploaded PDF exam papers, align cropped figures, and approve questions.
        </p>
      </div>

      <ImportJobsManager
        workspaceId={workspaceId}
        initialJobs={jobs}
      />
    </div>
  );
}
