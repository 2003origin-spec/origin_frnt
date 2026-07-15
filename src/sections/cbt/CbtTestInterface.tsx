"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Play, ShieldCheck } from "lucide-react";

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
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  // Instructions gate + optional camera proctoring (auto-disabled when no camera).
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

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

  // ── Camera presence detection (for the optional proctoring checkbox) ────────
  // enumerateDevices lists a videoinput device whenever a camera exists; labels
  // stay blank until permission is granted, but the device entry is enough to
  // know one is present. No camera ⇒ the checkbox is disabled.
  useEffect(() => {
    let cancelled = false;
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.enumerateDevices) {
      setHasCamera(false);
      return;
    }
    md.enumerateDevices()
      .then((devices) => {
        if (!cancelled) setHasCamera(devices.some((d) => d.kind === "videoinput"));
      })
      .catch(() => {
        if (!cancelled) setHasCamera(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A camera that disappears (or was never there) must never leave the box ticked.
  useEffect(() => {
    if (hasCamera === false && cameraEnabled) setCameraEnabled(false);
  }, [hasCamera, cameraEnabled]);

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

  // Ordered, de-duplicated subject list for the section bar.
  const subjects = useMemo(() => {
    const seen: string[] = [];
    for (const f of flat) {
      const s = f.subject || "General";
      if (!seen.includes(s)) seen.push(s);
    }
    return seen;
  }, [flat]);

  const jumpToSubject = useCallback(
    (subject: string) => {
      const idx = flat.findIndex((f) => (f.subject || "General") === subject);
      if (idx !== -1) goTo(idx);
    },
    [flat, goTo],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return <CenteredMessage><OriBrandMark /><p className="mt-4 text-sm font-bold text-muted-foreground">Loading your test…</p></CenteredMessage>;
  }
  if (phase === "error") {
    return (
      <CenteredMessage>
        <OriBrandMark />
        <p className="mt-4 text-base font-black text-foreground">Unable to load the test</p>
        <p className="mt-1 text-sm text-muted-foreground">{error ?? "Something went wrong."}</p>
      </CenteredMessage>
    );
  }
  if (phase === "submitted") {
    return (
      <CenteredMessage>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full neu-raised text-emerald-500">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="text-xl font-black text-foreground">Test Submitted</p>
        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your Candidate ID</p>
        <p className="mt-1 font-mono text-2xl font-black tracking-[0.25em] text-primary">{studentCode}</p>
        <p className="mt-4 text-xs text-muted-foreground">You may now close this window.</p>
      </CenteredMessage>
    );
  }
  if (phase === "ready" && payload) {
    const durationMin = Math.round(payload.durationSeconds / 60);
    return (
      <main className="flex min-h-screen flex-col items-center justify-start overflow-y-auto neu-surface p-4 text-foreground sm:p-6">
        <div className="my-auto w-full max-w-3xl">
          <div className="neu-raised overflow-hidden rounded-3xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 bg-rose-900 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <OriBrandMark compact />
                <h2 className="text-base font-black uppercase tracking-tight text-white sm:text-lg">General Instructions</h2>
              </div>
              <div className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/80 sm:text-xs">
                Time: {durationMin} Minutes
              </div>
            </div>

            {/* Body */}
            <div className="space-y-6 p-5 text-left sm:p-8">
              <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">{payload.title}</h1>
              <div className="grid grid-cols-2 gap-3">
                <div className="neu-inset rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-foreground">{payload.totalQuestions}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Questions</p>
                </div>
                <div className="neu-inset rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-foreground">{durationMin}<span className="text-sm"> min</span></p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duration</p>
                </div>
              </div>

              {/* Standard exam rules */}
              <section>
                <h3 className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2 text-base font-bold text-rose-700 dark:text-rose-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/15 text-xs text-rose-700 dark:text-rose-400">1</span>
                  Standard Exam Rules
                </h3>
                <ul className="list-disc space-y-2 pl-5 text-sm font-medium text-muted-foreground">
                  <li>The total duration of the examination is <span className="font-bold text-foreground">{durationMin} minutes</span>.</li>
                  <li>The clock is set on the server. The countdown timer at the top shows the time remaining to complete the examination.</li>
                  <li>The Question Palette on the right shows the status of each question (not visited, not answered, answered, marked for review, answered &amp; marked).</li>
                  <li>Your answers autosave. The test auto-submits when the timer reaches zero.</li>
                </ul>
              </section>

              {/* Marking scheme */}
              <section>
                <h3 className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2 text-base font-bold text-rose-700 dark:text-rose-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/15 text-xs text-rose-700 dark:text-rose-400">2</span>
                  Marking Scheme
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                    <p className="mb-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Correct</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">+ Marks</p>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                    <p className="mb-1 text-[10px] font-black uppercase text-red-600 dark:text-red-400">Incorrect</p>
                    <p className="text-xl font-black text-red-600 dark:text-red-400">− Marks</p>
                  </div>
                  <div className="neu-inset rounded-xl p-4 text-center">
                    <p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Unattempted</p>
                    <p className="text-xl font-black text-foreground">0</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] italic text-muted-foreground">* Marks per question are shown on each question; some questions may not carry negative marking.</p>
              </section>

              {/* Integrity */}
              <section className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
                  <ShieldCheck className="h-5 w-5" /> Exam Integrity
                </h3>
                <ul className="space-y-1.5 text-xs font-medium text-muted-foreground">
                  <li>• The exam opens in <span className="font-bold text-foreground">full-screen</span>. Leaving full-screen shows a warning — your timer keeps running.</li>
                  <li>• Switching tabs or minimizing the browser is recorded.</li>
                  <li>• Camera proctoring is <span className="font-bold text-foreground">optional</span> — enable it below for face monitoring.</li>
                </ul>
              </section>

              {/* Camera checkbox — disabled when no camera is detected */}
              <label
                className={`flex items-start gap-3 rounded-2xl border p-3 transition-all ${
                  hasCamera === false
                    ? "cursor-not-allowed border-border/40 opacity-60"
                    : "cursor-pointer border-border/60 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <input
                  type="checkbox"
                  checked={cameraEnabled}
                  disabled={hasCamera !== true}
                  onChange={(e) => setCameraEnabled(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-primary disabled:cursor-not-allowed"
                />
                <div>
                  <span className="flex items-center gap-2 text-xs font-bold text-foreground sm:text-sm">
                    <Camera className="h-4 w-4 text-primary" />
                    Enable Camera Proctoring <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">(Optional)</span>
                  </span>
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                    {hasCamera === null
                      ? "Checking for a camera…"
                      : hasCamera
                        ? "Enables face-monitoring during the exam. Your face must be clearly visible if enabled."
                        : "No camera detected on this device — proctoring is unavailable."}
                  </p>
                </div>
              </label>

              {/* Accept rules */}
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={acceptedRules}
                  onChange={(e) => setAcceptedRules(e.target.checked)}
                  className="h-5 w-5 shrink-0 cursor-pointer rounded accent-primary"
                />
                <span className="text-xs font-bold text-foreground sm:text-sm">I have read and understood the instructions.</span>
              </label>

              <button
                onClick={() => { enterFullscreen(); setPhase("running"); }}
                disabled={!acceptedRules}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-black uppercase tracking-tight text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-5 w-5 fill-current" /> Enter Full-screen &amp; Begin
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const current = flat[index];
  if (!current || !payload) return <CenteredMessage><OriBrandMark /></CenteredMessage>;
  const activeSubject = current.subject || "General";

  return (
    <div ref={containerRef} className="flex h-dvh flex-col overflow-y-auto neu-surface text-foreground">
      {/* 1. Branded header */}
      <header className="shrink-0 flex flex-col items-center justify-between gap-3 border-b border-border/60 px-3 py-2 sm:flex-row sm:gap-0 sm:px-6">
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
          <OriBrandMark compact />
          <div>
            <h1 className="text-sm font-black leading-tight text-rose-900 dark:text-rose-300 sm:text-xl">O3 ORIGIN TESTING AGENCY</h1>
            <p className="text-[10px] font-semibold italic text-emerald-700 dark:text-emerald-400 sm:text-xs">Excellence in Assessment</p>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 text-[10px] font-semibold sm:gap-1 sm:text-xs">
          <div className="flex"><span className="w-20 text-muted-foreground sm:w-28">Candidate:</span> <span className="truncate font-mono text-primary">{studentCode || "—"}</span></div>
          <div className="flex"><span className="w-20 text-muted-foreground sm:w-28">Subject:</span> <span className="truncate text-primary">{activeSubject}</span></div>
          <div className="flex items-center"><span className="w-20 text-muted-foreground sm:w-28">Remaining:</span> <span className={`rounded px-2 py-0.5 font-mono font-bold text-white ${remaining <= 60 ? "bg-red-600 animate-pulse" : "bg-rose-500"}`} suppressHydrationWarning>{formatClock(remaining)}</span></div>
        </div>
      </header>

      {/* 2. Section / subject bar */}
      <div className="flex items-center gap-0 overflow-x-auto bg-[#f08c32] px-0 no-scrollbar">
        <div className="flex h-[38px] shrink-0 items-center border-r border-white/20 bg-primary px-4 text-xs font-bold text-white">SECTION</div>
        {subjects.map((subj) => {
          const isActive = activeSubject === subj;
          return (
            <button
              key={subj}
              onClick={() => jumpToSubject(subj)}
              className={`h-[38px] shrink-0 border-r border-white/20 px-4 text-xs font-bold uppercase transition-all ${isActive ? "bg-white text-black" : "bg-primary text-white hover:bg-primary/90"}`}
            >
              {subj}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 lg:flex-row">
        {/* Main question column */}
        <main className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-foreground">Question {index + 1} <span className="text-muted-foreground">of {flat.length}</span></span>
            <span className="flex items-center gap-2 text-[11px] font-bold">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">+{current.q.marks}</span>
              <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-red-600 dark:text-red-400">{current.q.negativeMarks}</span>
            </span>
          </div>

          <div className="neu-raised rounded-2xl p-4 sm:p-5 text-base leading-relaxed">
            <LatexRenderer content={current.q.stem} />
            {current.q.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.q.image}
                alt="Question diagram"
                className="mt-4 max-h-80 w-auto max-w-full rounded-xl object-contain"
              />
            ) : null}
          </div>

          <QuestionInput question={current.q} answer={answers[current.q.position]} onChange={(a) => setAnswer(current.q.position, a)} />

          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => clearResponse(current.q.position)} className="neu-raised rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground transition-all hover:text-foreground active:scale-95">Clear</button>
            <button onClick={() => markForReviewNext(current.q.position)} className="neu-raised rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 transition-all hover:-translate-y-0.5 active:scale-95">Mark & Next</button>
            <button onClick={() => goTo(index + 1)} className="ml-auto rounded-xl bg-primary px-6 py-2.5 text-[11px] font-black uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95">Save & Next</button>
          </div>
        </main>

        {/* Palette sidebar */}
        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          {/* Legend */}
          <div className="neu-raised rounded-2xl p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Legend</p>
            <div className="grid grid-cols-1 gap-2 text-[11px] font-bold text-muted-foreground">
              <LegendRow className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" label="Answered" />
              <LegendRow className="bg-red-500/15 text-red-600 dark:text-red-400" label="Not Answered" />
              <LegendRow className="bg-violet-500/20 text-violet-700 dark:text-violet-400" label="Marked for Review" />
              <LegendRow className="bg-violet-500/30 text-violet-800 dark:text-violet-300 ring-2 ring-emerald-500" label="Answered & Marked" />
              <LegendRow className="bg-muted text-muted-foreground" label="Not Visited" />
            </div>
          </div>

          {/* Grid */}
          <div className="neu-raised rounded-2xl p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Question Palette</p>
            <div className="grid grid-cols-6 gap-1.5">
              {flat.map((f, i) => {
                const status = palette[f.q.position] ?? "not_visited";
                return (
                  <button
                    key={f.q.position}
                    onClick={() => goTo(i)}
                    className={`h-8 rounded-lg text-xs font-bold transition-all ${PALETTE_STYLE[status]} ${i === index ? "outline outline-2 outline-primary" : ""}`}
                    title={`Question ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={phase === "submitting"}
            className="w-full rounded-2xl bg-rose-600 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-rose-600/25 transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
          >
            {phase === "submitting" ? "Submitting…" : "Submit Test"}
          </button>
        </aside>
      </div>

      {/* Submit confirmation modal */}
      {showSubmitModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="neu-raised w-full max-w-md rounded-3xl p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-black text-foreground">Submit your test?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Once submitted you cannot change your answers. This action is final.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="flex-1 neu-raised rounded-xl py-3 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={() => { setShowSubmitModal(false); void submit(false); }} className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-700">Submit</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Fullscreen re-enter warning */}
      {showWarning ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 p-6 text-center backdrop-blur-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <p className="text-lg font-black text-foreground">Please return to the test</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            You left the test window. Your answers are saved — return to full-screen to continue. Your timer keeps running.
          </p>
          <button
            onClick={() => { enterFullscreen(); setShowWarning(false); }}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90"
          >
            Return to Full-screen
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Origin brand mark — the official Origin logo used on the exam screens. */
function OriBrandMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? "h-12 w-12" : "mx-auto h-16 w-16";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/Origin-New-Logo.jpeg" alt="Origin" className={`${size} rounded-xl object-contain`} />
  );
}

function LegendRow({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-5 w-6 shrink-0 rounded ${className}`} />
      <span>{label}</span>
    </div>
  );
}

function CenteredMessage({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start overflow-y-auto neu-surface p-6 text-center text-foreground sm:justify-center">
      <div className={`neu-raised my-auto w-full rounded-3xl p-6 sm:p-8 ${wide ? "max-w-md" : "max-w-sm"}`}>{children}</div>
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
        <div className="space-y-3">
          {question.options.map((opt, i) => {
            const active = a.selectedOption === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChange({ selectedOption: i })}
                className={`flex w-full items-start gap-4 rounded-2xl p-4 text-left transition-all ${active ? "neu-inset ring-2 ring-primary" : "neu-raised hover:-translate-y-0.5"}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="pt-0.5"><LatexRenderer content={opt} /></span>
              </button>
            );
          })}
        </div>
      );
    case "msq": {
      const selected = a.selectedOptions ?? [];
      return (
        <div className="space-y-3">
          {question.options.map((opt, i) => {
            const active = selected.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const next = active ? selected.filter((x) => x !== i) : [...selected, i];
                  onChange({ selectedOptions: next.sort((x, y) => x - y) });
                }}
                className={`flex w-full items-start gap-4 rounded-2xl p-4 text-left transition-all ${active ? "neu-inset ring-2 ring-primary" : "neu-raised hover:-translate-y-0.5"}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="pt-0.5"><LatexRenderer content={opt} /></span>
              </button>
            );
          })}
        </div>
      );
    }
    case "matrix_match":
      return <MatrixInput question={question} pairs={a.matrixPairs ?? []} onChange={(matrixPairs) => onChange({ matrixPairs })} />;
    case "subjective":
      return (
        <textarea
          className="neu-inset min-h-32 w-full rounded-2xl bg-transparent p-4 text-sm outline-none focus:ring-1 focus:ring-primary/30"
          value={a.answerText ?? ""}
          onChange={(e) => onChange({ answerText: e.target.value })}
          placeholder="Type your answer…"
        />
      );
    default:
      // numerical, numerical_with_units, symbolic_expression, equation
      return (
        <input
          className="neu-inset w-full rounded-2xl bg-transparent p-4 text-sm outline-none focus:ring-1 focus:ring-primary/30"
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
    <div className="neu-raised space-y-2 rounded-2xl p-4">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-3">
          <span className="w-24 shrink-0">
            <LatexRenderer content={row} />
          </span>
          <select
            className="neu-inset rounded-lg bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/30"
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
