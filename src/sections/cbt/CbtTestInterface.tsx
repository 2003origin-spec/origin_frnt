"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, Play, ShieldCheck, ZoomIn, X } from "lucide-react";

import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { useCbtRoom } from "@/context/CbtRoomContext";
import { useServerAnchoredTimer } from "@/hooks/useServerAnchoredTimer";
import { useSecureExamScreen } from "@/native/screen";
import {
  isAnswered,
  type CbtPaletteStatus,
  type CbtSanitizedQuestion,
  type CbtStudentAnswer,
  type CbtTestPayload,
} from "@/lib/cbt/attempt-model";
import {
  clearLocalDraft,
  loadLocalDraft,
  localDraftIsAhead,
  saveLocalDraft,
} from "@/lib/cbt/local-attempt";
import { QuestionTimer, type CbtQuestionTimes } from "@/lib/cbt/question-timing";

/**
 * CBT test player. A purpose-built fork of the Origin TestInterface: it keeps
 * sections, the 5-status palette, all question-type renderers, the
 * server-anchored timer, and mark/save/clear — and DROPS all camera / mic /
 * face-verification machinery. Fullscreen, autosave (debounce + interval +
 * sendBeacon), resume hydration, and auto-submit-at-zero are added. Grading is
 * entirely server-side; this component never sees answers.
 *
 * Disconnection handling (the thing this player is judged on):
 *  • answers are mirrored to this device and replayed when they are ahead of
 *    the server, so nothing typed during an outage is lost;
 *  • every save carries a revision, so a stale tab can't overwrite newer work;
 *  • a failed submit NEVER pretends to have succeeded — it retries and the
 *    student keeps their paper;
 *  • integrity strikes are suppressed while offline: losing the network is not
 *    cheating, and it must never end the test early.
 */

type FlatQuestion = { subject: string; q: CbtSanitizedQuestion };
type Phase = "loading" | "error" | "ready" | "running" | "submitting" | "submitted";
/** Whether the last write reached the server. Drives the sync indicator. */
type SyncState = "synced" | "pending" | "offline";

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
  const { markSubmitted, roomId, instituteName, instituteLogo } = useCbtRoom();
  const [instituteLogoBroken, setInstituteLogoBroken] = useState(false);
  // Android shell: FLAG_SECURE (no screenshots/recording) + keep the display
  // awake for the whole attempt surface (plan ledger #41/#42). Browser no-op.
  useSecureExamScreen();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CbtTestPayload | null>(null);
  const [studentCode, setStudentCode] = useState<string>("");
  const [answers, setAnswers] = useState<Record<number, CbtStudentAnswer>>({});
  const [palette, setPalette] = useState<Record<number, CbtPaletteStatus>>({});
  const [index, setIndex] = useState(0);
  const [imgZoomed, setImgZoomed] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  // Malpractice / fraud detection (ported from TestInterface): 3-strike
  // tab-switch / full-screen-exit detection that auto-submits on the 3rd strike.
  const [violations, setViolations] = useState(0);
  const [showMalpracticeWarning, setShowMalpracticeWarning] = useState(false);
  const [malpracticeTerminated, setMalpracticeTerminated] = useState(false);
  // Instructions gate before the exam starts.
  const [acceptedRules, setAcceptedRules] = useState(false);
  // Connectivity + save state, surfaced to the student so they never wonder
  // whether their answers made it.
  const [sync, setSync] = useState<SyncState>("synced");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ answers, palette });
  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const malpracticeTimerRef = useRef<number | undefined>(undefined);
  /** Monotonic draft revision; the server rejects anything below its own. */
  const revRef = useRef(0);
  const participantIdRef = useRef<string>("");
  /** Server-clock offset, so a skewed device clock can't fake "time up". */
  const skewRef = useRef(0);
  /**
   * Per-question stopwatch for the report card. Advisory only — it never
   * reaches grading — and it is paused whenever the student isn't actually
   * looking at the paper (tab hidden, window blurred, connection lost), so an
   * outage can't be recorded as twenty minutes of thinking about question 7.
   */
  const questionTimerRef = useRef<QuestionTimer | null>(null);

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
  // skewRef corrects for a device clock that disagrees with the server: an
  // uncorrected fast clock made the paper auto-submit the moment it loaded.
  const remaining = payload
    ? Math.max(
        0,
        Math.ceil(
          (payload.durationSeconds * 1000 -
            (Date.now() - skewRef.current - new Date(payload.startedAt).getTime())) /
            1000,
        ),
      )
    : 0;

  // Live attempted / skipped counts (shown in the exam header, mirroring the
  // main test player). "Attempted" = a question with a saved answer; everything
  // else in the paper is "skipped". Keyed by q.position, like answers/palette.
  const { attempted, skipped } = useMemo(() => {
    let a = 0;
    for (const f of flat) {
      const st = palette[f.q.position];
      if (st === "answered" || st === "answered_marked") a += 1;
    }
    return { attempted: a, skipped: Math.max(0, flat.length - a) };
  }, [flat, palette]);

  // Per-section (per-subject) progress — how many attempted out of the total in
  // each subject section, shown on the SECTION bar so students see their
  // progress per subject separately.
  const sectionStats = useMemo(() => {
    const stats: Record<string, { attempted: number; total: number }> = {};
    for (const f of flat) {
      const subj = f.subject || "General";
      if (!stats[subj]) stats[subj] = { attempted: 0, total: 0 };
      stats[subj].total += 1;
      const st = palette[f.q.position];
      if (st === "answered" || st === "answered_marked") stats[subj].attempted += 1;
    }
    return stats;
  }, [flat, palette]);

  // Mirror the live counts into a ref so submit() (whose closure must not be
  // recreated on every answer) reads the FINAL counts, not a stale snapshot.
  const summaryRef = useRef({ attempted: 0, skipped: 0, total: 0, sections: {} as Record<string, { attempted: number; total: number }> });
  useEffect(() => {
    summaryRef.current = { attempted, skipped, total: flat.length, sections: sectionStats };
  }, [attempted, skipped, flat.length, sectionStats]);

  // ── Load payload + hydrate draft (resume) ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sentAt = Date.now();
        const res = await fetch("/api/cbt-student/test", { credentials: "include" });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { detail?: string; code?: string };
          // The server already has this paper — finished by the student, by the
          // timer, or by the deadline finalization that runs when someone who
          // went offline never came back. Show the end screen, not an error.
          if (d.code === "already_submitted" || d.code === "test_ended") {
            if (!cancelled) {
              setPhase("submitted");
              markSubmitted();
            }
            return;
          }
          throw new Error(d.detail ?? `Could not load the test (${res.status}).`);
        }
        const data = (await res.json()) as {
          payload: CbtTestPayload;
          draft: {
            answers: Record<number, CbtStudentAnswer>;
            palette: Record<number, CbtPaletteStatus>;
            times?: CbtQuestionTimes;
            rev?: number;
          };
          studentCode: string;
          participantId?: string;
          enteredTestAt?: string | null;
          serverNow?: string;
        };
        if (cancelled) return;

        // Halve the round trip to approximate the moment the server read its
        // own clock. Sub-second precision is plenty for a minutes-long paper.
        if (data.serverNow) {
          const rtt = Date.now() - sentAt;
          skewRef.current = sentAt + rtt / 2 - new Date(data.serverNow).getTime();
        }

        participantIdRef.current = data.participantId ?? "";

        const serverRev = Number(data.draft.rev ?? 0);
        let answers = data.draft.answers ?? {};
        let palette = data.draft.palette ?? {};
        let times: CbtQuestionTimes = data.draft.times ?? {};
        revRef.current = serverRev;

        // Answers typed while the connection was down never reached the server.
        // If this device holds a newer revision, it wins and is pushed back up
        // before the student can type over it.
        const local = participantIdRef.current ? loadLocalDraft(roomId, participantIdRef.current) : null;
        if (localDraftIsAhead(local, serverRev) && local) {
          answers = local.answers;
          palette = local.palette;
          times = local.times ?? times;
          revRef.current = local.rev;
          dirtyRef.current = true;
        }

        // Resuming (another device, a reload) continues the stopwatch from what
        // has already been recorded rather than restarting every question at 0.
        questionTimerRef.current = new QuestionTimer(times, data.payload.durationSeconds);

        setPayload(data.payload);
        setStudentCode(data.studentCode);
        setAnswers(answers);
        setPalette(palette);
        // A draft row exists only once the student has actually opened the
        // paper (beginAttempt writes one), so its presence — not merely being
        // present in the room — is what "resuming" means. A student who
        // reconnects with minutes left goes straight back into the questions
        // instead of being held at the instructions screen again.
        const resuming =
          revRef.current > 0 || Object.keys(answers).length > 0 || Object.keys(palette).length > 0;
        setPhase(resuming ? "running" : "ready");
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
  }, [markSubmitted, roomId]);

  // ── Autosave: debounce 2s + 15s interval + sendBeacon on pagehide ──────────
  /**
   * Pushes the draft. Unlike the original, a non-2xx response re-arms the dirty
   * flag: a 413/429/5xx used to clear it silently and those answers were never
   * retried. A 409 `stale_draft` means another device saved something newer —
   * we adopt the server's revision instead of fighting it.
   */
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) return true;
    dirtyRef.current = false;
    const snapshot = {
      ...stateRef.current,
      rev: revRef.current,
      // Includes the segment still running, without banking it — so a mid-
      // question autosave reports the truth and the later close() still counts
      // those seconds exactly once.
      times: questionTimerRef.current?.snapshot(Date.now()) ?? {},
    };
    try {
      const res = await fetch("/api/cbt-student/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(snapshot),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { rev?: number };
        if (typeof data.rev === "number") revRef.current = Math.max(revRef.current, data.rev);
        setSync("synced");
        return true;
      }
      const data = (await res.json().catch(() => ({}))) as { code?: string; rev?: number };
      if (res.status === 409 && data.code === "stale_draft") {
        revRef.current = Math.max(revRef.current, Number(data.rev ?? 0)) + 1;
        dirtyRef.current = true;
        setSync("pending");
        return false;
      }
      if (data.code === "already_submitted" || data.code === "test_ended") {
        // The server finalized this attempt (deadline sweep, or the teacher)
        // while we were reconnecting. Stop retrying and show the end screen
        // rather than looping on a save that can never be accepted.
        setSync("synced");
        submittedRef.current = true;
        setPhase("submitted");
        markSubmitted();
        return false;
      }
      if (res.status === 401) {
        // Kicked, or this attempt was resumed elsewhere. Stop writing; the room
        // context resolves the correct terminal screen on its next refresh.
        setSync("offline");
        return false;
      }
      dirtyRef.current = true;
      setSync("pending");
      return false;
    } catch {
      dirtyRef.current = true; // retry on the next tick / when we're back online
      setSync(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "pending");
      return false;
    }
  }, [markSubmitted]);

  useEffect(() => {
    if (phase !== "running") return;
    const interval = window.setInterval(() => void flushSave(), 15_000);
    const onPageHide = () => {
      // Bank the open segment BEFORE serialising, so the last question the
      // student was on doesn't lose the time they spent on it.
      questionTimerRef.current?.close(Date.now());
      if (!dirtyRef.current) return;
      const blob = new Blob(
        [
          JSON.stringify({
            ...stateRef.current,
            rev: revRef.current,
            times: questionTimerRef.current?.snapshot(Date.now()) ?? {},
          }),
        ],
        { type: "application/json" },
      );
      navigator.sendBeacon("/api/cbt-student/answers", blob);
    };
    // Reconnecting: flush immediately rather than waiting up to 15s.
    const onOnline = () => {
      setSync("pending");
      void flushSave();
    };
    const onOffline = () => setSync("offline");
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) setSync("offline");
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void flushSave();
    };
  }, [phase, flushSave]);

  const markDirtyAndDebounce = useCallback(() => {
    dirtyRef.current = true;
    revRef.current += 1;
    setSync((prev) => (prev === "offline" ? prev : "pending"));
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void flushSave(), 2000);
  }, [flushSave]);

  // Mirror every change to this device. Runs as an effect (not inline in the
  // mutation) so it sees the committed state rather than the pre-update
  // snapshot. This copy is what survives a crash, a killed tab, or an outage
  // that outlives the session — it is replayed on the next load when it is
  // ahead of the server.
  useEffect(() => {
    if (phase !== "running" && phase !== "ready") return;
    if (!roomId || !participantIdRef.current) return;
    saveLocalDraft(roomId, participantIdRef.current, {
      rev: revRef.current,
      answers,
      palette,
      times: questionTimerRef.current?.snapshot(Date.now()) ?? {},
    });
  }, [answers, palette, phase, roomId]);

  // ── Per-question stopwatch lifecycle ───────────────────────────────────────
  // One segment is open at a time, for the question actually on screen. Every
  // transition — navigating, backgrounding, losing the network, leaving the
  // running phase — closes it, so seconds are counted in exactly one place and
  // no path can double-count them.
  const activePosition = flat[index]?.q.position ?? null;
  useEffect(() => {
    const timer = questionTimerRef.current;
    if (!timer) return;
    if (phase !== "running" || activePosition === null) {
      timer.close(Date.now());
      return;
    }

    const resume = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      timer.open(activePosition, Date.now());
    };
    const pause = () => timer.close(Date.now());

    resume();

    const onVisibility = () => (document.hidden ? pause() : resume());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pause);
    window.addEventListener("focus", resume);
    window.addEventListener("offline", pause);
    window.addEventListener("online", resume);
    return () => {
      pause();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pause);
      window.removeEventListener("focus", resume);
      window.removeEventListener("offline", pause);
      window.removeEventListener("online", resume);
    };
  }, [phase, activePosition]);

  // ── Full-screen request ────────────────────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    containerRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  /**
   * Opening the paper. The immediate save is what makes a resume exact: it
   * creates the draft row, so if the machine dies before a single answer is
   * given, coming back lands in the questions rather than at the instructions
   * screen with the clock already half gone.
   */
  const beginAttempt = useCallback(() => {
    enterFullscreen();
    setPhase("running");
    markDirtyAndDebounce();
  }, [enterFullscreen, markDirtyAndDebounce]);

  // ── Submit (manual, auto-at-zero, and drain-safe idempotent) ───────────────
  /**
   * A submission only counts once the SERVER says so.
   *
   * This used to set the terminal "submitted" phase even when the request threw
   * — so a student who pressed Submit during a network blip was locked out of a
   * test the server still considered live, with no way back in. Now a failure
   * keeps them in the paper (answers intact, timer running) and retries in the
   * background; the deadline finalization remains the backstop if they never
   * get a connection back.
   */
  const submit = useCallback(
    async (auto: boolean, malpractice = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setPhase("submitting");
      setSubmitError(null);
      // Bank the segment for the question they were on and force the flush:
      // grading reads the server-held draft, so the final seconds have to be up
      // there before the submit request — and flushSave() no-ops when nothing
      // else changed since the last autosave.
      questionTimerRef.current?.close(Date.now());
      dirtyRef.current = true;
      revRef.current += 1;
      await flushSave();

      const body = JSON.stringify({ auto, malpractice, violations });
      // ~1s, 2s, 4s, 8s, 15s — about half a minute of trying before we hand the
      // student back their paper with an explanation.
      const backoffs = [1_000, 2_000, 4_000, 8_000, 15_000];
      for (let attempt = 0; attempt <= backoffs.length; attempt += 1) {
        try {
          const res = await fetch("/api/cbt-student/submit", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body,
          });
          if (res.ok) {
            if (roomId && participantIdRef.current) clearLocalDraft(roomId, participantIdRef.current);
            if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
            setPhase("submitted");
            // Promote to the room-level terminal phase so the context unmounts
            // this player: a submitted student must never re-enter the test
            // (e.g. via a browser Back / bfcache restore of this frozen view).
            // Hand off the own-attempt counts so the terminal ThankYou screen
            // can show a post-submit summary (P1 3.5) after this unmounts.
            markSubmitted(summaryRef.current);
            return;
          }
          if (res.status === 401) break; // kicked or resumed elsewhere
        } catch {
          // network down — fall through to the retry delay
        }
        if (attempt < backoffs.length) {
          setSubmitError("Couldn't reach the server. Your answers are saved — retrying…");
          await new Promise((resolve) => setTimeout(resolve, backoffs[attempt]));
        }
      }

      // Give the paper back rather than pretending it was submitted.
      submittedRef.current = false;
      setPhase("running");
      setSubmitError(
        "We couldn't submit yet — you're offline. Your answers are saved and will be submitted automatically when the time ends. Keep this page open if you can.",
      );
    },
    [flushSave, markSubmitted, roomId, violations],
  );

  // Auto-submit when the server-anchored timer hits zero.
  useEffect(() => {
    if (phase === "running" && remaining <= 0 && payload) void submit(true);
  }, [phase, remaining, payload, submit]);

  // ── Malpractice / fraud detection (3-strike, ported from TestInterface) ─────
  // Leaving full-screen counts immediately; tab-hide / window-blur get a 1s
  // grace window (cleared if the student returns in time). 3rd strike →
  // terminate + auto-submit flagged as malpractice.
  useEffect(() => {
    if (phase !== "running") return;

    // Anti-false-kick guards (students were auto-exited on entry):
    //  • SETTLE window — ignore ANY violation in the first few seconds after the
    //    exam opens, so the entry/fullscreen/keyboard transition can't rack up
    //    strikes before the student has done anything.
    //  • Fullscreen-exit only counts on a real desktop (pointer:fine). On phones
    //    element-fullscreen is unreliable (rejects / auto-exits on keyboard or
    //    notification), which was instantly firing violations — there, tab-switch
    //    / visibility detection carries the anti-cheat instead.
    //  • OFFLINE SUPPRESSION — a dropped connection is not cheating. A frozen
    //    machine, an OS network dialog, or alt-tabbing to reconnect Wi-Fi all
    //    look exactly like a tab switch, and three of them used to auto-submit
    //    the paper. While the browser reports no connection, strikes are not
    //    counted at all.
    //  • GRACE 3s (was 1s) — a phone call or a system notification shouldn't
    //    cost a strike either.
    const SETTLE_MS = 4000;
    const VIOLATION_GRACE_MS = 3000;
    const startedAt = Date.now();
    const fullscreenViolationsEnabled =
      typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches === true;
    const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

    const handleViolation = () => {
      if (malpracticeTerminated) return;
      if (Date.now() - startedAt < SETTLE_MS) return; // settle window
      if (isOffline()) return; // disconnection, not malpractice
      setViolations((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          setTimeout(() => {
            setMalpracticeTerminated(true);
            void submit(true, true);
          }, 0);
        } else {
          setTimeout(() => setShowMalpracticeWarning(true), 0);
        }
        return next;
      });
    };

    const startTimer = () => {
      if (isOffline()) return;
      if (!malpracticeTimerRef.current && !malpracticeTerminated) {
        malpracticeTimerRef.current = window.setTimeout(() => {
          handleViolation();
          malpracticeTimerRef.current = undefined;
        }, VIOLATION_GRACE_MS);
      }
    };
    const stopTimer = () => {
      if (malpracticeTimerRef.current) {
        window.clearTimeout(malpracticeTimerRef.current);
        malpracticeTimerRef.current = undefined;
      }
    };

    const onVisibility = () => { if (document.hidden) startTimer(); else stopTimer(); };
    const onBlur = () => startTimer();
    const onFocus = () => stopTimer();
    const onFullscreenChange = () => {
      if (fullscreenViolationsEnabled && !document.fullscreenElement) handleViolation();
    };

    // Losing the connection cancels any pending strike outright.
    const onOffline = () => stopTimer();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("offline", onOffline);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [phase, submit, malpracticeTerminated]);

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
      setImgZoomed(false);
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

  // Per-subject LOCAL numbering: each flat item's 1-based index within its own
  // subject section (so the student sees "Question 1..N" per subject, not a
  // global 1..total). Also groups flat indices by subject for the palette.
  const localInfo = useMemo(() => {
    const counters = new Map<string, number>();
    return flat.map((f) => {
      const subj = f.subject || "General";
      const n = (counters.get(subj) ?? 0) + 1;
      counters.set(subj, n);
      return { subject: subj, localNumber: n };
    });
  }, [flat]);

  const paletteGroups = useMemo(() => {
    const groups: { subject: string; items: { flatIndex: number; localNumber: number }[] }[] = [];
    const bySubject = new Map<string, { subject: string; items: { flatIndex: number; localNumber: number }[] }>();
    flat.forEach((f, idx) => {
      const subj = f.subject || "General";
      let g = bySubject.get(subj);
      if (!g) {
        g = { subject: subj, items: [] };
        bySubject.set(subj, g);
        groups.push(g);
      }
      g.items.push({ flatIndex: idx, localNumber: localInfo[idx].localNumber });
    });
    return groups;
  }, [flat, localInfo]);

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
                  <li>
                    If you lose your connection, <span className="font-bold text-foreground">keep calm</span> — your
                    answers are saved and the test is <span className="font-bold text-foreground">not</span> submitted
                    early. Reopen this link with your room code to carry on where you left off.
                  </li>
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
                  <li>• The exam opens in <span className="font-bold text-red-600 dark:text-red-400">full-screen</span>. Exiting full-screen counts as a violation.</li>
                  <li>• Switching tabs or minimizing the browser triggers a malpractice warning.</li>
                  <li>• After <span className="font-bold text-red-600 dark:text-red-400">3 violations</span>, the test is automatically submitted and reported.</li>
                </ul>
              </section>

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
                onClick={beginAttempt}
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
    <div ref={containerRef} className="flex h-dvh flex-col overflow-y-auto overscroll-contain neu-surface text-foreground" style={{ touchAction: 'pan-y' }}>
      {/* 0. Connectivity banner — the student must never have to guess whether
             their answers are safe, or fear being cut off for going offline. */}
      {sync !== "synced" || submitError ? (
        <div
          role="status"
          className={`shrink-0 flex items-start gap-2 px-3 py-2 text-[11px] font-bold sm:px-6 ${
            sync === "offline"
              ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
              : "bg-sky-500/10 text-sky-800 dark:text-sky-300"
          }`}
        >
          <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {submitError
              ? submitError
              : sync === "offline"
                ? "You're offline. Your answers are saved on this device and will sync automatically — your test will NOT be submitted early."
                : "Saving your answers…"}
          </span>
        </div>
      ) : null}

      {/* 1. Branded header */}
      <header className="shrink-0 flex flex-col items-center justify-between gap-3 border-b border-border/60 px-3 py-2 sm:flex-row sm:gap-0 sm:px-6">
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
          <OriBrandMark compact />
          <div>
            <h1 className="text-sm font-black leading-tight text-rose-900 dark:text-rose-300 sm:text-xl">O3 ORIGIN TESTING AGENCY</h1>
            <p className="text-[10px] font-semibold italic text-emerald-700 dark:text-emerald-400 sm:text-xs">Excellence in Assessment</p>
          </div>
          {/* Co-branding lockup: Origin × the institute (logo + name), shown only
              when the room has an institute set. */}
          {(instituteName || (instituteLogo && !instituteLogoBroken)) ? (
            <div className="flex items-center gap-2 border-l border-border/50 pl-3">
              <span className="text-lg font-black text-muted-foreground">×</span>
              {instituteLogo && !instituteLogoBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={instituteLogo}
                  alt={instituteName ?? "Institute"}
                  onError={() => setInstituteLogoBroken(true)}
                  className="h-8 w-8 shrink-0 rounded-lg object-contain sm:h-10 sm:w-10"
                />
              ) : null}
              {instituteName ? (
                <span className="max-w-[8rem] truncate text-xs font-black tracking-tight text-foreground sm:text-sm" title={instituteName}>
                  {instituteName}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-0.5 text-[10px] font-semibold sm:gap-1 sm:text-xs">
          <div className="flex"><span className="w-20 text-muted-foreground sm:w-28">Candidate:</span> <span className="truncate font-mono text-primary">{studentCode || "—"}</span></div>
          <div className="flex"><span className="w-20 text-muted-foreground sm:w-28">Subject:</span> <span className="truncate text-primary">{activeSubject}</span></div>
          <div className="flex items-center"><span className="w-20 text-muted-foreground sm:w-28">Remaining:</span> <span className={`rounded px-2 py-0.5 font-mono font-bold text-white ${remaining <= 60 ? "bg-red-600 animate-pulse" : "bg-rose-500"}`} suppressHydrationWarning>{formatClock(remaining)}</span></div>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400">
              Attempted <span className="font-mono">{attempted}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 font-bold text-red-600 dark:text-red-400">
              Skipped <span className="font-mono">{skipped}</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. Section / subject bar */}
      <div className="flex items-center gap-0 overflow-x-auto bg-[#f08c32] px-0 no-scrollbar">
        <div className="flex h-[38px] shrink-0 items-center border-r border-white/20 bg-primary px-4 text-xs font-bold text-white">SECTION</div>
        {subjects.map((subj) => {
          const isActive = activeSubject === subj;
          const st = sectionStats[subj];
          return (
            <button
              key={subj}
              onClick={() => jumpToSubject(subj)}
              className={`flex h-[38px] shrink-0 items-center gap-2 border-r border-white/20 px-4 text-xs font-bold uppercase transition-all ${isActive ? "bg-white text-black" : "bg-primary text-white hover:bg-primary/90"}`}
            >
              {subj}
              {st ? (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-black tabular-nums ${isActive ? "bg-black/10 text-black" : "bg-white/20 text-white"}`}>
                  {st.attempted}/{st.total}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 lg:flex-row">
        {/* Main question column */}
        <main className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-foreground">
              <span className="text-primary">{activeSubject}</span> · Question {localInfo[index]?.localNumber ?? index + 1}{" "}
              <span className="text-muted-foreground">of {sectionStats[activeSubject]?.total ?? flat.length}</span>
            </span>
            <span className="flex items-center gap-2 text-[11px] font-bold">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">+{current.q.marks}</span>
              <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-red-600 dark:text-red-400">{current.q.negativeMarks}</span>
            </span>
          </div>

          <div className="neu-raised rounded-2xl p-4 sm:p-5 text-base leading-relaxed">
            <LatexRenderer content={current.q.stem} />
            {current.q.image ? (
              <button
                type="button"
                onClick={() => setImgZoomed(true)}
                className="group relative mt-4 block cursor-zoom-in"
                aria-label="Zoom question image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.q.image}
                  alt="Question diagram"
                  className="max-h-80 w-auto max-w-full rounded-xl object-contain"
                />
                <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-3.5 w-3.5" /> Zoom
                </span>
              </button>
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

          {/* Grid — grouped by subject, numbered 1..N within each section.
              Its own bounded scroll region so dragging it doesn't scroll the
              whole page (max-height caps it; overscroll-contain traps the wheel). */}
          <div className="neu-raised rounded-2xl p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Question Palette</p>
            <div className="max-h-[45vh] space-y-4 overflow-y-auto overscroll-contain pr-1 lg:max-h-[420px]" style={{ touchAction: 'pan-y' }}>
              {paletteGroups.map((group) => (
                <div key={group.subject} className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary">{group.subject}</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {group.items.map(({ flatIndex, localNumber }) => {
                      const status = palette[flat[flatIndex].q.position] ?? "not_visited";
                      return (
                        <button
                          key={flat[flatIndex].q.position}
                          onClick={() => goTo(flatIndex)}
                          className={`h-8 rounded-lg text-xs font-bold transition-all ${PALETTE_STYLE[status]} ${flatIndex === index ? "outline outline-2 outline-primary" : ""}`}
                          title={`${group.subject} · Question ${localNumber}`}
                        >
                          {localNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
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

      {/* Fullscreen question-image zoom (parity with the main test player) */}
      {imgZoomed && current.q.image ? (
        <div
          className="fixed inset-0 z-[230] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setImgZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setImgZoomed(false)}
            aria-label="Close zoom"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.q.image}
            alt="Question diagram (zoomed)"
            className="max-h-[92vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

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

      {/* Malpractice warning (violation < 3) — scroll-safe + mobile-sized */}
      {showMalpracticeWarning ? (
        <div className="fixed inset-0 z-[210] flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.2)] max-w-md w-full my-auto overflow-hidden border-t-8 border-yellow-500">
            <div className="bg-yellow-500/10 p-6 sm:p-8 text-center border-b border-yellow-100">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-yellow-500/40">
                <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Warning: Security Alert</h2>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white text-xs font-black rounded-full uppercase tracking-widest mb-4">
                Violation {violations} of 3
              </div>
            </div>
            <div className="p-6 sm:p-8 space-y-5 sm:space-y-6">
              <div className="space-y-3">
                <p className="text-gray-900 font-bold text-center text-lg italic">&quot;Security violation detected&quot;</p>
                <p className="text-gray-500 text-sm text-center leading-relaxed">
                  The system detected that you left full-screen or switched tabs.
                  This is a direct violation of the <span className="font-bold text-primary">O3 Testing Agency</span> exam rules.
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <p className="text-red-700 text-[10px] font-black uppercase tracking-widest text-center">Final Warning Consequences</p>
                <p className="text-red-600 text-[11px] font-bold text-center mt-1">
                  Exceeding 3 violations will result in automatic test termination and disqualification.
                </p>
              </div>
              <button
                onClick={() => { enterFullscreen(); setShowMalpracticeWarning(false); }}
                className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all shadow-xl active:scale-95 text-lg uppercase tracking-tight"
              >
                Return to Examination
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Malpractice termination (3rd violation → auto-submit) — scroll-safe + mobile-sized */}
      {malpracticeTerminated ? (
        <div className="fixed inset-0 z-[220] flex items-start sm:items-center justify-center bg-red-950/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.3)] max-w-md w-full my-auto p-6 sm:p-10 text-center border-t-8 border-red-600">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 animate-pulse">
              <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-red-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-red-600 mb-4 uppercase tracking-tighter">Test Terminated</h2>
            <p className="text-xl font-bold text-gray-900 mb-2">MALPRACTICE DETECTED</p>
            <p className="text-gray-600 mb-6 sm:mb-10 leading-relaxed font-semibold">
              You have exceeded the maximum number of warnings for leaving the test screen.
              The test has been suspended and reported.
            </p>
            <div className="flex items-center justify-center gap-3 text-red-600 font-bold animate-bounce text-lg">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span>
              SUBMITTING RESULTS...
            </div>
          </div>
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
                <span className="min-w-0 space-y-2 pt-0.5">
                  {opt.text ? <LatexRenderer content={opt.text} /> : null}
                  {opt.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={opt.image} alt={`Option ${String.fromCharCode(65 + i)}`} className="max-h-48 w-auto max-w-full rounded-lg border border-border/60 object-contain" />
                  ) : null}
                </span>
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
                <span className="min-w-0 space-y-2 pt-0.5">
                  {opt.text ? <LatexRenderer content={opt.text} /> : null}
                  {opt.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={opt.image} alt={`Option ${String.fromCharCode(65 + i)}`} className="max-h-48 w-auto max-w-full rounded-lg border border-border/60 object-contain" />
                  ) : null}
                </span>
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
