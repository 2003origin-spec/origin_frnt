"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { mutateJson } from "@/lib/csrf";
import type { CbtQuestion, CbtQuestionInput } from "@/lib/cbt/question-model";
import type { ImportJobQuestion, ImportJobWithProgress } from "@/server/workspaces/types";

import { CbtQuestionEditorDialog } from "./CbtQuestionEditorDialog";

function optionTexts(options: Record<string, unknown> | null): string[] {
  if (!options) return [];
  const arr = Array.isArray(options) ? options : Object.values(options);
  return arr.map((o) =>
    typeof o === "string" ? o : String((o as { text?: unknown; label?: unknown })?.text ?? (o as { label?: unknown })?.label ?? o ?? ""),
  );
}

export function CbtImportReview({
  job,
  questions,
  editableByQuestion,
}: {
  job: ImportJobWithProgress;
  questions: ImportJobQuestion[];
  editableByQuestion: Record<string, CbtQuestion>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function act(question: ImportJobQuestion, action: "accept" | "reject") {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await mutateJson(`/api/cbt/import-jobs/${job.id}/questions/${question.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(data.detail ?? `Action failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  // Publish a single edited import question via the accept-override route. Shape
  // matches CbtQuestionEditorDialog's onCustomSubmit.
  async function publishOverride(questionId: string, payload: CbtQuestionInput): Promise<{ ok: boolean; detail?: string }> {
    const res = await mutateJson(`/api/cbt/import-jobs/${job.id}/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "accept", question: payload }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      return { ok: false, detail: data.detail ?? `Save failed (${res.status})` };
    }
    return { ok: true };
  }

  function commitAll() {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await mutateJson(`/api/cbt/import-jobs/${job.id}/commit`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { published?: number; failed?: number; detail?: string };
      if (!res.ok) {
        setError(data.detail ?? `Could not push to bank (${res.status})`);
        return;
      }
      setNote(
        data.failed
          ? `Pushed ${data.published ?? 0} to your bank. ${data.failed} couldn’t be added automatically — click Edit on each to fix its type/answer.`
          : `Pushed ${data.published ?? 0} to your Questions bank.`,
      );
      router.refresh();
    });
  }

  function createTest() {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await mutateJson(`/api/cbt/import-jobs/${job.id}/create-test`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string; testId?: string };
      if (!res.ok || !data.testId) {
        setError(data.detail ?? `Could not create the test (${res.status})`);
        return;
      }
      router.push(`/cbt/tests/${data.testId}`);
    });
  }

  const pendingReview = questions.filter((q) => q.status === "draft" || q.status === "review_required");
  const done = questions.filter((q) => q.status === "published" || q.status === "accepted" || q.status === "rejected");
  // `accepted` = staged by the AI (or a manual accept) but NOT yet in the bank —
  // only `published` rows are in cbt.questions. These are the ones commitAll pushes.
  const stagedCount = questions.filter((q) => q.status === "accepted").length;
  const inBankCount = questions.filter((q) => q.status === "published").length;

  function editTrigger(q: ImportJobQuestion, label = "Edit") {
    const initial = editableByQuestion[q.id];
    if (!initial) return null;
    return (
      <CbtQuestionEditorDialog
        initialQuestion={initial}
        onCustomSubmit={(payload) => publishOverride(q.id, payload)}
        dialogTitle="Edit & add to Questions bank"
        submitLabel="Save to bank"
        trigger={
          <Button size="sm" variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" disabled={pending}>
            {label}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{job.sourceFileName}</h1>
          <p className="text-sm text-muted-foreground">
            Status: {job.status} · {questions.length} extracted · {inBankCount} in bank
            {stagedCount > 0 ? ` · ${stagedCount} staged` : ""}
          </p>
        </div>
        {stagedCount + inBankCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {stagedCount > 0 ? (
              <Button variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" disabled={pending} onClick={commitAll}>
                {pending ? "Pushing…" : `Push ${stagedCount} to Questions bank`}
              </Button>
            ) : null}
            <Button className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" disabled={pending} onClick={createTest}>
              {pending ? "Working…" : "Create a test from these"}
            </Button>
          </div>
        ) : null}
      </header>

      {stagedCount > 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
          {stagedCount} accepted {stagedCount === 1 ? "question is" : "questions are"} staged but not
          yet in your Questions bank. Click “Push to Questions bank” to add them, or Edit any question to
          fix its type/answer first.
        </p>
      ) : null}

      {note ? <p className="text-xs text-emerald-600 dark:text-emerald-400">{note}</p> : null}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}

      {job.status !== "succeeded" && job.status !== "needs_review" && pendingReview.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Extraction in progress. Refresh in a moment to review the questions.
        </p>
      ) : null}

      <ul className="space-y-3">
        {pendingReview.map((q) => (
          <li key={q.id} className="neu-raised p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-2 py-0.5">{q.questionType ?? "?"}</span>
              {q.subject ? <span>{q.subject}</span> : null}
              {q.confidenceScore != null ? <span>conf {Math.round(q.confidenceScore * 100)}%</span> : null}
            </div>
            <div className="text-sm text-foreground">
              <LatexRenderer content={q.questionText ?? ""} />
            </div>
            {typeof q.metadata?.imageUrl === "string" && q.metadata.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.metadata.imageUrl}
                alt="Extracted diagram"
                className="mt-3 max-h-56 w-auto max-w-full rounded-lg object-contain"
              />
            ) : null}
            {optionTexts(q.options).length > 0 ? (
              <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">
                {optionTexts(q.options).map((opt, i) => (
                  <li key={i} className={q.correctOption === i ? "font-medium text-foreground" : ""}>
                    <LatexRenderer content={opt} />
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" disabled={pending} onClick={() => act(q, "accept")}>
                Accept
              </Button>
              {editTrigger(q)}
              <Button size="sm" variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" disabled={pending} onClick={() => act(q, "reject")}>
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {pendingReview.length === 0 && done.length > 0 ? (
        <p className="text-sm text-muted-foreground">All questions reviewed.</p>
      ) : null}

      {done.length > 0 ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Reviewed ({done.length})</h2>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {done.map((q) => (
              <li key={q.id} className="flex items-center gap-2">
                <span
                  className={
                    q.status === "rejected"
                      ? "rounded bg-muted px-1.5 py-0.5"
                      : q.status === "accepted"
                        ? "rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400"
                        : "rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400"
                  }
                >
                  {q.status === "accepted" ? "staged" : q.status === "published" ? "in bank" : q.status}
                </span>
                <span className="min-w-0 flex-1 truncate">{q.questionText}</span>
                {q.status === "accepted" ? editTrigger(q, "Edit") : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
