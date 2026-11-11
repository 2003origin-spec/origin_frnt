'use client';

/**
 * Landing-page Rank Predictor (plan §9.2): a compact form (exam, marks,
 * category, home state) and the AIR range on the dial. Same public endpoint,
 * same helpers and therefore the same 2-a-day free-check counter as the
 * /rank-predictor page. "See full details" and every login link lead to that
 * page, carrying the form over in this tab (pending.ts) so nothing is retyped.
 *
 * Privacy (plan §12.1): category and home state live in this component's
 * memory only; sessionStorage holds them for the trip to /rank-predictor.
 */

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Loader2, LogIn, RotateCcw } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { trackEvent } from '@/lib/analytics';
import { yesNo } from '@/lib/analytics-events';
import { INDIAN_STATES } from '@/lib/constants';
import { DISCLAIMER, EXAM_LABEL, NOT_ENOUGH_DATA, NOT_ON_RANK_LIST, QUALITY_LABEL, categoryLabel, formatRankRange, rankListTitle, spokenRange } from '@/lib/rank-predictor/format';
import { EXAM_MAX_MARKS, EXAM_SUBJECTS } from '@/lib/rank-predictor/subjects';
import { FREE_CHECKS_PER_DAY, RANK_CATEGORIES, RANK_PREDICTOR_EXAMS, type Quality, type RankCategory, type RankPredictorExam } from '@/lib/rank-predictor/types';
import { fetchAccess, friendlyError, PredictorError, requestPrediction, type Access, type PredictionResponse } from '@/sections/RankPredictor/api';
import { buildPredictInput, marksTotal, type PredictForm } from '@/sections/RankPredictor/form';
import { freeChecksLine, LOGIN_HREF } from '@/sections/RankPredictor/login-links';
import { savePending } from '@/sections/RankPredictor/pending';

import { compactChips, dialFraction, sourcesLine } from './rank-predictor-widget-model';

// Only visitors who hit the daily limit ever see the login sheet: load it then.
const LimitSheet = dynamic(() => import('@/sections/RankPredictor/LimitSheet'), { ssr: false });

type MarksState = Record<RankPredictorExam, Record<string, string>>;
const EMPTY_MARKS: MarksState = { neet: {}, 'jee-main': {}, 'jee-advanced': {} };

// The card is dark in both themes (the old slider's look), so colours here are
// fixed for a dark surface rather than theme tokens.
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300';
const ACCENT = '#38bdf8'; // sky-400: 8.6:1 on the card
const QUALITY_STYLE: Record<Quality, string> = {
  good_estimate: 'bg-emerald-950 text-emerald-200',
  estimate: 'bg-amber-950 text-amber-200',
  rough: 'bg-orange-950 text-orange-200',
};

/** Arc + needle only; every number is real text next to it. */
function Dial({ fraction }: { fraction: number }) {
  const reduce = useReducedMotion();
  const active = fraction > 0;
  const cx = 100;
  const cy = 100;
  const r = 72;
  const start = 215;
  const sweep = 290;
  const at = (deg: number, radius = r) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };
  const arc = (from: number, to: number) => {
    const s = at(from);
    const e = at(to);
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
  };
  const angle = start + fraction * sweep;
  const tip = at(angle, r - 14);
  return (
    <svg viewBox="0 0 200 185" className="w-full max-w-[240px]" aria-hidden="true">
      <path d={arc(start, start + sweep)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" strokeLinecap="round" />
      {active ? (
        <path d={arc(start, angle)} fill="none" stroke={ACCENT} strokeWidth="12" strokeLinecap="round" />
      ) : null}
      {active ? (
        <motion.line
          x1={cx}
          y1={cy}
          initial={false}
          animate={{ x2: tip.x, y2: tip.y }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 20 }}
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : null}
      <circle cx={cx} cy={cy} r="6" fill={active ? ACCENT : 'rgba(255,255,255,0.3)'} />
      <text x={at(start).x} y={at(start).y + 20} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.7)" fontFamily="inherit">
        Lower
      </text>
      <text x={at(start + sweep).x} y={at(start + sweep).y + 20} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.7)" fontFamily="inherit">
        Top
      </text>
    </svg>
  );
}

export default function RankPredictorWidget() {
  const ids = useId();
  const { user, refreshUser } = useAuth();
  const signedIn = Boolean(user);
  const [exam, setExam] = useState<RankPredictorExam>(user?.studyMode === 'jee' ? 'jee-main' : 'neet');
  const [marks, setMarks] = useState<MarksState>(EMPTY_MARKS);
  const [category, setCategory] = useState<RankCategory>('general');
  const [homeState, setHomeState] = useState('');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [sheetLoaded, setSheetLoaded] = useState(false);
  /** The exact form behind the result on screen: "See full details" sends this one. */
  const [predictedForm, setPredictedForm] = useState<PredictForm | null>(null);
  /** First focus inside the widget: only then ask how many free checks are left. */
  const [engaged, setEngaged] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const examMarks = marks[exam];
  const form: PredictForm = { exam, marks: examMarks, category, pwd: false, homeState, shift: '' };

  // Visitors: free checks left today, asked on first focus in the widget, not on
  // every landing visit (this sits right under the hero on the busiest page).
  // Until then the line says "2 free checks"; a 429 still opens the login sheet.
  useEffect(() => {
    if (signedIn || !engaged) return;
    let live = true;
    fetchAccess()
      .then((a) => {
        if (!live) return;
        // A prediction answered meanwhile carries a fresher count: keep that one.
        setAccess((prev) => prev ?? a);
        // The call refreshed a stale session: let the auth context catch up.
        if (a.signedIn) void refreshUser();
      })
      .catch(() => undefined); // The line under the button stays generic.
    return () => {
      live = false;
    };
  }, [signedIn, engaged, refreshUser]);

  const outOfChecks = !signedIn && access?.remainingToday === 0;

  const openLimit = () => {
    setSheetLoaded(true);
    setLimitOpen(true);
  };

  const predict = async () => {
    const built = buildPredictInput(form);
    if ('error' in built) {
      setFieldError(built.error);
      document.getElementById(`${ids}-${built.error.field.replace('marks.', '')}`)?.focus();
      return;
    }
    setFieldError(null);
    setRequestError(null);
    setLoading(true);
    // GA: exam and signed-in only (never marks, ranks or details — src/lib/analytics-events.ts).
    const tracked = { exam: built.input.exam, signed_in: yesNo(signedIn), placement: 'landing' as const };
    trackEvent('rank_predictor_submit', tracked);
    try {
      const response = await requestPrediction(built.input);
      setResult(response);
      setPredictedForm(form);
      setAccess(response.access);
      trackEvent('rank_predictor_result', tracked);
      // On phones the result sits below the form: focusing it also scrolls it into view.
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) {
      if (error instanceof PredictorError && error.code === 'login_required') {
        setAccess(error.access ?? { signedIn: false, remainingToday: 0, limit: FREE_CHECKS_PER_DAY });
        trackEvent('rank_predictor_limit_reached', { exam: built.input.exam, placement: 'landing' });
        openLimit();
      } else {
        setRequestError(friendlyError(error, 'Something went wrong. Try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = () => {
    if (outOfChecks) {
      trackEvent('rank_predictor_limit_reached', { exam, placement: 'landing' });
      openLimit();
      return;
    }
    void predict();
  };

  const setMark = (id: string, value: string) => {
    setMarks((prev) => ({ ...prev, [exam]: { ...prev[exam], [id]: value } }));
    if (fieldError?.field === `marks.${id}`) setFieldError(null);
  };

  const switchExam = (next: RankPredictorExam) => {
    setExam(next);
    setResult(null);
    setPredictedForm(null);
    setFieldError(null);
    setRequestError(null);
  };

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const n = RANK_PREDICTOR_EXAMS.length;
    const next = RANK_PREDICTOR_EXAMS[(index + (event.key === 'ArrowRight' ? 1 : -1) + n) % n];
    switchExam(next);
    tabRefs.current[next]?.focus();
  };

  const p = result?.prediction ?? null;
  const rankTitle = rankListTitle(exam);

  return (
    <MotionConfig reducedMotion="user">
      <section id="rank-predictor" aria-labelledby={`${ids}-title`} onFocus={() => setEngaged(true)} className="relative z-10 scroll-mt-24 py-10 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-5xl px-5 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, margin: '-80px' }}
            className="mb-8 text-center sm:mb-10"
          >
            <div className="neu-inset mb-5 inline-flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5">
              <span className="text-sm font-semibold text-primary">Rank Predictor</span>
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-primary-foreground">Free</span>
            </div>
            <h2 id={`${ids}-title`} tabIndex={-1} className="mb-4 text-3xl font-black leading-[0.95] tracking-tighter outline-none sm:text-6xl lg:text-7xl">
              <span className="text-outline">Where will you</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent">rank?</span>
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
              Type your marks. See your NEET or JEE rank range from past years&apos; official results.
            </p>
          </motion.div>

          <div
            className="relative overflow-hidden rounded-3xl text-white"
            style={{
              background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #060d1f 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 32px 64px rgba(0,0,0,0.35)',
            }}
          >
            <div className="relative grid md:grid-cols-[1.15fr_auto_1fr]">
              {/* Form */}
              <div className="flex flex-col gap-5 p-5 sm:p-8">
                <div role="tablist" aria-label="Exam" className="grid grid-cols-3 gap-1 rounded-full bg-white/[0.08] p-1">
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
                      className={`h-12 cursor-pointer rounded-full px-1 text-[14px] font-semibold transition-colors ${focus} ${
                        exam === id ? 'bg-white text-slate-950' : 'text-white hover:bg-white/10'
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
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-[14px] font-semibold text-white">
                      Your marks{exam === 'jee-advanced' ? <span className="font-normal text-white/70"> (both papers)</span> : null}
                    </legend>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {EXAM_SUBJECTS[exam].map((b) => {
                        const inputId = `${ids}-${b.id}`;
                        const err = fieldError?.field === `marks.${b.id}`;
                        return (
                          <div key={b.id} className="flex min-w-0 flex-col gap-1">
                            <label htmlFor={inputId} className="text-[13px] text-white/80">
                              {b.label}
                            </label>
                            <input
                              id={inputId}
                              type="number"
                              inputMode="numeric"
                              step={1}
                              min={b.min}
                              max={b.max}
                              value={examMarks[b.id] ?? ''}
                              onChange={(e) => setMark(b.id, e.target.value)}
                              aria-invalid={err || undefined}
                              aria-describedby={`${inputId}-max${err ? ` ${ids}-mark-err` : ''}`}
                              className={`h-12 w-full min-w-0 rounded-[12px] border bg-white/[0.06] px-3 text-[16px] tabular-nums text-white ${focus} ${
                                err ? 'border-red-400' : 'border-white/35'
                              }`}
                            />
                            <span id={`${inputId}-max`} className="text-[12px] text-white/70">
                              out of {b.max}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {fieldError?.field.startsWith('marks.') ? (
                      <p id={`${ids}-mark-err`} role="alert" className="text-[13px] font-medium text-red-300">
                        {fieldError.message}
                      </p>
                    ) : null}
                    <p className="text-[14px] text-white/80" aria-live="polite">
                      Total <span className="font-display text-[20px] font-bold tabular-nums text-white">{marksTotal(exam, examMarks)}</span> / {EXAM_MAX_MARKS[exam]}
                    </p>
                  </fieldset>

                  <div role="radiogroup" aria-labelledby={`${ids}-cat`} className="flex flex-col gap-2">
                    <span id={`${ids}-cat`} className="text-[14px] font-semibold text-white">
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
                          className={`inline-flex h-12 cursor-pointer items-center gap-1 rounded-full border px-3.5 text-[14px] font-semibold ${focus} ${
                            category === c ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/35 text-white hover:bg-white/10'
                          }`}
                        >
                          {category === c ? <Check aria-hidden className="size-4" /> : null}
                          {categoryLabel(exam, c)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {exam === 'neet' ? (
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`${ids}-state`} className="text-[14px] font-semibold text-white">
                        Home state <span className="font-normal text-white/70">(optional)</span>
                      </label>
                      <select
                        id={`${ids}-state`}
                        value={homeState}
                        onChange={(e) => setHomeState(e.target.value)}
                        className={`h-12 w-full rounded-[12px] border border-white/35 bg-[#11131a] px-3 text-[16px] text-white ${focus}`}
                      >
                        <option value="">Not selected</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-[13px] text-white/70">State rank for JEE is coming soon (no official state-wise data yet).</p>
                  )}

                  <div className="flex flex-col gap-1">
                    <button
                      ref={submitRef}
                      type="submit"
                      disabled={loading}
                      aria-busy={loading}
                      className={`inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 text-[16px] font-semibold text-slate-950 hover:bg-sky-100 disabled:opacity-70 ${focus}`}
                    >
                      {loading ? <Loader2 aria-hidden className="size-5 motion-safe:animate-spin" /> : outOfChecks ? <LogIn aria-hidden className="size-5" /> : null}
                      {loading ? 'Predicting…' : outOfChecks ? 'Log in for unlimited checks' : 'Predict my rank'}
                    </button>
                    {!signedIn ? (
                      <p className="flex flex-wrap items-center justify-center gap-x-1 text-center text-[13px] text-white/75" aria-live="polite">
                        <span>{freeChecksLine(access)}</span>
                        {access?.remainingToday !== 0 ? (
                          <>
                            <span aria-hidden>·</span>
                            <Link
                              href={LOGIN_HREF}
                              // Signed in, a re-run costs nothing: a result on screen comes back after login too.
                              onClick={() => {
                                trackEvent('auth_cta_click', { action: 'log_in', source: 'predictor_page', placement: 'landing' });
                                savePending({ ...form, predict: result !== null });
                              }}
                              className={`inline-flex min-h-12 items-center rounded-full px-2 font-semibold text-white underline underline-offset-4 ${focus}`}
                            >
                              Log in for unlimited
                            </Link>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                    {fieldError && !fieldError.field.startsWith('marks.') ? (
                      <p role="alert" className="text-[13px] font-medium text-red-300">
                        {fieldError.message}
                      </p>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="mx-8 hidden w-px self-stretch bg-white/[0.08] md:my-8 md:block" />

              {/* Result */}
              <div
                ref={resultRef}
                tabIndex={-1}
                aria-live="polite"
                className="flex flex-col items-center gap-4 border-t border-white/[0.08] p-5 outline-none sm:p-8 md:border-t-0"
              >
                <Dial fraction={dialFraction(exam, p?.air ?? null)} />
                {requestError ? (
                  <div role="alert" className="flex w-full flex-col items-center gap-3 text-center">
                    <p className="text-[14px] text-white">{requestError}</p>
                    <button
                      type="button"
                      onClick={() => void predict()}
                      disabled={loading}
                      className={`inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-white/35 px-5 text-[14px] font-semibold text-white hover:bg-white/10 disabled:opacity-70 ${focus}`}
                    >
                      <RotateCcw aria-hidden className="size-4" /> Try again
                    </button>
                  </div>
                ) : result && p ? (
                  <div className="flex w-full flex-col gap-4">
                    <div className="-mt-2 flex flex-col items-center gap-2 text-center">
                      <span className="text-[13px] text-white/75">
                        {EXAM_LABEL[p.exam]} · {rankTitle}
                      </span>
                      {p.air ? (
                        <>
                          <p className="font-display text-[30px] font-extrabold leading-none tabular-nums text-white sm:text-[36px]" aria-label={spokenRange(rankTitle, p.air, p.air.quality)}>
                            {formatRankRange(p.air)}
                          </p>
                          <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${QUALITY_STYLE[p.air.quality]}`}>{QUALITY_LABEL[p.air.quality]}</span>
                          {p.air.notEnoughData ? <span className="text-[13px] text-white/75">{NOT_ENOUGH_DATA}</span> : null}
                        </>
                      ) : (
                        <p className="text-[15px] text-white">{NOT_ON_RANK_LIST}</p>
                      )}
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Other ranks">
                      {compactChips(p).map((chip) => (
                        <li key={chip.key} className="flex flex-col gap-1 rounded-[12px] bg-white/[0.06] px-3 py-2.5">
                          <span className="text-[12px] text-white/75">{chip.label}</span>
                          {chip.band ? (
                            <>
                              <span className="font-display text-[19px] font-bold leading-tight tabular-nums text-white" aria-label={spokenRange(chip.label, chip.band, chip.band.quality)}>
                                {formatRankRange(chip.band)}
                              </span>
                              <span className="text-[12px] text-white/75">{QUALITY_LABEL[chip.band.quality]}</span>
                            </>
                          ) : (
                            <span className="text-[14px] text-white">{chip.text}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/rank-predictor"
                      onClick={() => {
                        trackEvent('rank_predictor_details_click', { exam, placement: 'landing' });
                        if (predictedForm) savePending({ ...predictedForm, predict: true, alreadyCounted: true });
                      }}
                      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/35 px-5 text-[15px] font-semibold text-white hover:bg-white/10 ${focus}`}
                    >
                      See full details <ArrowRight aria-hidden className="size-4" />
                    </Link>
                    <p className="text-center text-[12px] leading-relaxed text-white/70">{sourcesLine(result.sources, result.checkedOn)}</p>
                  </div>
                ) : (
                  <p className="-mt-2 text-center text-[14px] text-white/80">Your rank range shows here.</p>
                )}
                <p className="text-center text-[12px] leading-relaxed text-white/70">{result?.disclaimer ?? DISCLAIMER}</p>
              </div>
            </div>
          </div>
        </div>
        {!signedIn && sheetLoaded ? (
          <LimitSheet open={limitOpen} onOpenChange={setLimitOpen} onLeave={() => savePending({ ...form, predict: true })} returnFocusTo={submitRef} placement="landing" />
        ) : null}
      </section>
    </MotionConfig>
  );
}
