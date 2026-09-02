'use client';

/**
 * Contest attempt client hook (plan Phase 3 UI). Encapsulates the reusable
 * runtime logic — server-authoritative skew-corrected countdown, rev-guarded
 * autosave (debounce + interval + pagehide), the 3-strike violation state
 * machine, and submit — over the contest APIs. Adapted from CbtTestInterface's
 * logic; the visual shell is separate.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';

import { track } from '@/lib/analytics';
import { mutateJson, csrfHeaders } from '@/lib/csrf';
import { shouldCountViolation } from '@/lib/contest/contest-state';

export interface PaperQuestion {
  position: number;
  questionId: string;
  subject: string | null;
  text: string;
  options: string[] | null;
  questionType: string;
  image: string | null;
  optionImages: (string | null)[] | null;
}

export interface AttemptState {
  started: boolean;
  startedAt: string | null;
  endAt: string | null;
  serverNow: string;
  remainingSeconds: number;
  locked: boolean;
  savedAnswers?: AnswerMap | null;
  savedPalette?: Record<string, unknown> | null;
  savedRev?: number;
}

export type Phase = 'loading' | 'instructions' | 'running' | 'submitting' | 'submitted' | 'error';

/** Client answer per position. MCQ = selectedOption; MSQ = selectedOptions;
 *  numerical = answerText. The server stores answers opaquely and grade.ts reads
 *  the matching field per questionType, so this is the only place the shape lives. */
type AnswerMap = Record<string, { selectedOption?: number; selectedOptions?: number[]; answerText?: string }>;

const MAX_VIOLATIONS = 3;

export function useContestAttempt(contestId: string) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PaperQuestion[]>([]);
  const [state, setState] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [violations, setViolations] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const skewRef = useRef(0);
  const revRef = useRef(0);
  const answersRef = useRef<AnswerMap>({});
  const debounceRef = useRef<number | undefined>(undefined);
  const submittingRef = useRef(false);
  answersRef.current = answers;

  // ── server-authoritative remaining seconds (skew-corrected) ────────────────
  const remaining = useMemo(() => {
    if (!state?.endAt) return 0;
    const end = new Date(state.endAt).getTime();
    return Math.max(0, Math.floor((end - (now - skewRef.current)) / 1000));
  }, [state?.endAt, now]);

  // tick the display clock
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [phase]);

  // ── load state + paper ─────────────────────────────────────────────────────
  const loadState = useCallback(async () => {
    const sentAt = Date.now();
    const res = await fetch(`/api/contest/state?contestId=${encodeURIComponent(contestId)}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed to load contest.');
    const { state: st } = (await res.json()) as { state: AttemptState };
    // skew = local clock - server clock (accounting for ~half the round trip)
    const rtt = Date.now() - sentAt;
    skewRef.current = sentAt + rtt / 2 - new Date(st.serverNow).getTime();
    return st;
  }, [contestId]);

  const loadPaper = useCallback(async () => {
    const res = await fetch(`/api/contest/paper?contestId=${encodeURIComponent(contestId)}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed to load the paper.');
    const { paper } = (await res.json()) as { paper: { questions: PaperQuestion[] } };
    track('contest_paper_open', { contest_id: contestId });
    return paper.questions;
  }, [contestId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const st = await loadState();
        if (cancelled) return;
        setState(st);
        if (st.locked) {
          setPhase('submitted');
        } else if (st.started) {
          // resume: skip the instructions gate, load the paper AND rehydrate the
          // saved answers/rev so the user doesn't see a blank paper (and later
          // autosaves don't overwrite the durable draft with a partial set).
          const qs = await loadPaper();
          if (cancelled) return;
          if (st.savedAnswers) {
            setAnswers(st.savedAnswers);
            answersRef.current = st.savedAnswers;
          }
          revRef.current = st.savedRev ?? 0;
          setQuestions(qs);
          setPhase('running');
        } else {
          setPhase('instructions');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Something went wrong.');
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadState, loadPaper]);

  // ── autosave (debounce 2s + interval 15s + pagehide beacon) ────────────────
  const flushSave = useCallback(async () => {
    if (submittingRef.current) return;
    revRef.current += 1;
    try {
      await mutateJson('/api/contest/answers', {
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({ contestId, answers: answersRef.current, rev: revRef.current }),
      });
    } catch {
      /* transient — the next save retries */
    }
  }, [contestId]);

  useEffect(() => {
    if (phase !== 'running') return;
    const interval = window.setInterval(() => void flushSave(), 15_000);
    const onHide = () => {
      revRef.current += 1;
      // sendBeacon can't set the CSRF header (→ 403), so use a keepalive fetch
      // that carries it. keepalive lets the request outlive the unloading page.
      void fetch('/api/contest/answers', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ contestId, answers: answersRef.current, rev: revRef.current }),
      }).catch(() => undefined);
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', onHide);
    };
  }, [phase, flushSave, contestId]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void flushSave(), 2000);
  }, [flushSave]);

  const setAnswer = useCallback(
    (position: number, selectedOption: number) => {
      setAnswers((prev) => ({ ...prev, [String(position)]: { selectedOption } }));
      scheduleSave();
    },
    [scheduleSave],
  );

  /** MSQ: toggle one option in the selected set (empty set clears the answer). */
  const toggleAnswerOption = useCallback(
    (position: number, option: number) => {
      setAnswers((prev) => {
        const cur = new Set(prev[String(position)]?.selectedOptions ?? []);
        if (cur.has(option)) cur.delete(option);
        else cur.add(option);
        const next = { ...prev };
        if (cur.size === 0) delete next[String(position)];
        else next[String(position)] = { selectedOptions: [...cur].sort((a, b) => a - b) };
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  /** Numerical: set (or clear) the typed answer text. */
  const setAnswerText = useCallback(
    (position: number, answerText: string) => {
      setAnswers((prev) => {
        const next = { ...prev };
        if (!answerText.trim()) delete next[String(position)];
        else next[String(position)] = { answerText };
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  // ── submit ─────────────────────────────────────────────────────────────────
  const submit = useCallback(
    async (opts: { malpractice?: boolean; violationCount?: number } = {}) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPhase('submitting');
      await flushSave().catch(() => undefined);
      try {
        const res = await mutateJson('/api/contest/submit', {
          method: 'POST',
          body: JSON.stringify({ contestId, ...opts }),
        });
        if (!res.ok && res.status !== 409) {
          throw new Error((await res.json().catch(() => ({}))).detail || 'Submit failed.');
        }
        track('contest_submit', { contest_id: contestId, reason: opts.malpractice ? 'malpractice' : 'manual' });
        setPhase('submitted');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Submit failed.');
        submittingRef.current = false;
        setPhase('running');
      }
    },
    [contestId, flushSave],
  );

  // auto-submit at zero
  useEffect(() => {
    if (phase === 'running' && remaining <= 0 && state?.started) {
      void submit({ violationCount: violations });
    }
  }, [phase, remaining, state?.started, submit, violations]);

  // ── 3-strike anti-cheat: only a SUSTAINED exit counts (mobile-safe) ─────────
  // Brief blurs (notifications, quick switches, the keyboard) fire
  // visibilitychange too; counting them ejected legit mobile students. We start
  // a timer on hide and only count a strike when the user RETURNS after ≥ the
  // grace, with an escalating warning each time.
  useEffect(() => {
    if (phase !== 'running') return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      // back to visible
      if (!hiddenAt) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = 0;
      if (!shouldCountViolation(away)) return; // brief blur — ignore
      setViolations((v) => {
        const next = v + 1;
        if (next >= MAX_VIOLATIONS) {
          toast.error('Final warning — your attempt has been submitted for leaving the test repeatedly.');
          void submit({ malpractice: true, violationCount: next });
        } else {
          toast.warning(`Warning ${next}/${MAX_VIOLATIONS} — leaving the test is flagged. Stay on this screen.`);
        }
        return next;
      });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase, submit]);

  const begin = useCallback(async () => {
    try {
      setPhase('loading');
      const res = await mutateJson('/api/contest/start', {
        method: 'POST',
        body: JSON.stringify({ contestId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Could not start.');
      const { state: st } = (await res.json()) as { state: AttemptState };
      setState(st);
      const qs = await loadPaper();
      setQuestions(qs);
      setPhase('running');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start.');
      setPhase('error');
    }
  }, [contestId, loadPaper]);

  return {
    phase,
    error,
    questions,
    state,
    answers,
    violations,
    remaining,
    maxViolations: MAX_VIOLATIONS,
    setAnswer,
    toggleAnswerOption,
    setAnswerText,
    begin,
    submit,
  };
}
