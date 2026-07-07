"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { useCbtRoom } from "@/context/CbtRoomContext";
import { useServerAnchoredTimer } from "@/hooks/useServerAnchoredTimer";
import {
  isAnswered,
  type CbtPaletteStatus,
  type CbtSanitizedQuestion,
  type CbtStudentAnswer,
  type CbtTestPayload,
} from "@/lib/cbt/attempt-model";

/**
 * CBT test player. A purpose-built fork of the Origin TestInterface: it keeps
 * sections, the 5-status palette, all question-type renderers, the
 * server-anchored timer, and mark/save/clear — and DROPS all camera / mic /
 * face-verification / malpractice-auto-submit machinery. Fullscreen, autosave
 * (debounce + interval + sendBeacon), resume hydration, and auto-submit-at-zero
 * are added. Grading is entirely server-side; this component never sees answers.
 */

type FlatQuestion = { subject: string; q: CbtSanitizedQuestion };
type Phase = "loading" | "error" | "ready" | "running" | "submitting" | "submitted";

const PALETTE_STYLE: Record<CbtPaletteStatus, string> = {
  not_visited: "bg-muted text-muted-foreground",
  not_answered: "bg-red-500/15 text-red-600 dark:text-red-400",
  answered: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  marked: "bg-violet-500/20 text-violet-700 dark:text-violet-400",
  answered_marked: "bg-violet-500/30 text-violet-800 dark:text-violet-300 ring-2 ring-emerald-500",
};

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function paletteFor(hasAnswer: boolean, marked: boolean): CbtPaletteStatus {
  if (marked) return hasAnswer ? "answered_marked" : "marked";
  return hasAnswer ? "answered" : "not_answered";
}

export function CbtTestInterface() {
  const { markSubmitted } = useCbtRoom();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CbtTestPayload | null>(null);
  const [studentCode, setStudentCode] = useState<string>("");
  const [answers, setAnswers] = useState<Record<number, CbtStudentAnswer>>({});
  const [palette, setPalette] = useState<Record<number, CbtPaletteStatus>>({});
  const [index, setIndex] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ answers, palette });
  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);
  const debounceRef = useRef<number | undefined>(undefined);

  stateRef.current = { answers, palette };

  const flat: FlatQuestion[] = useMemo(
    () => (payload ? payload.sections.flatMap((s) => s.questions.map((q) => ({ subject: s.subject, q }))) : []),
    [payload],
  );

  const timerSource = useMemo(
    () => (payload ? { startedAt: payload.startedAt, durationSeconds: payload.durationSeconds } : undefined),
    [payload],
  );
  // The hook drives a 250ms re-render tick; we compute the shown value freshly
  // from the payload each render so a stale initial 0 can never auto-submit.
  useServerAnchoredTimer(timerSource, phase === "running");
  const remaining = payload
    ? Math.max(0, Math.ceil((payload.durationSeconds * 1000 - (Date.now() - new Date(payload.startedAt).getTime())) / 1000))
    : 0;

  // ── Load payload + hydrate draft (resume) ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cbt-student/test", { credentials: "include" });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { detail?: string };
          throw new Error(d.detail ?? `Could not load the test (${res.status}).`);
        }
        const data = (await res.json()) as {
          payload: CbtTestPayload;
          draft: { answers: Record<number, CbtStudentAnswer>; palette: Record<number, CbtPaletteStatus> };
          studentCode: string;
        };
        if (cancelled) return;
        setPayload(data.payload);
        setStudentCode(data.studentCode);
        setAnswers(data.draft.answers ?? {});
        setPalette(data.draft.palette ?? {});
        // If a draft already exists, the student is resuming — go straight in.
        setPhase(Object.keys(data.draft.answers ?? {}).length > 0 ? "running" : "ready");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the test.");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Autosave: debounce 2s + 15s interval + sendBeacon on pagehide ──────────
  const flushSave = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    try {
      await fetch("/api/cbt-student/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(stateRef.current),
      });
    } catch {
      dirtyRef.current = true; // retry on next tick
    }
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const interval = window.setInterval(() => void flushSave(), 15_000);
    const onPageHide = () => {
      if (!dirtyRef.current) return;
      const blob = new Blob([JSON.stringify(stateRef.current)], { type: "application/json" });
      navigator.sendBeacon("/api/cbt-student/answers", blob);
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      void flushSave();
    };
  }, [phase, flushSave]);

  const markDirtyAndDebounce = useCallback(() => {
    dirtyRef.current = true;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void flushSave(), 2000);
  }, [flushSave]);

  // ── Fullscreen request + re-enter warning (never auto-submit) ──────────────
  const enterFullscreen = useCallback(() => {
    containerRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const check = () => {
      const left = !document.fullscreenElement || document.hidden;
      setShowWarning(left);
    };
    document.addEventListener("fullscreenchange", check);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("blur", () => setShowWarning(true));
    return () => {
      document.removeEventListener("fullscreenchange", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [phase]);

  // ── Submit (manual, auto-at-zero, and drain-safe idempotent) ───────────────
  const submit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setPhase("submitting");
      await flushSave();
      try {
        await fetch("/api/cbt-student/submit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ auto }),
        });
      } catch {
        // Server sweep is the backstop; still show the end screen.
      }
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
      setPhase("submitted");
      // Promote to the room-level terminal phase so the context unmounts this
      // player: a submitted student must never re-enter the test (e.g. via a
      // browser Back / bfcache restore of this frozen mid-test view).
      markSubmitted();
    },
    [flushSave, markSubmitted],
  );

  // Auto-submit when the server-anchored timer hits zero.
  useEffect(() => {
    if (phase === "running" && remaining <= 0 && payload) void submit(true);
  }, [phase, remaining, payload, submit]);

  // ── Answer mutation ────────────────────────────────────────────────────────
  const setAnswer = useCallback((position: number, next: CbtStudentAnswer) => {
    setAnswers((prev) => ({ ...prev, [position]: next }));
    setPalette((prev) => {
      const marked = prev[position] === "marked" || prev[position] === "answered_marked";
      return { ...prev, [position]: paletteFor(isAnswered(next), marked) };
    });
    markDirtyAndDebounce();
  }, [markDirtyAndDebounce]);

  const clearResponse = useCallback((position: number) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[position];
      return next;
    });
    setPalette((prev) => ({ ...prev, [position]: "not_answered" }));
    markDirtyAndDebounce();
  }, [markDirtyAndDebounce]);

  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(flat.length - 1, nextIndex));
      const pos = flat[clamped]?.q.position;
      if (pos != null) {
        setPalette((prev) => (prev[pos] ? prev : { ...prev, [pos]: "not_answered" }));
      }
      setIndex(clamped);
    },
    [flat],
  );

  const markForReviewNext = useCallback(
    (position: number) => {
      setPalette((prev) => {
        const hasAnswer = isAnswered(answers[position]);
        return { ...prev, [position]: hasAnswer ? "answered_marked" : "marked" };
      });
      markDirtyAndDebounce();
      goTo(index + 1);
    },
    [answers, goTo, index, markDirtyAndDebounce],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return <CenteredMessage>Loading your test…</CenteredMessage>;
  }
  if (phase === "error") {
    return <CenteredMessage>{error ?? "Something went wrong."}</CenteredMessage>;
  }
  if (phase === "submitted") {
    return (
      <CenteredMessage>
        <p className="text-xl font-semibold">Test submitted</p>
        <p className="mt-2 text-sm text-muted-foreground">Your ID</p>
        <p className="font-mono text-2xl font-bold tracking-[0.2em]">{studentCode}</p>
      </CenteredMessage>
    );
  }
  if (phase === "ready" && payload) {
    return (
      <CenteredMessage>
        <p className="text-xl font-semibold">{payload.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {payload.totalQuestions} questions · {Math.round(payload.durationSeconds / 60)} min
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            enterFullscreen();
            setPhase("running");
          }}
        >
          Enter fullscreen &amp; begin
        </Button>
      </CenteredMessage>
    );
  }

  const current = flat[index];
  if (!current || !payload) return <CenteredMessage>Loading…</CenteredMessage>;

  return (
    <div ref={containerRef} className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{payload.title}</p>
          <p className="text-xs text-muted-foreground">{current.subject}</p>
        </div>
        <div className={`rounded-md px-3 py-1 font-mono text-lg font-bold ${remaining <= 60 ? "text-red-600" : ""}`}>
          {formatClock(remaining)}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row">
        <main className="flex-1 space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Question {index + 1} of {flat.length}
            </span>
            <span>
              {current.q.marks > 0 ? `+${current.q.marks}` : current.q.marks} / {current.q.negativeMarks}
            </span>
          </div>
          <div className="rounded-lg border border-border p-4">
            <LatexRenderer content={current.q.stem} />
          </div>
          <QuestionInput question={current.q} answer={answers[current.q.position]} onChange={(a) => setAnswer(current.q.position, a)} />

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => clearResponse(current.q.position)}>
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => markForReviewNext(current.q.position)}>
              Mark for review &amp; next
            </Button>
            <Button size="sm" onClick={() => goTo(index + 1)}>
              Save &amp; next
            </Button>
          </div>
        </main>

        <aside className="w-full shrink-0 space-y-3 lg:w-64">
          <div className="grid grid-cols-6 gap-1.5">
            {flat.map((f, i) => {
              const status = palette[f.q.position] ?? "not_visited";
              return (
                <button
                  key={f.q.position}
                  onClick={() => goTo(i)}
                  className={`h-8 rounded text-xs font-semibold ${PALETTE_STYLE[status]} ${i === index ? "outline outline-2 outline-primary" : ""}`}
                  title={`Question ${i + 1}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <Button className="w-full" variant="destructive" onClick={() => submit(false)} disabled={phase === "submitting"}>
            {phase === "submitting" ? "Submitting…" : "Submit test"}
          </Button>
        </aside>
      </div>

      {showWarning ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 p-6 text-center">
          <p className="text-lg font-semibold">Please return to the test</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            You left the test window. Your answers are saved — return to fullscreen to continue. Your timer keeps running.
          </p>
          <Button
            onClick={() => {
              enterFullscreen();
              setShowWarning(false);
            }}
          >
            Return to fullscreen
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
      <div className="max-w-sm">{children}</div>
    </main>
  );
}

function QuestionInput({
  question,
  answer,
  onChange,
}: {
  question: CbtSanitizedQuestion;
  answer: CbtStudentAnswer | undefined;
  onChange: (answer: CbtStudentAnswer) => void;
}) {
  const a = answer ?? {};

  switch (question.questionType) {
    case "mcq":
      return (
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${a.selectedOption === i ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <input
                type="radio"
                name={`q-${question.position}`}
                checked={a.selectedOption === i}
                onChange={() => onChange({ selectedOption: i })}
              />
              <LatexRenderer content={opt} />
            </label>
          ))}
        </div>
      );
    case "msq": {
      const selected = a.selectedOptions ?? [];
      return (
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${selected.includes(i) ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(i)}
                onChange={(e) => {
                  const next = e.target.checked ? [...selected, i] : selected.filter((x) => x !== i);
                  onChange({ selectedOptions: next.sort((x, y) => x - y) });
                }}
              />
              <LatexRenderer content={opt} />
            </label>
          ))}
        </div>
      );
    }
    case "matrix_match":
      return <MatrixInput question={question} pairs={a.matrixPairs ?? []} onChange={(matrixPairs) => onChange({ matrixPairs })} />;
    case "subjective":
      return (
        <textarea
          className="min-h-32 w-full rounded-lg border border-border bg-background p-3 text-sm"
          value={a.answerText ?? ""}
          onChange={(e) => onChange({ answerText: e.target.value })}
          placeholder="Type your answer…"
        />
      );
    default:
      // numerical, numerical_with_units, symbolic_expression, equation
      return (
        <input
          className="w-full rounded-lg border border-border bg-background p-3 text-sm"
          value={a.answerText ?? ""}
          onChange={(e) => onChange({ answerText: e.target.value })}
          placeholder={question.questionType === "numerical_with_units" ? "Value with units" : "Your answer"}
          inputMode={question.questionType.startsWith("numerical") ? "decimal" : "text"}
        />
      );
  }
}

function MatrixInput({
  question,
  pairs,
  onChange,
}: {
  question: CbtSanitizedQuestion;
  pairs: number[][];
  onChange: (pairs: number[][]) => void;
}) {
  const md = (question.matrixData ?? {}) as { rows?: string[]; columns?: string[] };
  const rows = Array.isArray(md.rows) ? md.rows : [];
  const columns = Array.isArray(md.columns) ? md.columns : [];
  const selectedFor = (rowIdx: number) => pairs.find((p) => p[0] === rowIdx)?.[1];

  if (rows.length === 0 || columns.length === 0) {
    return <p className="text-sm text-muted-foreground">This question could not be displayed.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-3">
          <span className="w-24 shrink-0">
            <LatexRenderer content={row} />
          </span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            value={selectedFor(rowIdx) ?? ""}
            onChange={(e) => {
              const colIdx = e.target.value === "" ? null : Number(e.target.value);
              const next = pairs.filter((p) => p[0] !== rowIdx);
              if (colIdx !== null) next.push([rowIdx, colIdx]);
              onChange(next.sort((x, y) => x[0] - y[0]));
            }}
          >
            <option value="">—</option>
            {columns.map((col, colIdx) => (
              <option key={colIdx} value={colIdx}>
                {col}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
