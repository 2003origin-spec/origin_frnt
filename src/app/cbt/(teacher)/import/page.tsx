export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { listCbtImportJobs } from "@/server/cbt/cbt-import-service";
import { CbtImportUpload } from "@/components/cbt/CbtImportUpload";

export default async function CbtImportPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const jobs = await listCbtImportJobs(teacher);
  return <CbtImportUpload initialJobs={jobs} />;
}
