"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { csrfHeaders } from "@/lib/csrf";
import type { ImportJobQuestion, ImportJobWithProgress } from "@/server/workspaces/types";

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
}: {
  job: ImportJobWithProgress;
  questions: ImportJobQuestion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(question: ImportJobQuestion, action: "accept" | "reject") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/cbt/import-jobs/${job.id}/questions/${question.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
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

  function commitAll() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/cbt/import-jobs/${job.id}/commit`, {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(data.detail ?? `Could not push to bank (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  const pendingReview = questions.filter((q) => q.status === "draft" || q.status === "review_required");
  const done = questions.filter((q) => q.status === "published" || q.status === "accepted" || q.status === "rejected");
  // `accepted` = staged by the AI (or a manual accept) but NOT yet in the bank —
  // only `published` rows are in cbt.questions. These are the ones commitAll pushes.
  const stagedCount = questions.filter((q) => q.status === "accepted").length;
  const inBankCount = questions.filter((q) => q.status === "published").length;

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
        {stagedCount > 0 ? (
          <Button disabled={pending} onClick={commitAll}>
            {pending ? "Pushing…" : `Push ${stagedCount} to Questions bank`}
          </Button>
        ) : null}
      </header>

      {stagedCount > 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
          {stagedCount} accepted {stagedCount === 1 ? "question is" : "questions are"} staged but not
          yet in your Questions bank. Click “Push to Questions bank” to add them.
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}

      {job.status !== "succeeded" && job.status !== "needs_review" && pendingReview.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Extraction in progress. Refresh in a moment to review the questions.
        </p>
      ) : null}

      <ul className="space-y-3">
        {pendingReview.map((q) => (
          <li key={q.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-2 py-0.5">{q.questionType ?? "?"}</span>
              {q.subject ? <span>{q.subject}</span> : null}
              {q.confidenceScore != null ? <span>conf {Math.round(q.confidenceScore * 100)}%</span> : null}
            </div>
            <div className="text-sm text-foreground">
              <LatexRenderer content={q.questionText ?? ""} />
            </div>
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
              <Button size="sm" disabled={pending} onClick={() => act(q, "accept")}>
                Accept
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(q, "reject")}>
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
                <span className="truncate">{q.questionText}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
