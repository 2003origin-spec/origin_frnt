export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { getCbtImportJob } from "@/server/cbt/cbt-import-service";
import { CbtImportReview } from "@/components/cbt/CbtImportReview";

export default async function CbtImportJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const { jobId } = await params;
  const result = await getCbtImportJob(teacher, jobId);
  if (!result) notFound();

  return <CbtImportReview job={result.job} questions={result.questions} />;
}
