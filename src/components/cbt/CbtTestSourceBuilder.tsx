"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mutateJson } from "@/lib/csrf";
import {
  DEFAULT_SOURCE_MARKS,
  DEFAULT_SOURCE_NEGATIVE_MARKS,
  type CbtTestSourceKind,
} from "@/lib/cbt/source-stack";

/**
 * Build one paper out of several imported documents and/or clusters.
 *
 * Selection order IS paper order: the numbered chips show the stack, so a
 * teacher assembling "physics doc → thermo cluster → chemistry doc" gets those
 * sections in that sequence. Marks are per source, since a document of
 * single-correct questions and a cluster of numericals rarely carry the same
 * scheme. Overlaps are fine — a question picked twice keeps its first position.
 */

export type CbtTestSourceOption = {
  kind: CbtTestSourceKind;
  id: string;
  label: string;
  /** Questions this source contributes today (imports commit on build). */
  questionCount: number;
  /** Import jobs still processing can be picked but may contribute nothing yet. */
  note?: string;
};

type Picked = { kind: CbtTestSourceKind; id: string; marks: string; negativeMarks: string };

export function CbtTestSourceBuilder({ options }: { options: CbtTestSourceOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);

  const optionByKey = useMemo(() => {
    const map = new Map<string, CbtTestSourceOption>();
    for (const o of options) map.set(`${o.kind}:${o.id}`, o);
    return map;
  }, [options]);

  const pickedKeys = useMemo(() => new Set(picked.map((p) => `${p.kind}:${p.id}`)), [picked]);
  const available = options.filter((o) => !pickedKeys.has(`${o.kind}:${o.id}`));

  // An upper bound: overlapping sources de-duplicate server-side, so the real
  // total can only come out lower.
  const estimatedTotal = picked.reduce(
    (sum, p) => sum + (optionByKey.get(`${p.kind}:${p.id}`)?.questionCount ?? 0),
    0,
  );

  function add(option: CbtTestSourceOption) {
    setPicked((prev) => [
      ...prev,
      {
        kind: option.kind,
        id: option.id,
        marks: String(DEFAULT_SOURCE_MARKS),
        negativeMarks: String(DEFAULT_SOURCE_NEGATIVE_MARKS),
      },
    ]);
  }

  function move(index: number, dir: -1 | 1) {
    setPicked((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function create() {
    setError(null);
    if (!title.trim()) {
      setError("Give the test a title.");
      return;
    }
    if (picked.length === 0) {
      setError("Pick at least one document or cluster.");
      return;
    }
    startTransition(async () => {
      const res = await mutateJson("/api/cbt/tests", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          durationMinutes: Number(duration) || 60,
          shuffleQuestions,
          sources: picked.map((p) => ({
            kind: p.kind,
            id: p.id,
            marks: Number(p.marks),
            negativeMarks: Number(p.negativeMarks),
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string; test?: { id: string } };
      if (!res.ok || !data.test) {
        setError(data.detail ?? `Create failed (${res.status})`);
        return;
      }
      router.push(`/cbt/tests/${data.test.id}`);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="neu-raised w-full rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5"
      >
        <span className="text-sm font-semibold text-foreground">Build from sources</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Combine several imported documents and clusters into one paper, stacked in the order you pick them.
        </span>
      </button>
    );
  }

  return (
    <section className="neu-raised space-y-4 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Build from sources</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. JEE Mains Mock 3" />
        </div>
        <div className="space-y-1">
          <Label>Duration (minutes)</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
        </div>
        <label className="flex items-end gap-2 pb-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={shuffleQuestions}
            onChange={(e) => setShuffleQuestions(e.target.checked)}
          />
          Shuffle questions per student
        </label>
      </div>

      {/* The stack */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Paper order ({picked.length} source{picked.length === 1 ? "" : "s"})
        </p>
        {picked.length === 0 ? (
          <p className="neu-inset rounded-xl p-3 text-xs text-muted-foreground">
            Nothing picked yet — choose a document or cluster below. The order you pick them is the order
            their questions appear in the paper.
          </p>
        ) : (
          <ul className="space-y-2">
            {picked.map((p, i) => {
              const option = optionByKey.get(`${p.kind}:${p.id}`);
              return (
                <li key={`${p.kind}:${p.id}`} className="neu-inset flex flex-wrap items-center gap-2 rounded-xl p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="shrink-0" aria-hidden>
                    {p.kind === "import_job" ? "📄" : "🗂"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{option?.label ?? p.id}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {option?.questionCount ?? 0} question{option?.questionCount === 1 ? "" : "s"}
                      {option?.note ? ` · ${option.note}` : ""}
                    </p>
                  </div>
                  <label className="text-xs text-muted-foreground">
                    +
                    <input
                      className="neu-raised ml-1 w-12 rounded-lg bg-transparent px-1.5 py-1 text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                      value={p.marks}
                      onChange={(e) =>
                        setPicked((prev) => prev.map((r, j) => (j === i ? { ...r, marks: e.target.value } : r)))
                      }
                      aria-label="Marks per correct answer"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    −
                    <input
                      className="neu-raised ml-1 w-12 rounded-lg bg-transparent px-1.5 py-1 text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                      value={p.negativeMarks}
                      onChange={(e) =>
                        setPicked((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, negativeMarks: e.target.value } : r)),
                        )
                      }
                      aria-label="Negative marks"
                    />
                  </label>
                  <div className="flex flex-col">
                    <button type="button" className="text-xs" onClick={() => move(i, -1)} aria-label="Move up">
                      ▲
                    </button>
                    <button type="button" className="text-xs" onClick={() => move(i, 1)} aria-label="Move down">
                      ▼
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-destructive"
                    onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Available sources */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add a source</p>
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {options.length === 0
              ? "Import a document or create a cluster first."
              : "Every source is already in the stack."}
          </p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {available.map((o) => (
              <li key={`${o.kind}:${o.id}`} className="flex items-center justify-between gap-3 rounded-xl px-1 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden>{o.kind === "import_job" ? "📄" : "🗂"}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{o.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.questionCount} question{o.questionCount === 1 ? "" : "s"}
                      {o.note ? ` · ${o.note}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="neu-raised shrink-0 border-0 shadow-none"
                  onClick={() => add(o)}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {picked.length > 0 ? `Up to ${estimatedTotal} questions (duplicates are merged)` : ""}
        </p>
        <Button
          className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
          disabled={pending || picked.length === 0 || !title.trim()}
          onClick={create}
        >
          {pending ? "Creating…" : "Create test"}
        </Button>
      </div>
    </section>
  );
}
