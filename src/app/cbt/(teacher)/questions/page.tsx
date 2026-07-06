export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { listCbtQuestions } from "@/server/cbt/cbt-questions-service";
import { CbtQuestionBank } from "@/components/cbt/CbtQuestionBank";

export default async function CbtQuestionsPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const questions = await listCbtQuestions(teacher.id);
  return <CbtQuestionBank initialQuestions={questions} />;
}
