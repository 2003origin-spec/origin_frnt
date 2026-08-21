'use client';

/**
 * Contest attempt client hook (plan Phase 3 UI). Encapsulates the reusable
 * runtime logic — server-authoritative skew-corrected countdown, rev-guarded
 * autosave (debounce + interval + pagehide), the 3-strike violation state
 * machine, and submit — over the contest APIs. Adapted from CbtTestInterface's
 * logic; the visual shell is separate.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { track } from '@/lib/analytics';

export interface PaperQuestion {
  position: number;
  questionId: string;
  subject: string | null;
  text: string;
  options: string[] | null;
  questionType: string;
}

export interface AttemptState {
  started: boolean;
  startedAt: string | null;
  endAt: string | null;
  serverNow: string;
  remainingSeconds: number;
  locked: boolean;
}

export type Phase = 'loading' | 'instructions' | 'running' | 'submitting' | 'submitted' | 'error';

/** Client answer per position: a chosen MCQ option index. */
type AnswerMap = Record<string, { selectedOption?: number }>;

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
          // resume: skip the instructions gate, load the paper
          const qs = await loadPaper();
          if (cancelled) return;
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
      await fetch('/api/contest/answers', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
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
      const blob = JSON.stringify({ contestId, answers: answersRef.current, rev: revRef.current });
      navigator.sendBeacon?.('/api/contest/answers', new Blob([blob], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', onHide);
    };
  }, [phase, flushSave, contestId]);

  const setAnswer = useCallback(
    (position: number, selectedOption: number) => {
      setAnswers((prev) => ({ ...prev, [String(position)]: { selectedOption } }));
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void flushSave(), 2000);
    },
    [flushSave],
  );

  // ── submit ─────────────────────────────────────────────────────────────────
  const submit = useCallback(
    async (opts: { malpractice?: boolean; violationCount?: number } = {}) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPhase('submitting');
      await flushSave().catch(() => undefined);
      try {
        const res = await fetch('/api/contest/submit', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
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

  // ── 3-strike anti-cheat: tab-switch / blur counts a violation ──────────────
  useEffect(() => {
    if (phase !== 'running') return;
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        setViolations((v) => {
          const next = v + 1;
          if (next >= MAX_VIOLATIONS) void submit({ malpractice: true, violationCount: next });
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [phase, submit]);

  const begin = useCallback(async () => {
    try {
      setPhase('loading');
      const res = await fetch('/api/contest/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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
    begin,
    submit,
  };
}
