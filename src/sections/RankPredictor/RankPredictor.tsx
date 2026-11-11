'use client';

/**
 * Rank Predictor page (plan §9.1). Mobile first. The browser only collects
 * marks and sends them; the tables and maths stay on the server.
 *
 * Privacy (plan §12.1): category, PwD and home state are kept in this tab's
 * memory only, unless the student turns on "Remember my details on this
 * device" (off by default) — then in localStorage, never on our server.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ClipboardList, Loader2, LogIn, RotateCcw } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

import type { AttemptFill } from '@/lib/rank-predictor/attempt-mapping';
import { DISCLAIMER, EXAM_LABEL, categoryLabel } from '@/lib/rank-predictor/format';
import { NEET_STATES_WITH_LIST } from '@/lib/rank-predictor/states';
import { EXAM_MAX_MARKS, EXAM_SUBJECTS } from '@/lib/rank-predictor/subjects';
import { FREE_CHECKS_PER_DAY, RANK_CATEGORIES, RANK_PREDICTOR_EXAMS, type RankCategory, type RankPredictorExam } from '@/lib/rank-predictor/types';
import { INDIAN_STATES } from '@/lib/constants';

import { fetchAccess, fetchAttemptFill, friendlyError, PredictorError, requestPrediction, type Access, type PredictionResponse } from './api';
import FillFromTests from './FillFromTests';
import { buildPredictInput, marksTotal } from './form';
import LimitSheet from './LimitSheet';
import { freeChecksLine, LOGIN_HREF } from './login-links';
import { savePending, takePending } from './pending';
import ResultCard from './ResultCard';
import { handoffFromPrediction, saveHandoff } from '@/sections/CollegeFinder/handoff';

export type ShiftOption = { id: string; date: string; shift: number };

const REMEMBER_KEY = 'origin:rank-predictor:details';

type Details = { category: RankCategory; pwd: boolean; homeState: string };

function readRemembered(): Details | null {
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Details>;
    if (!parsed.category || !(RANK_CATEGORIES as readonly string[]).includes(parsed.category)) return null;
    return {
      category: parsed.category,
      pwd: Boolean(parsed.pwd),
      homeState: typeof parsed.homeState === 'string' && (INDIAN_STATES as string[]).includes(parsed.homeState) ? parsed.homeState : '',
    };
  } catch {
    return null;
  }
}

type MarksState = Record<RankPredictorExam, Record<string, string>>;

const EMPTY_MARKS: MarksState = { neet: {}, 'jee-main': {}, 'jee-advanced': {} };

const fieldFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function RankPredictor({
  initialExam,
  shiftOptions,
  initialAttemptId,
  collegesEnabled = false,
}: {
  initialExam: RankPredictorExam;
  shiftOptions: ShiftOption[];
  initialAttemptId: string | null;
  /** College finder live (plan §11): the result card links to it. */
  collegesEnabled?: boolean;
}) {
  const ids = useId();
  // Seeded from the server render, and it also recovers a session client-side
  // (expired access token + valid refresh cookie), so it decides who is signed in.
  const { user: authUser, refreshUser } = useAuth();
  const signedIn = Boolean(authUser);
  // "Fill from my tests" reads the caller's own attempts: signed-in students only.
  const canFill = authUser?.role === 'student';
  const [exam, setExam] = useState<RankPredictorExam>(initialExam);
  const [marks, setMarks] = useState<MarksState>(EMPTY_MARKS);
  const [category, setCategory] = useState<RankCategory>('general');
  const [pwd, setPwd] = useState(false);
  const [homeState, setHomeState] = useState('');
  const [shift, setShift] = useState('');
  const [remember, setRemember] = useState(false);
  const [fill, setFill] = useState<AttemptFill | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [whatIfDelta, setWhatIfDelta] = useState<number | null>(null);
  /** Logged-out visitors only: free checks left today (null until known). */
  const [access, setAccess] = useState<Access | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const autoRan = useRef(false);

  // Restore remembered details (opt-in only).
  useEffect(() => {
    const saved = readRemembered();
    if (saved) {
      setRemember(true);
      setCategory(saved.category);
      setPwd(saved.pwd);
      setHomeState(saved.homeState);
    }
  }, []);

  useEffect(() => {
    try {
      if (remember) window.localStorage.setItem(REMEMBER_KEY, JSON.stringify({ category, pwd, homeState }));
      else window.localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // Storage blocked: nothing is remembered, which is the safe default.
    }
  }, [remember, category, pwd, homeState]);

  const boxes = EXAM_SUBJECTS[exam];
  const examMarks = marks[exam];
  const total = marksTotal(exam, examMarks);
  const source = useMemo(
    () =>
      fill && fill.exam === exam
        ? { kind: fill.resultId ? ('attempt' as const) : ('avg3' as const), ...(fill.resultId ? { resultId: fill.resultId } : {}) }
        : undefined,
    [fill, exam],
  );

  const buildInput = useCallback(
    () => buildPredictInput({ exam, marks: examMarks, category, pwd, homeState, shift, source }),
    [examMarks, exam, category, pwd, homeState, shift, source],
  );

  // Visitors: how many free checks are left today (a read; it never uses one).
  useEffect(() => {
    if (signedIn) {
      setAccess(null);
      return;
    }
    let live = true;
    fetchAccess()
      .then((a) => {
        if (!live) return;
        setAccess(a);
        // The call refreshed a stale session: let the auth context catch up.
        if (a.signedIn) void refreshUser();
      })
      .catch(() => undefined); // The line under the button just stays generic.
    return () => {
      live = false;
    };
  }, [signedIn, refreshUser]);

  const outOfChecks = !signedIn && access?.remainingToday === 0;

  /** Keep the form in this tab for the login round-trip (plan §8.4). */
  const keepForLogin = useCallback(
    (predictAfter: boolean) => {
      // A result on screen comes back after login too.
      savePending({ exam, marks: marks[exam], category, pwd, homeState, shift, predict: predictAfter || result !== null });
    },
    [exam, marks, category, pwd, homeState, shift, result],
  );

  const predict = useCallback(async () => {
    const built = buildInput();
    if ('error' in built) {
      setFieldError(built.error);
      const el = document.getElementById(`${ids}-${built.error.field.replace('marks.', '')}`);
      el?.focus();
      return;
    }
    setFieldError(null);
    setRequestError(null);
    setLoading(true);
    try {
      const response = await requestPrediction(built.input);
      setResult(response);
      setWhatIfDelta(null);
      setAccess(response.access);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) {
      if (error instanceof PredictorError && error.code === 'login_required') {
        setAccess(error.access ?? { signedIn: false, remainingToday: 0, limit: FREE_CHECKS_PER_DAY });
        setLimitOpen(true);
      } else {
        setRequestError(friendlyError(error, 'Something went wrong. Try again.'));
      }
    } finally {
      setLoading(false);
    }
  }, [buildInput, ids]);

  const onSubmit = () => {
    // Out of free checks: the button reads "Log in for unlimited checks" and
    // opens the login sheet; the shown result stays on the page.
    if (outOfChecks) {
      setLimitOpen(true);
      return;
    }
    void predict();
  };

  const applyFill = useCallback((f: AttemptFill) => {
    setFill(f);
    setExam(f.exam);
    setMarks((prev) => ({
      ...prev,
      [f.exam]: { ...prev[f.exam], ...Object.fromEntries(Object.entries(f.marks).map(([id, box]) => [id, String(box.value)])) },
    }));
    setResult(null);
    setWhatIfDelta(null);
  }, []);

  // Back from the login prompt: restore the form; re-run the prediction once the
  // visitor is signed in (plan §8.4). Read once, then deleted.
  const [pendingAuto, setPendingAuto] = useState(false);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || initialAttemptId) return;
    restored.current = true;
    const saved = takePending();
    if (!saved) return;
    setExam(saved.exam);
    setMarks((prev) => ({ ...prev, [saved.exam]: saved.marks }));
    setCategory(saved.category);
    setPwd(saved.pwd);
    setHomeState(saved.homeState);
    setShift(saved.shift);
    // Re-run after login, or straight away when this exact input already got a
    // result today (from the landing widget): a repeat never uses a free check.
    if (saved.predict && (signedIn || saved.alreadyCounted)) setPendingAuto(true);
  }, [initialAttemptId, signedIn]);

  // Opened from a mock result ("See details"): fill from that attempt, then predict once.
  useEffect(() => {
    if (!initialAttemptId || autoRan.current) return;
    autoRan.current = true;
    fetchAttemptFill(initialAttemptId)
      .then((f) => {
        applyFill(f);
        setPendingAuto(true);
      })
      .catch(() => setRequestError('Could not load that test. Type your marks instead.'));
  }, [initialAttemptId, applyFill]);
  useEffect(() => {
    if (pendingAuto) {
      setPendingAuto(false);
      void predict();
    }
  }, [pendingAuto, predict]);

  const setMark = (id: string, value: string) => {
    setMarks((prev) => ({ ...prev, [exam]: { ...prev[exam], [id]: value } }));
    if (fill && fill.exam === exam && fill.marks[id] && String(fill.marks[id].value) !== value) setFill(null);
    if (fieldError?.field === `marks.${id}`) setFieldError(null);
  };

  const switchExam = (next: RankPredictorExam) => {
    setExam(next);
    setResult(null);
    setWhatIfDelta(null);
    setFieldError(null);
    setRequestError(null);
  };

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + RANK_PREDICTOR_EXAMS.length) % RANK_PREDICTOR_EXAMS.length;
    const next = RANK_PREDICTOR_EXAMS[nextIndex];
    switchExam(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6">
      {!signedIn ? (
        <nav aria-label="Origin" className="-mt-2 flex items-center justify-between gap-2">
          <Link href="/" className={`-ml-3 inline-flex h-12 items-center gap-2 rounded-full px-3 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}>
            <ArrowLeft aria-hidden className="size-4" /> Origin home
          </Link>
          <Link
            href={LOGIN_HREF}
            onClick={() => keepForLogin(false)}
            className={`inline-flex h-12 items-center gap-2 rounded-full border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}
          >
            <LogIn aria-hidden className="size-4" /> Log in
          </Link>
        </nav>
      ) : null}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[34px] font-extrabold leading-none text-foreground">Rank Predictor</h1>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-foreground">Free</span>
        </div>
        <p className="text-[14px] text-muted-foreground">Your marks in, a rank range out — from past years&apos; official results.</p>
      </header>

      {/* Exam tabs */}
      <div role="tablist" aria-label="Exam" className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
        {RANK_PREDICTOR_EXAMS.map((id, index) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            role="tab"
            type="button"
            id={`${ids}-tab-${id}`}
            aria-selected={exam === id}
            aria-controls={`${ids}-panel`}
            tabIndex={exam === id ? 0 : -1}
            onClick={() => switchExam(id)}
            onKeyDown={(e) => onTabKey(e, index)}
            className={`min-h-12 cursor-pointer rounded-full px-2 text-[14px] font-semibold transition-colors ${fieldFocus} ${
              exam === id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-surface-3'
            }`}
          >
            {EXAM_LABEL[id]}
          </button>
        ))}
      </div>

      <form
        id={`${ids}-panel`}
        role="tabpanel"
        aria-labelledby={`${ids}-tab-${exam}`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-5"
      >
        {/* Marks */}
        <fieldset className="flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <legend className="font-display text-[21px] font-bold text-foreground">Your marks</legend>
            {canFill ? (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={`inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}
              >
                <ClipboardList aria-hidden className="size-4" /> Fill from my tests
              </button>
            ) : null}
          </div>
          {exam === 'jee-advanced' ? (
            <p className="text-[13px] text-muted-foreground">Both papers together: each subject is out of 120 (360 total).</p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            {boxes.map((b) => {
              const inputId = `${ids}-${b.id}`;
              const err = fieldError?.field === `marks.${b.id}` ? fieldError.message : null;
              const filled = fill && fill.exam === exam ? fill.marks[b.id] : undefined;
              return (
                <div key={b.id} className="flex flex-col gap-1">
                  <label htmlFor={inputId} className="text-[14px] font-medium text-foreground">
                    {b.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={inputId}
                      type="number"
                      inputMode="numeric"
                      step={1}
                      min={b.min}
                      max={b.max}
                      value={examMarks[b.id] ?? ''}
                      onChange={(e) => setMark(b.id, e.target.value)}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={`${inputId}-hint${err ? ` ${inputId}-err` : ''}`}
                      className={`h-12 w-full min-w-0 rounded-[12px] border bg-background px-3 text-[16px] tabular-nums text-foreground ${fieldFocus} ${
                        err ? 'border-destructive' : 'border-border'
                      }`}
                    />
                    <span id={`${inputId}-hint`} className="shrink-0 text-[13px] text-muted-foreground">
                      / {b.max}
                    </span>
                  </div>
                  {filled ? <span className="text-[12px] text-muted-foreground">{filled.note}</span> : null}
                  {err ? (
                    <span id={`${inputId}-err`} role="alert" className="text-[13px] font-medium text-destructive">
                      {err}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="text-[14px] text-foreground" aria-live="polite">
            Total <span className="font-display text-[21px] font-bold tabular-nums">{total}</span>
            <span className="text-muted-foreground"> / {EXAM_MAX_MARKS[exam]}</span>
          </p>
          {fill && fill.exam === exam ? (
            <div className="flex flex-col gap-1 rounded-[12px] bg-surface-2 px-4 py-3 text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">From: {fill.title}</span>
              {fill.notes.map((n) => (
                <span key={n}>{n}</span>
              ))}
              <span>Origin mocks are not tuned to the real paper, so we widen the range a little.</span>
            </div>
          ) : null}
        </fieldset>

        {/* About you */}
        <fieldset className="flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4 sm:p-6">
          {/* float: keeps the legend inside the card instead of on its border */}
          <legend className="float-left w-full font-display text-[21px] font-bold text-foreground">About you</legend>
          <div role="radiogroup" aria-labelledby={`${ids}-cat-label`} className="flex flex-col gap-2">
            <span id={`${ids}-cat-label`} className="text-[14px] font-medium text-foreground">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              {RANK_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={`inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold ${fieldFocus} ${
                    category === c ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-foreground hover:bg-surface-2'
                  }`}
                >
                  {category === c ? <Check aria-hidden className="size-4" /> : null}
                  {categoryLabel(exam, c)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[14px] font-medium text-foreground">
            <input
              type="checkbox"
              checked={pwd}
              onChange={(e) => setPwd(e.target.checked)}
              className={`size-6 shrink-0 accent-primary ${fieldFocus}`}
            />
            I am a PwD (PwBD) candidate
          </label>

          {exam === 'neet' ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-state`} className="text-[14px] font-medium text-foreground">
                Home state <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <select
                id={`${ids}-state`}
                value={homeState}
                onChange={(e) => setHomeState(e.target.value)}
                aria-describedby={`${ids}-state-hint`}
                className={`h-12 w-full rounded-[12px] border border-border bg-background px-3 text-[16px] text-foreground ${fieldFocus}`}
              >
                <option value="">Not selected</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span id={`${ids}-state-hint`} className="text-[13px] text-muted-foreground">
                State rank uses official state lists, available for {NEET_STATES_WITH_LIST.length} states so far.
              </span>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">State rank for JEE is coming soon (no official state-wise data yet).</p>
          )}

          {exam === 'jee-main' ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-shift`} className="text-[14px] font-medium text-foreground">
                Compare with one shift <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <select
                id={`${ids}-shift`}
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                aria-describedby={`${ids}-shift-hint`}
                className={`h-12 w-full rounded-[12px] border border-border bg-background px-3 text-[16px] text-foreground ${fieldFocus}`}
              >
                <option value="">Not sure / not written yet</option>
                {shiftOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date}, shift {s.shift}
                  </option>
                ))}
              </select>
              <span id={`${ids}-shift-hint`} className="text-[13px] text-muted-foreground">
                Real shift tables exist only for 2024. Pick one if your paper felt like it; otherwise we use all shifts.
              </span>
            </div>
          ) : null}

          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[14px] text-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className={`size-6 shrink-0 accent-primary ${fieldFocus}`}
            />
            <span>
              Remember my details on this device
              <span className="block text-[13px] text-muted-foreground">We never save your category, PwD or state on our servers.</span>
            </span>
          </label>
        </fieldset>

        <div className="flex flex-col gap-2">
          <button
            ref={submitRef}
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className={`inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 text-[16px] font-semibold text-primary-foreground disabled:opacity-70 ${fieldFocus}`}
          >
            {loading ? <Loader2 aria-hidden className="size-5 motion-safe:animate-spin" /> : outOfChecks ? <LogIn aria-hidden className="size-5" /> : null}
            {loading ? 'Predicting…' : outOfChecks ? 'Log in for unlimited checks' : 'Predict my rank'}
          </button>
          {!signedIn ? (
            <p className="flex flex-wrap items-center justify-center gap-x-1 text-center text-[14px] text-muted-foreground" aria-live="polite">
              <span>{freeChecksLine(access)}</span>
              {access?.remainingToday !== 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <Link
                    href={LOGIN_HREF}
                    onClick={() => keepForLogin(false)}
                    className={`inline-flex min-h-12 items-center rounded-full px-2 font-semibold text-foreground underline underline-offset-4 ${fieldFocus}`}
                  >
                    Log in for unlimited
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {fieldError && !fieldError.field.startsWith('marks.') ? (
            <p role="alert" className="text-[13px] font-medium text-destructive">
              {fieldError.message}
            </p>
          ) : null}
        </div>
      </form>

      {requestError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-[18px] border border-border bg-card p-4">
          <p className="text-[14px] text-foreground">{requestError}</p>
          <button
            type="button"
            onClick={() => void predict()}
            className={`inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-border px-5 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}
          >
            <RotateCcw aria-hidden className="size-4" /> Try again
          </button>
        </div>
      ) : null}

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {result ? (
          <ResultCard
            response={result}
            examLabel={EXAM_LABEL[result.prediction.exam]}
            whatIfDelta={whatIfDelta}
            onWhatIf={setWhatIfDelta}
            signedIn={signedIn}
            onLoginForColleges={() => keepForLogin(true)}
            collegesEnabled={collegesEnabled}
            onOpenColleges={() => saveHandoff(handoffFromPrediction(result.prediction, { category, pwd, homeState }))}
          />
        ) : (
          <p className="rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
        )}
      </div>

      {canFill ? <FillFromTests open={sheetOpen} onOpenChange={setSheetOpen} exam={exam} onFill={applyFill} /> : null}
      {!signedIn ? <LimitSheet open={limitOpen} onOpenChange={setLimitOpen} onLeave={() => keepForLogin(true)} returnFocusTo={submitRef} /> : null}
    </main>
  );
}
