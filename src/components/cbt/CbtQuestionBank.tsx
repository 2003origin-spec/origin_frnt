"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { csrfHeaders } from "@/lib/csrf";
import type { CbtQuestion } from "@/lib/cbt/question-model";

import { CbtQuestionEditorDialog } from "./CbtQuestionEditorDialog";

const TYPE_BADGE: Record<string, string> = {
  mcq: "MCQ",
  msq: "MSQ",
  numerical: "Numerical",
  numerical_with_units: "Num+Units",
  symbolic_expression: "Symbolic",
  equation: "Equation",
  matrix_match: "Matrix",
  subjective: "Subjective",
};

export function CbtQuestionBank({ initialQuestions }: { initialQuestions: CbtQuestion[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove(question: CbtQuestion) {
    setError(null);
    if (!window.confirm("Delete this question?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/cbt/questions/${question.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(data.detail ?? `Delete failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Questions</h1>
          <p className="text-sm text-muted-foreground">{initialQuestions.length} in your bank</p>
        </div>
        <CbtQuestionEditorDialog />
      </header>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {initialQuestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No questions yet. Create one or import from a document.
        </div>
      ) : (
        <ul className="space-y-2">
          {initialQuestions.map((q) => (
            <li
              key={q.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {TYPE_BADGE[q.questionType] ?? q.questionType}
                  </span>
                  {q.subject ? <span className="text-xs text-muted-foreground">{q.subject}</span> : null}
                  {q.source === "imported" ? (
                    <span className="rounded bg-blue-500/15 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
                      imported
                    </span>
                  ) : null}
                </div>
                <div className="line-clamp-2 text-sm text-foreground">
                  <LatexRenderer content={q.stem} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CbtQuestionEditorDialog
                  initialQuestion={q}
                  trigger={
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  }
                />
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => remove(q)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
