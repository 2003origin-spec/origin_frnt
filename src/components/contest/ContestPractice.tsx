'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Dumbbell } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { LatexRenderer } from '@/components/ui/LatexRenderer';
import { mutateJson } from '@/lib/csrf';

/**
 * Pre-contest practice module (plan Phase 2c UI). Registered-only warm-up
 * scoped to the contest's topics, with the live Contest Prep Score bar +
 * Contest Accuracy. Practice is separate from the rated attempt.
 */

interface PracticeQuestion {
  id: string;
  text: string;
  options: string[] | null;
  subject: string;
  questionType: string;
  image: string | null;
  optionImages: (string | null)[] | null;
}

interface SubjectReadiness {
  subject: string;
  accuracy: number; // 0..1
  coverage: number; // 0..1
}

interface Metrics {
  prepScore: number;
  accuracy: number;
  attempted: number;
  correct: number;
  perSubject: SubjectReadiness[];
}

// A subject's readiness → a colour on the RGB spectrum (red→amber→green).
function readinessColor(readiness: number): string {
  if (readiness >= 0.75) return '#10b981';
  if (readiness >= 0.4) return '#f59e0b';
  return '#ef4444';
}

export function ContestPractice({ contestId }: { contestId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'locked' | 'error'>('loading');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [answered, setAnswered] = useState<
    Record<
      string,
      { selected: number; correct: boolean; correctOption: number | null; correctOptions: number[] | null; explanation: string | null }
    >
  >({});
  const [submitting, setSubmitting] = useState(false);

  const loadMetrics = useCallback(async () => {
    const res = await fetch(`/api/contest/practice?contestId=${encodeURIComponent(contestId)}&mode=metrics`, {
      credentials: 'include',
    });
    if (res.ok) setMetrics((await res.json()).metrics as Metrics);
  }, [contestId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contest/practice?contestId=${encodeURIComponent(contestId)}&mode=questions&limit=20`, {
          credentials: 'include',
        });
        if (res.status === 403) {
          if (!cancelled) setStatus('locked');
          return;
        }
        if (!res.ok) throw new Error('failed');
        const body = (await res.json()) as { items: PracticeQuestion[] };
        if (cancelled) return;
        setQuestions(body.items);
        await loadMetrics();
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contestId, loadMetrics]);

  const current = questions[index];
  const currentAnswered = current ? answered[current.id] : undefined;

  const answer = async (selected: number) => {
    if (!current || currentAnswered || submitting) return;
    setSubmitting(true);
    try {
      const res = await mutateJson('/api/contest/practice', {
        method: 'POST',
        body: JSON.stringify({ contestId, questionId: current.id, selectedOption: selected }),
      });
      if (res.ok) {
        const body = (await res.json()) as {
          isCorrect: boolean;
          correctOption: number | null;
          correctOptions: number[] | null;
          explanation: string | null;
          metrics: Metrics;
        };
        setMetrics(body.metrics);
        setAnswered((prev) => ({
          ...prev,
          [current.id]: {
            selected,
            correct: body.isCorrect,
            correctOption: body.correctOption,
            correctOptions: body.correctOptions,
            explanation: body.explanation,
          },
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') return <Centered>Loading practice…</Centered>;
  if (status === 'error') return <Centered>Couldn't load practice. Try again.</Centered>;
  if (status === 'locked') {
    return (
      <Centered>
        <Dumbbell className="w-10 h-10 text-primary mb-3" />
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          Register for the contest to unlock topic-focused practice.
        </p>
        <NeuButton onClick={() => router.push('/dashboard')}>Back to dashboard</NeuButton>
      </Centered>
    );
  }

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="p-2 rounded-xl neu-raised text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" /> Contest Prep
          </h1>
        </div>

        {/* Prep score + accuracy */}
        {metrics && (
          <div className="neu-raised rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Prep Score</div>
                <div className="text-3xl font-black text-foreground tabular-nums">{metrics.prepScore}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Accuracy</div>
                <div className="text-2xl font-black text-primary tabular-nums">{metrics.accuracy}%</div>
              </div>
            </div>
            {/* Per-subject RGB readiness bar */}
            <div className="flex gap-1.5 h-3 rounded-full overflow-hidden">
              {metrics.perSubject.map((s) => (
                <div
                  key={s.subject}
                  className="flex-1 rounded-full"
                  title={`${s.subject}: ${Math.round(s.coverage * 100)}% covered, ${Math.round(s.accuracy * 100)}% accurate`}
                  style={{ backgroundColor: readinessColor(s.coverage * s.accuracy), opacity: 0.35 + 0.65 * s.coverage }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              {metrics.perSubject.map((s) => (
                <span key={s.subject}>{s.subject}</span>
              ))}
            </div>
          </div>
        )}

        {/* Current practice question */}
        {current ? (
          <div className="neu-raised rounded-2xl p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
              {current.subject} · Practice {index + 1}/{questions.length}
            </div>
            <div className="text-[15px] font-bold text-foreground leading-relaxed mb-3">
              <LatexRenderer content={String(current.text ?? '')} />
            </div>
            {/* Question diagram (if any) */}
            {current.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.image}
                alt="Question diagram"
                className="mb-5 max-h-72 w-auto max-w-full rounded-xl object-contain neu-inset p-2"
              />
            )}
            <div className="space-y-3">
              {(current.options ?? []).map((opt, oi) => {
                const chosen = currentAnswered?.selected === oi;
                // Once answered, reveal the correct option (from correctOptions set
                // or the single correctOption).
                const isCorrectOption = currentAnswered
                  ? (currentAnswered.correctOptions?.length
                      ? currentAnswered.correctOptions.includes(oi)
                      : currentAnswered.correctOption === oi)
                  : false;
                const wrongChoice = Boolean(currentAnswered) && chosen && !currentAnswered?.correct;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={Boolean(currentAnswered) || submitting}
                    onClick={() => void answer(oi)}
                    className={cn(
                      'w-full text-left px-4 py-3.5 rounded-2xl flex items-center gap-3 transition-all min-h-[52px]',
                      !currentAnswered && 'neu-raised',
                      isCorrectOption && 'bg-emerald-500/10 ring-2 ring-emerald-500',
                      wrongChoice && 'bg-rose-500/10 ring-2 ring-rose-500',
                      currentAnswered && !isCorrectOption && !wrongChoice && 'neu-raised opacity-60',
                    )}
                  >
                    <span
                      className={cn(
                        'w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-[13px] font-black',
                        isCorrectOption ? 'bg-emerald-500 text-white' : wrongChoice ? 'bg-rose-500 text-white' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="text-[14px] font-medium text-foreground flex-1 min-w-0">
                      <LatexRenderer content={String(opt)} />
                      {current.optionImages?.[oi] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={current.optionImages[oi] as string}
                          alt={`Option ${String.fromCharCode(65 + oi)}`}
                          className="mt-2 max-h-32 w-auto max-w-full rounded-lg object-contain"
                        />
                      )}
                    </span>
                    {isCorrectOption && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
                    {wrongChoice && <XCircle className="w-4 h-4 shrink-0 text-rose-500" />}
                  </button>
                );
              })}
            </div>
            {currentAnswered && (
              <div className="mt-4 space-y-2">
                <div
                  className={cn(
                    'flex items-center gap-2 text-[13px] font-black',
                    currentAnswered.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {currentAnswered.correct ? (
                    <><CheckCircle2 className="w-4 h-4" /> Correct!</>
                  ) : (
                    <><XCircle className="w-4 h-4" /> Not quite — the right answer is highlighted.</>
                  )}
                </div>
                {currentAnswered.explanation && (
                  <div className="neu-inset rounded-xl p-3 text-[13px] font-medium text-muted-foreground leading-relaxed">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary block mb-1">Explanation</span>
                    <LatexRenderer content={currentAnswered.explanation} />
                  </div>
                )}
              </div>
            )}
            <div className="mt-5 flex justify-between">
              <NeuButton onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="!px-5">
                <span className="inline-flex items-center gap-1.5 font-black text-[12px] uppercase">
                  <ArrowLeft className="w-4 h-4" /> Prev
                </span>
              </NeuButton>
              <NeuButton onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={index >= questions.length - 1} className="!px-5">
                <span className="inline-flex items-center gap-1.5 font-black text-[12px] uppercase text-primary">
                  Next <ArrowRight className="w-4 h-4" />
                </span>
              </NeuButton>
            </div>
          </div>
        ) : (
          <div className="neu-raised rounded-2xl p-6 text-center text-muted-foreground">
            <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No practice questions available for this contest's topics yet.
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh neu-surface flex flex-col items-center justify-center p-6 text-foreground">
      {children}
    </div>
  );
}
