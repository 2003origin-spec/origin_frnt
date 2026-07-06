export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { listCbtTests } from "@/server/cbt/cbt-tests-service";
import { CbtTestList } from "@/components/cbt/CbtTestList";

export default async function CbtTestsPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const tests = await listCbtTests(teacher.id);
  return <CbtTestList initialTests={tests} />;
}
