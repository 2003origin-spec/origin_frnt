"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mutateJson } from "@/lib/csrf";
import type { CbtQuestion } from "@/lib/cbt/question-model";
import type { CbtCluster } from "@/lib/cbt/cluster-model";
import type { CbtTestWithQuestions } from "@/lib/cbt/test-model";

type Row = { questionId: string; marks: number; negativeMarks: number };

type QuestionUsage = { testCount: number; titles: string[]; liveCount: number };

export function CbtTestBuilder({
  initialTest,
  allQuestions,
  clusters,
  membershipByQuestion,
  usageByQuestion,
}: {
  initialTest: CbtTestWithQuestions;
  allQuestions: CbtQuestion[];
  clusters: CbtCluster[];
  membershipByQuestion: Record<string, string[]>;
  /**
   * Where each question is already used. Informational only — reuse across
   * tests is allowed (the old D2 hard block was removed 2026-08-02), so this
   * exists to warn, never to disable.
   */
  usageByQuestion: Record<string, QuestionUsage>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [addFilter, setAddFilter] = useState<string | null>(null); // cluster id or null (All)

  const [title, setTitle] = useState(initialTest.title);
  const [description, setDescription] = useState(initialTest.description ?? "");
  const [duration, setDuration] = useState(String(initialTest.durationMinutes));
  const [status, setStatus] = useState(initialTest.status);
  const [shuffleQuestions, setShuffleQuestions] = useState(initialTest.shuffleQuestions);
  const [rows, setRows] = useState<Row[]>(
    initialTest.questions.map((q) => ({ questionId: q.questionId, marks: q.marks, negativeMarks: q.negativeMarks })),
  );

  const questionById = useMemo(() => {
    const m = new Map<string, CbtQuestion>();
    for (const q of allQuestions) m.set(q.id, q);
    return m;
  }, [allQuestions]);

  const selectedIds = useMemo(() => new Set(rows.map((r) => r.questionId)), [rows]);
  const available = useMemo(
    () =>
      allQuestions.filter(
        (q) =>
          !selectedIds.has(q.id) &&
          (addFilter === null || (membershipByQuestion[q.id] ?? []).includes(addFilter)),
      ),
    [allQuestions, selectedIds, addFilter, membershipByQuestion],
  );
  const maxScore = rows.reduce((sum, r) => sum + (Number(r.marks) || 0), 0);

  function addQuestion(id: string) {
    if (selectedIds.has(id)) return;
    setRows((prev) => [...prev, { questionId: id, marks: 4, negativeMarks: -1 }]);
  }

  /** Adds every question in the current cluster filter, reused ones included. */
  function addAllVisible() {
    if (available.length === 0) return;
    setRows((prev) => [...prev, ...available.map((q) => ({ questionId: q.id, marks: 4, negativeMarks: -1 }))]);
  }

  function move(index: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function saveMeta(nextStatus?: string) {
    setError(null);
    const res = await mutateJson(`/api/cbt/tests/${initialTest.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        durationMinutes: Number(duration) || 60,
        status: nextStatus ?? status,
        shuffleQuestions,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    if (!res.ok) {
      setError(data.detail ?? `Save failed (${res.status})`);
      return false;
    }
    if (nextStatus) setStatus(nextStatus as typeof status);
    return true;
  }

  async function saveQuestions() {
    setError(null);
    const res = await mutateJson(`/api/cbt/tests/${initialTest.id}/questions`, {
      method: "PUT",
      body: JSON.stringify({
        questions: rows.map((r) => ({
          questionId: r.questionId,
          marks: Number(r.marks) || 0,
          negativeMarks: Number(r.negativeMarks) || 0,
        })),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    if (!res.ok) {
      setError(data.detail ?? `Save failed (${res.status})`);
      return false;
    }
    return true;
  }

  function saveAll() {
    startTransition(async () => {
      const okMeta = await saveMeta();
      if (!okMeta) return;
      const okQ = await saveQuestions();
      if (!okQ) return;
      setSavedNote("Saved.");
      router.refresh();
      setTimeout(() => setSavedNote(null), 2000);
    });
  }

  function markReady() {
    startTransition(async () => {
      if (!(await saveMeta())) return;
      if (!(await saveQuestions())) return;
      await saveMeta("ready");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Edit test</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status: {status}</span>
          <Button size="sm" variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" disabled={pending} onClick={saveAll}>
            Save
          </Button>
          {status !== "ready" ? (
            <Button size="sm" className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" disabled={pending || rows.length === 0} onClick={markReady}>
              Mark ready
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" disabled={pending} onClick={() => startTransition(() => saveMeta("draft").then(() => {}))}>
              Back to draft
            </Button>
          )}
        </div>
      </div>

      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
      {savedNote ? <p className="text-xs text-emerald-600 dark:text-emerald-400">{savedNote}</p> : null}

      <section className="neu-raised grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1">
          <Label>Duration (minutes)</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
        </div>
        <div className="flex items-end text-sm text-muted-foreground">Max score: {maxScore}</div>
        <div className="space-y-1 sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium text-foreground">Shuffle questions</span>
              <span className="block text-xs text-muted-foreground">
                Every student gets the questions of each subject in their own random order. Subject
                sections stay in the same order, and scoring is unaffected.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Questions ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions added yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r, i) => {
              const q = questionById.get(r.questionId);
              return (
                <li key={r.questionId} className="neu-raised flex items-center gap-3 p-3">
                  <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm text-foreground">{q?.stem ?? r.questionId}</div>
                    <div className="text-xs text-muted-foreground">{q?.questionType}</div>
                  </div>
                  <label className="text-xs text-muted-foreground">
                    +
                    <input
                      className="neu-inset ml-1 w-14 rounded-lg bg-transparent px-1.5 py-1 text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                      value={r.marks}
                      onChange={(e) => updateRow(i, { marks: Number(e.target.value) })}
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    −
                    <input
                      className="neu-inset ml-1 w-14 rounded-lg bg-transparent px-1.5 py-1 text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                      value={r.negativeMarks}
                      onChange={(e) => updateRow(i, { negativeMarks: Number(e.target.value) })}
                    />
                  </label>
                  <div className="flex flex-col">
                    <button type="button" className="text-xs" onClick={() => move(i, -1)} aria-label="Move up">▲</button>
                    <button type="button" className="text-xs" onClick={() => move(i, 1)} aria-label="Move down">▼</button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-destructive"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Add from your bank ({available.length})</h2>
          <div className="flex items-center gap-2">
            <select
              className="neu-inset rounded-lg bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/30"
              value={addFilter ?? ""}
              onChange={(e) => setAddFilter(e.target.value || null)}
            >
              <option value="">All questions</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.questionCount})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5"
              disabled={available.length === 0}
              onClick={addAllVisible}
            >
              Add all{addFilter ? " in cluster" : ""}
            </Button>
          </div>
        </div>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {addFilter ? "No addable questions in this cluster." : "All your questions are already in this test."}
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {available.map((q) => {
              const usage = usageByQuestion[q.id];
              return (
                <li key={q.id} className="neu-raised flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-sm text-foreground">{q.stem}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{q.questionType}</span>
                      {/* Informational, never blocking: the same question may be
                          reused across as many tests as the teacher likes. */}
                      {usage?.testCount ? (
                        <span
                          title={`Also in: ${usage.titles.join(", ")}`}
                          className="rounded bg-muted px-1.5 py-0.5"
                        >
                          in {usage.testCount} other test{usage.testCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {usage?.liveCount ? (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                          ⚠ running live now — edits affect that test
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" onClick={() => addQuestion(q.id)}>
                    Add
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
