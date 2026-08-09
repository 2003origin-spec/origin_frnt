export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { listCbtQuestions } from "@/server/cbt/cbt-questions-service";
import { listClusters, listQuestionClusterMap } from "@/server/cbt/cbt-clusters-service";
import { reconcileImportClusters } from "@/server/cbt/cbt-import-service";
import { CbtQuestionBank } from "@/components/cbt/CbtQuestionBank";

export default async function CbtQuestionsPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  // Ensure imported files show up as clusters in the filter (backfills older
  // imports that were committed to the bank without a cluster).
  await reconcileImportClusters(teacher);

  const [questions, clusters, membership] = await Promise.all([
    listCbtQuestions(teacher.id),
    listClusters(teacher.id),
    listQuestionClusterMap(teacher.id),
  ]);
  return (
    <CbtQuestionBank initialQuestions={questions} initialClusters={clusters} membershipByQuestion={membership} />
  );
}
