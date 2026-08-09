export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { QuestionBagManagerHighFidelity } from "@/components/teacher/QuestionBagManagerHighFidelity";
import { listTeacherQuestions } from "@/server/workspaces/questions-service";
import { getImportJobFileNames } from "@/server/workspaces/document-import-store";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function QuestionBagPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  
  const canEdit =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher" ||
    membership?.role === "content_manager";

  // Fetch all questions
  const questions = await listTeacherQuestions(workspaceId, { status: "all" });
  const importEnabled = isFeatureEnabled("documentImport");

  // Source-file labels for the "imported files" filter — resolved by the exact
  // import-job ids the questions carry (global by-id lookup, NOT workspace-scoped,
  // so a job under a different/older workspace still shows its real name instead
  // of a generic "Imported file"). Best effort: a failure just drops the filter.
  let importFiles: { id: string; name: string }[] = [];
  try {
    const jobIds = [
      ...new Set(questions.map((q) => q.importedJobId).filter((id): id is string => Boolean(id))),
    ];
    const nameById = await getImportJobFileNames(jobIds);
    importFiles = [...nameById.entries()]
      .filter(([, name]) => name.trim().length > 0)
      .map(([id, name]) => ({ id, name }));
  } catch {
    importFiles = [];
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      
      {/* Title & Import Pipeline trigger header */}
      <div className="flex justify-between items-center border-b pb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bag</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Author and publish question items to your workspace or contribute to the public OGCode database.
          </p>
        </div>
        {canEdit && importEnabled && (
          <Button asChild variant="outline" className="rounded-xl h-9">
            <Link href={`/teacher/workspaces/${workspaceId}/question-bag/import`}>
              Import from PDF
            </Link>
          </Button>
        )}
      </div>

      <QuestionBagManagerHighFidelity
        workspaceId={workspaceId}
        initialQuestions={questions}
        importFiles={importFiles}
        canEdit={canEdit}
      />
    </div>
  );
}