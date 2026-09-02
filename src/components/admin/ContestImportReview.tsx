"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { mutateJson } from "@/lib/csrf";
import type { ImportJobQuestion, ImportJobWithProgress } from "@/server/workspaces/types";

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"] as const;
const PROCESSING_STATUSES = new Set(["queued", "processing"]);

/** The worker's loose options blob → a clean string[] for display/selection. */
function optionTexts(options: Record<string, unknown> | null): string[] {
  if (!options) return [];
  const arr = Array.isArray(options) ? options : Object.values(options);
  return arr
    .map((o) =>
      typeof o === "string" ? o : String((o as { text?: unknown; label?: unknown })?.text ?? (o as { label?: unknown })?.label ?? o ?? ""),
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function defaultSubject(raw: string | null): string {
  if (!raw) return "";
  const match = SUBJECTS.find((s) => s.toLowerCase() === raw.trim().toLowerCase());
  return match ?? "";
}

type RowState = {
  subject: string;
  chapter: string;
  correctOption: number;
  sendToPractice: boolean;
  status: string; // draft | accepted | review_required | published | rejected
  busy: boolean;
  error: string | null;
};

export function ContestImportReview({
  jobId,
  job,
  initialQuestions,
}: {
  jobId: string;
  job: ImportJobWithProgress;
  initialQuestions: ImportJobQuestion[];
}) {
  const [questions, setQuestions] = useState<ImportJobQuestion[]>(initialQuestions);
  const [progress, setProgress] = useState<number>(job.progressPercent ?? 0);
  const [jobStatus, setJobStatus] = useState<string>(job.status);
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const out: Record<string, RowState> = {};
    for (const q of initialQuestions) {
      out[q.id] = {
        subject: defaultSubject(q.subject),
        chapter: q.chapter ?? "",
        correctOption: typeof q.correctOption === "number" && q.correctOption >= 0 ? q.correctOption : 0,
        sendToPractice: false,
        status: q.status,
        busy: false,
        error: null,
      };
    }
    return out;
  });
  // Chapters cache per subject (from the same picker the paper builder uses).
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, string[]>>({});
  const loadingSubjects = useRef<Set<string>>(new Set());

  const setRow = useCallback((id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const loadChapters = useCallback(async (subject: string) => {
    if (!subject || chaptersBySubject[subject] || loadingSubjects.current.has(subject)) return;
    loadingSubjects.current.add(subject);
    try {
      const res = await fetch(`/api/admin/contest/chapters?subject=${encodeURIComponent(subject)}`);
      const data = (await res.json().catch(() => ({}))) as { chapters?: string[] };
      setChaptersBySubject((prev) => ({ ...prev, [subject]: data.chapters ?? [] }));
    } catch {
      setChaptersBySubject((prev) => ({ ...prev, [subject]: [] }));
    } finally {
      loadingSubjects.current.delete(subject);
    }
  }, [chaptersBySubject]);

  // Poll while the worker is still extracting.
  useEffect(() => {
    if (!PROCESSING_STATUSES.has(jobStatus)) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/contest/import-jobs/${jobId}`);
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as {
          job?: ImportJobWithProgress; questions?: ImportJobQuestion[];
        };
        if (data.job) {
          setProgress(data.job.progressPercent ?? 0);
          setJobStatus(data.job.status);
        }
        if (data.questions && data.questions.length) {
          setQuestions(data.questions);
          setRows((prev) => {
            const next = { ...prev };
            for (const q of data.questions!) {
              if (!next[q.id]) {
                next[q.id] = {
                  subject: defaultSubject(q.subject),
                  chapter: q.chapter ?? "",
                  correctOption: typeof q.correctOption === "number" && q.correctOption >= 0 ? q.correctOption : 0,
                  sendToPractice: false,
                  status: q.status,
                  busy: false,
                  error: null,
                };
              }
            }
            return next;
          });
        }
      } catch {
        // transient — keep polling
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [jobId, jobStatus]);

  // Load chapters for whatever subjects the rows currently point at.
  useEffect(() => {
    const subjects = new Set(Object.values(rows).map((r) => r.subject).filter(Boolean));
    subjects.forEach((s) => void loadChapters(s));
  }, [rows, loadChapters]);

  const eligibleIds = useMemo(
    () => questions.filter((q) => optionTexts(q.options).length >= 2 && rows[q.id]?.status !== "published" && rows[q.id]?.status !== "rejected").map((q) => q.id),
    [questions, rows],
  );

  const setAllPractice = (value: boolean) => {
    setRows((prev) => {
      const next = { ...prev };
      for (const id of eligibleIds) next[id] = { ...next[id], sendToPractice: value };
      return next;
    });
  };

  async function publishOne(q: ImportJobQuestion) {
    const row = rows[q.id];
    const options = optionTexts(q.options);
    if (options.length < 2) {
      setRow(q.id, { error: "Not contest-eligible: needs at least 2 options." });
      return;
    }
    if (!row.subject) return setRow(q.id, { error: "Pick a subject." });
    if (!row.chapter) return setRow(q.id, { error: "Pick a chapter." });
    setRow(q.id, { busy: true, error: null });
    try {
      const res = await mutateJson(`/api/admin/contest/import-jobs/${jobId}/questions/${q.id}`, {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          practiceEligible: row.sendToPractice,
          override: { subject: row.subject, chapter: row.chapter, correctOption: row.correctOption },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        setRow(q.id, { busy: false, error: data.detail ?? `Publish failed (${res.status})` });
        return;
      }
      setRow(q.id, { busy: false, status: "published", error: null });
    } catch (e) {
      setRow(q.id, { busy: false, error: e instanceof Error ? e.message : "Publish failed." });
    }
  }

  async function rejectOne(q: ImportJobQuestion) {
    setRow(q.id, { busy: true, error: null });
    try {
      const res = await mutateJson(`/api/admin/contest/import-jobs/${jobId}/questions/${q.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setRow(q.id, { busy: false, error: data.detail ?? `Reject failed (${res.status})` });
        return;
      }
      setRow(q.id, { busy: false, status: "rejected", error: null });
    } catch (e) {
      setRow(q.id, { busy: false, error: e instanceof Error ? e.message : "Reject failed." });
    }
  }

  const processing = PROCESSING_STATUSES.has(jobStatus);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground">{job.sourceFileName}</h1>
          <p className="text-sm text-muted-foreground">Status: {jobStatus}</p>
        </div>
        <Link href="/admin/contest/import" className="shrink-0 text-sm text-muted-foreground hover:text-primary">
          ← All imports
        </Link>
      </header>

      {processing ? (
        <div className="rounded-xl border border-border/40 p-4">
          <p className="text-sm text-muted-foreground">Extracting questions… {progress}%</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>
      ) : null}

      {questions.length > 0 ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Send to practice:</span>
          <button type="button" onClick={() => setAllPractice(true)} className="rounded-full border border-border/50 px-3 py-1 hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Select all
          </button>
          <button type="button" onClick={() => setAllPractice(false)} className="rounded-full border border-border/50 px-3 py-1 hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Deselect all
          </button>
        </div>
      ) : null}

      {questions.length === 0 && !processing ? (
        <p className="text-sm text-muted-foreground">No questions were extracted from this file.</p>
      ) : null}

      <ol className="space-y-4">
        {questions.map((q, idx) => {
          const row = rows[q.id];
          if (!row) return null;
          const options = optionTexts(q.options);
          const eligible = options.length >= 2;
          const done = row.status === "published" || row.status === "rejected";
          const chapters = chaptersBySubject[row.subject] ?? [];
          return (
            <li key={q.id} className={`rounded-2xl border p-4 ${done ? "border-border/30 opacity-70" : "border-border/50"}`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {idx + 1}. {q.questionText || <span className="text-muted-foreground">(no text extracted)</span>}
                </p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{row.status}</span>
              </div>

              {options.length > 0 ? (
                <ul className="mb-3 space-y-1">
                  {options.map((opt, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={row.correctOption === i}
                        disabled={done}
                        onChange={() => setRow(q.id, { correctOption: i })}
                      />
                      <span className={row.correctOption === i ? "font-semibold text-foreground" : "text-muted-foreground"}>{opt}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!eligible ? (
                <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                  Not contest-eligible — a contest question must be an MCQ with at least two options. Reject or delete it.
                </p>
              ) : (
                <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-xs text-muted-foreground">
                    Subject
                    <select
                      value={row.subject}
                      disabled={done}
                      onChange={(e) => setRow(q.id, { subject: e.target.value, chapter: "" })}
                      className="mt-1 w-full rounded-lg border border-border/50 bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <option value="">Select subject…</option>
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Chapter
                    <select
                      value={row.chapter}
                      disabled={done || !row.subject}
                      onChange={(e) => setRow(q.id, { chapter: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border/50 bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <option value="">{row.subject ? "Select chapter…" : "Pick a subject first"}</option>
                      {chapters.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {eligible && !done ? (
                <label className="mb-2 flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={row.sendToPractice} onChange={(e) => setRow(q.id, { sendToPractice: e.target.checked })} />
                  Send this question to candidate practice
                </label>
              ) : null}

              {row.error ? <p className="mb-2 text-xs text-destructive" role="alert">{row.error}</p> : null}

              {!done ? (
                <div className="flex items-center gap-2">
                  {eligible ? (
                    <Button size="sm" disabled={row.busy} onClick={() => publishOne(q)}>
                      {row.busy ? "Publishing…" : "Accept & add to pool"}
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    disabled={row.busy}
                    onClick={() => rejectOne(q)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
