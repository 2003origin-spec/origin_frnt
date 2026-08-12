"use client";

/**
 * Build one paper out of several documents, topic groups and existing tests —
 * the Origin-teacher counterpart of CBT's source builder.
 *
 * Selection order IS paper order: the numbered chips show the stack, so a
 * teacher assembling "physics paper → thermodynamics topic → last term's mock"
 * gets those blocks in that sequence. Marks are per source, since a document of
 * single-correct questions and a topic group of numericals rarely carry the
 * same scheme. Overlaps are fine — a question picked twice keeps its first
 * position, which is also why reusing one question across several tests is
 * safe and expected.
 *
 * "Add to test" RESOLVES the stack server-side and drops the questions into the
 * wizard's existing cart, so the teacher can still reorder, re-mark and remove
 * individual questions before saving.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Boxes, FileText, FolderOpen, Layers, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/teacher-client";

import type { SelectedQuestion } from "./QuestionPicker";

type SourceKind = "import_job" | "bag_topic" | "test" | "cluster";

export type TestSourceOption = {
  kind: SourceKind;
  id: string;
  label: string;
  questionCount: number;
  note?: string;
};

type Picked = { kind: SourceKind; id: string; marks: string; negativeMarks: string };

type PerSource = {
  kind: SourceKind;
  id: string;
  added: number;
  duplicates: number;
  skipped: number;
  /** Present when the target test carries a full-mock blueprint (plan D6). */
  sectionId?: string;
  sectionLabel?: string;
};

const KIND_ICON: Record<SourceKind, typeof FileText> = {
  import_job: FileText,
  bag_topic: FolderOpen,
  test: Layers,
  cluster: Boxes,
};

const KIND_LABEL: Record<SourceKind, string> = {
  import_job: "Document",
  bag_topic: "Topic",
  test: "Test",
  cluster: "Cluster",
};

export function TestSourceStackPanel({
  workspaceId,
  testId,
  onResolved,
}: {
  /**
   * The test being built, when editing an existing one. Lets the server apply
   * that test's blueprint so stacked sources land in its sections (plan D6).
   */
  testId?: string;
  workspaceId: string;
  /** Receives the resolved questions to append to the wizard's cart. */
  onResolved: (questions: SelectedQuestion[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [options, setOptions] = useState<TestSourceOption[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SourceKind | "all">("all");

  useEffect(() => {
    if (!open || options.length > 0) return;
    let cancelled = false;
    void (async () => {
      // The flag is set inside the async body rather than in the effect body:
      // a synchronous setState there triggers a cascading render.
      setLoading(true);
      const res = await apiJson<{ sources: TestSourceOption[] }>(
        `/api/teacher/workspaces/${workspaceId}/tests?view=sources`,
      );
      if (cancelled) return;
      if (res.ok) setOptions(res.data.sources ?? []);
      else setError(res.detail || "Could not load your sources.");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, options.length, workspaceId]);

  const optionByKey = useMemo(() => {
    const map = new Map<string, TestSourceOption>();
    for (const o of options) map.set(`${o.kind}:${o.id}`, o);
    return map;
  }, [options]);

  const pickedKeys = useMemo(() => new Set(picked.map((p) => `${p.kind}:${p.id}`)), [picked]);
  const available = options.filter(
    (o) => !pickedKeys.has(`${o.kind}:${o.id}`) && (filter === "all" || o.kind === filter),
  );

  // An upper bound: overlapping sources de-duplicate server-side, so the real
  // total can only come out lower.
  const estimatedTotal = picked.reduce(
    (sum, p) => sum + (optionByKey.get(`${p.kind}:${p.id}`)?.questionCount ?? 0),
    0,
  );

  function move(index: number, dir: -1 | 1) {
    setPicked((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function resolve() {
    if (picked.length === 0) return;
    setError(null);
    setResolving(true);
    const res = await apiJson<{ questions: SelectedQuestion[]; perSource: PerSource[]; totalQuestions: number }>(
      `/api/teacher/workspaces/${workspaceId}/tests`,
      {
        method: "POST",
        json: {
          preview: true,
          testId,
          sources: picked.map((p) => ({
            kind: p.kind,
            id: p.id,
            marks: Number(p.marks) || 4,
            negativeMarks: -Math.abs(Number(p.negativeMarks) || 0),
          })),
        },
      },
    );
    setResolving(false);
    if (!res.ok) {
      setError(res.detail || "Could not build from those sources.");
      return;
    }

    onResolved(res.data.questions ?? []);

    // Say what actually happened rather than only "added N": overlaps and
    // OG-Code rows in a reused test are both silent surprises otherwise.
    const duplicates = res.data.perSource.reduce((s, p) => s + p.duplicates, 0);
    const skipped = res.data.perSource.reduce((s, p) => s + p.skipped, 0);
    const notes = [
      duplicates > 0 ? `${duplicates} duplicate${duplicates === 1 ? "" : "s"} merged` : "",
      skipped > 0 ? `${skipped} OG Code question${skipped === 1 ? "" : "s"} skipped` : "",
    ].filter(Boolean);
    toast.success(
      `Added ${res.data.totalQuestions} question${res.data.totalQuestions === 1 ? "" : "s"}` +
        (notes.length ? ` (${notes.join(", ")})` : ""),
    );
    setPicked([]);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/30"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers className="h-4 w-4 text-primary" />
          Build from documents
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Stack whole imported papers, Question-Bag topics and past tests into this paper instead of
          picking questions one by one.
        </span>
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers className="h-4 w-4 text-primary" />
          Build from documents
        </h3>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setOpen(false)} title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* The stack */}
      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Paper order ({picked.length} source{picked.length === 1 ? "" : "s"})
        </Label>
        {picked.length === 0 ? (
          <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Nothing picked yet. The order you pick them is the order their questions appear.
          </p>
        ) : (
          <ul className="space-y-2">
            {picked.map((p, i) => {
              const option = optionByKey.get(`${p.kind}:${p.id}`);
              const Icon = KIND_ICON[p.kind];
              return (
                <li
                  key={`${p.kind}:${p.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-xs"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{option?.label ?? p.id}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {option?.questionCount ?? 0} question{option?.questionCount === 1 ? "" : "s"}
                      {option?.note ? ` · ${option.note}` : ""}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    +
                    <Input
                      type="number"
                      value={p.marks}
                      onChange={(e) =>
                        setPicked((prev) => prev.map((r, j) => (j === i ? { ...r, marks: e.target.value } : r)))
                      }
                      className="h-7 w-14 px-2 text-xs"
                      aria-label="Marks per correct answer"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    −
                    <Input
                      type="number"
                      value={p.negativeMarks}
                      onChange={(e) =>
                        setPicked((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, negativeMarks: e.target.value } : r)),
                        )
                      }
                      className="h-7 w-14 px-2 text-xs"
                      aria-label="Negative marks"
                    />
                  </label>
                  <div className="flex items-center gap-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      title="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={i === picked.length - 1}
                      onClick={() => move(i, 1)}
                      title="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Available sources */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Add a source
          </Label>
          <div className="flex gap-1">
            {(["all", "import_job", "bag_topic", "test"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  filter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {k === "all" ? "All" : KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your sources…
          </p>
        ) : available.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {options.length === 0
              ? "Import a document or add questions to your bag first."
              : "Every matching source is already in the stack."}
          </p>
        ) : (
          <ul className="max-h-52 space-y-1.5 overflow-y-auto">
            {available.map((o) => {
              const Icon = KIND_ICON[o.kind];
              return (
                <li key={`${o.kind}:${o.id}`} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{o.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {o.questionCount} question{o.questionCount === 1 ? "" : "s"}
                        {o.note ? ` · ${o.note}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 shrink-0 p-0 text-primary"
                    onClick={() =>
                      setPicked((prev) => [
                        ...prev,
                        { kind: o.kind, id: o.id, marks: "4", negativeMarks: "1" },
                      ])
                    }
                    title="Add to stack"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-muted-foreground">
          {picked.length > 0 ? `Up to ${estimatedTotal} questions (duplicates are merged)` : ""}
        </p>
        <Button size="sm" disabled={resolving || picked.length === 0} onClick={() => void resolve()}>
          {resolving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Building…
            </>
          ) : (
            "Add to test"
          )}
        </Button>
      </div>
    </section>
  );
}
