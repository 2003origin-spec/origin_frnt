export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { listCbtTests } from "@/server/cbt/cbt-tests-service";
import { listCbtImportJobs } from "@/server/cbt/cbt-import-service";
import { listClusters } from "@/server/cbt/cbt-clusters-service";
import { countCbtQuestionsByImportJob } from "@/server/cbt/cbt-questions-service";
import { CbtTestList } from "@/components/cbt/CbtTestList";
import type { CbtTestSourceOption } from "@/components/cbt/CbtTestSourceBuilder";

export default async function CbtTestsPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const [tests, jobs, clusters, jobCounts] = await Promise.all([
    listCbtTests(teacher.id),
    listCbtImportJobs(teacher),
    listClusters(teacher.id),
    countCbtQuestionsByImportJob(teacher.id),
  ]);

  // Sources for the "build from sources" picker: imported documents first
  // (newest first, as listed), then clusters.
  const sourceOptions: CbtTestSourceOption[] = [
    ...jobs.map((job) => ({
      kind: "import_job" as const,
      id: job.id,
      label: job.sourceFileName || "Imported document",
      questionCount: jobCounts[job.id] ?? 0,
      // A job with nothing in the bank yet is still pickable — accepted
      // questions are committed when the test is built — but say why it reads 0.
      note: (jobCounts[job.id] ?? 0) === 0 ? `import ${job.status}` : undefined,
    })),
    ...clusters.map((cluster) => ({
      kind: "cluster" as const,
      id: cluster.id,
      label: cluster.name,
      questionCount: cluster.questionCount,
    })),
  ];

  return <CbtTestList initialTests={tests} sourceOptions={sourceOptions} />;
}
