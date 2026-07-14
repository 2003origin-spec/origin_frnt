export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { getCbtImportJob, importQuestionToCbtInput } from "@/server/cbt/cbt-import-service";
import type { CbtQuestion } from "@/lib/cbt/question-model";
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

  // Pre-map each extracted question into CBT-editor shape so the teacher can open
  // it, fix the type/answer (e.g. a missing numerical answer), and accept it.
  const editableByQuestion: Record<string, CbtQuestion> = {};
  for (const q of result.questions) {
    const input = importQuestionToCbtInput(q);
    editableByQuestion[q.id] = {
      id: q.id,
      teacherId: teacher.id,
      // importQuestionToCbtInput returns the loose CbtQuestionInput shape; the
      // runtime values are already valid CBT question fields, so coerce for the
      // strict CbtQuestion the editor dialog expects.
      questionType: input.questionType as CbtQuestion["questionType"],
      stem: input.stem,
      image: input.image ?? null,
      options: (input.options ?? []) as CbtQuestion["options"],
      answer: (input.answer ?? {}) as CbtQuestion["answer"],
      explanation: input.explanation ?? null,
      subject: input.subject ?? null,
      chapter: input.chapter ?? null,
      concept: input.concept ?? null,
      difficulty: input.difficulty ?? null,
      source: "imported",
      importJobId: jobId,
      createdAt: "",
      updatedAt: "",
    };
  }

  return (
    <CbtImportReview job={result.job} questions={result.questions} editableByQuestion={editableByQuestion} />
  );
}
