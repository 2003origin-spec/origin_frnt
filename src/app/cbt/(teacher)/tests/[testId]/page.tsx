export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { getCbtTest, listQuestionIdsUsedInOtherTests } from "@/server/cbt/cbt-tests-service";
import { listCbtQuestions } from "@/server/cbt/cbt-questions-service";
import { listClusters, listQuestionClusterMap } from "@/server/cbt/cbt-clusters-service";
import { CbtTestBuilder } from "@/components/cbt/CbtTestBuilder";

export default async function CbtTestBuilderPage({ params }: { params: Promise<{ testId: string }> }) {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const { testId } = await params;
  const [test, questions, clusters, membership, usedElsewhere] = await Promise.all([
    getCbtTest(teacher.id, testId),
    listCbtQuestions(teacher.id),
    listClusters(teacher.id),
    listQuestionClusterMap(teacher.id),
    listQuestionIdsUsedInOtherTests(teacher.id, testId),
  ]);
  if (!test) notFound();

  return (
    <CbtTestBuilder
      initialTest={test}
      allQuestions={questions}
      clusters={clusters}
      membershipByQuestion={membership}
      usedElsewhere={usedElsewhere}
    />
  );
}
