"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { MultiSelectDropdown } from "@/components/ui/multi-select";
import { mutateJson } from "@/lib/csrf";
import type { CbtQuestion } from "@/lib/cbt/question-model";
import type { CbtCluster } from "@/lib/cbt/cluster-model";

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

export function CbtQuestionBank({
  initialQuestions,
  initialClusters,
  membershipByQuestion,
}: {
  initialQuestions: CbtQuestion[];
  initialClusters: CbtCluster[];
  membershipByQuestion: Record<string, string[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Multi-select cluster/file filter — empty = All; multiple = union.
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Cluster-management actions (rename/delete/remove-from) target a single
  // cluster, so they light up only when exactly one is selected.
  const activeCluster = selectedClusters.length === 1 ? selectedClusters[0] : null;

  const clusterName = useMemo(
    () => new Map(initialClusters.map((c) => [c.id, c.name])),
    [initialClusters],
  );

  const visible = useMemo(() => {
    if (selectedClusters.length === 0) return initialQuestions;
    const set = new Set(selectedClusters);
    return initialQuestions.filter((q) => (membershipByQuestion[q.id] ?? []).some((cid) => set.has(cid)));
  }, [initialQuestions, membershipByQuestion, selectedClusters]);

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    const res = await mutateJson(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? `Request failed (${res.status})`);
      return false;
    }
    return true;
  }

  function remove(question: CbtQuestion) {
    setError(null);
    if (!window.confirm("Delete this question?")) return;
    startTransition(async () => {
      if (await call(`/api/cbt/questions/${question.id}`, "DELETE")) router.refresh();
    });
  }

  function createCluster() {
    setError(null);
    const name = window.prompt("New cluster name")?.trim();
    if (!name) return;
    startTransition(async () => {
      if (await call("/api/cbt/clusters", "POST", { name })) router.refresh();
    });
  }

  function renameActiveCluster() {
    if (!activeCluster) return;
    setError(null);
    const current = clusterName.get(activeCluster) ?? "";
    const name = window.prompt("Rename cluster", current)?.trim();
    if (!name || name === current) return;
    startTransition(async () => {
      if (await call(`/api/cbt/clusters/${activeCluster}`, "PATCH", { name })) router.refresh();
    });
  }

  function deleteActiveCluster() {
    if (!activeCluster) return;
    setError(null);
    if (!window.confirm("Delete this cluster? The questions themselves are kept.")) return;
    startTransition(async () => {
      if (await call(`/api/cbt/clusters/${activeCluster}`, "DELETE")) {
        setSelectedClusters([]);
        router.refresh();
      }
    });
  }

  function addSelectedTo(clusterId: string) {
    setError(null);
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      if (await call(`/api/cbt/clusters/${clusterId}/members`, "POST", { questionIds: ids })) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function removeFromActive(questionId: string) {
    if (!activeCluster) return;
    setError(null);
    startTransition(async () => {
      if (await call(`/api/cbt/clusters/${activeCluster}/members`, "DELETE", { questionId })) router.refresh();
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Questions</h1>
          <p className="text-sm text-muted-foreground">
            {initialQuestions.length} in your bank
            {activeCluster ? ` · ${visible.length} in “${clusterName.get(activeCluster)}”` : ""}
          </p>
        </div>
        <CbtQuestionEditorDialog />
      </header>

      {/* Cluster / file filter — multi-select union (empty = All) */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectDropdown
          allLabel={`All files (${initialQuestions.length})`}
          selected={selectedClusters}
          onChange={setSelectedClusters}
          buttonClassName="min-w-48"
          options={initialClusters.map((c) => ({ value: c.id, label: c.name, count: c.questionCount }))}
        />
        <button
          onClick={createCluster}
          disabled={pending}
          className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
        >
          + New cluster
        </button>
        {activeCluster ? (
          <span className="ml-1 flex gap-2">
            <button onClick={renameActiveCluster} disabled={pending} className="text-xs text-muted-foreground underline">
              Rename
            </button>
            <button onClick={deleteActiveCluster} disabled={pending} className="text-xs text-destructive underline">
              Delete cluster
            </button>
          </span>
        ) : null}
        {selectedClusters.length > 1 ? (
          <span className="text-[11px] text-muted-foreground">Select one file to rename or delete it.</span>
        ) : null}
      </div>

      {/* Selection toolbar */}
      {selected.size > 0 ? (
        <div className="neu-raised flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          {initialClusters.length > 0 ? (
            <select
              className="neu-inset rounded-lg bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/30"
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                if (e.target.value) addSelectedTo(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Add to cluster…
              </option>
              {initialClusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-muted-foreground">Create a cluster first to group these.</span>
          )}
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground underline">
            Clear
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="neu-inset rounded-2xl border border-dashed border-border/50 p-10 text-center text-muted-foreground">
          {activeCluster ? "No questions in this cluster yet." : "No questions yet. Create one or import from a document."}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((q) => (
            <li
              key={q.id}
              className="neu-raised flex items-start justify-between gap-4 p-4"
            >
              <div className="flex min-w-0 gap-3">
                <input
                  type="checkbox"
                  className="mt-1 shrink-0"
                  checked={selected.has(q.id)}
                  onChange={() => toggleSelected(q.id)}
                  aria-label="Select question"
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {TYPE_BADGE[q.questionType] ?? q.questionType}
                    </span>
                    {q.subject ? <span className="text-xs text-muted-foreground">{q.subject}</span> : null}
                    {q.source === "imported" ? (
                      <span className="rounded bg-blue-500/15 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
                        imported
                      </span>
                    ) : null}
                    {(membershipByQuestion[q.id] ?? []).map((cid) => (
                      <span key={cid} className="rounded bg-violet-500/15 px-2 py-0.5 text-xs text-violet-600 dark:text-violet-400">
                        {clusterName.get(cid) ?? "cluster"}
                      </span>
                    ))}
                  </div>
                  <div className="line-clamp-2 text-sm text-foreground">
                    <LatexRenderer content={q.stem} />
                  </div>
                  {q.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.image} alt="" className="mt-2 max-h-28 w-auto max-w-full rounded-md object-contain" />
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {activeCluster ? (
                  <Button size="sm" variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" disabled={pending} onClick={() => removeFromActive(q.id)}>
                    Remove
                  </Button>
                ) : null}
                <CbtQuestionEditorDialog
                  initialQuestion={q}
                  trigger={
                    <Button size="sm" variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5">
                      Edit
                    </Button>
                  }
                />
                <Button size="sm" variant="destructive" className="shadow-lg shadow-red-600/20 transition-transform hover:-translate-y-0.5" disabled={pending} onClick={() => remove(q)}>
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
