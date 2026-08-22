'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Lock, Target } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { LatexRenderer } from '@/components/ui/LatexRenderer';
import { mutateJson } from '@/lib/csrf';
import { track } from '@/lib/analytics';

/**
 * Custom DPP-from-mistakes (plan Phase 8c UI). After results publish, a
 * registered + premium participant practices FRESH questions on the chapters
 * they got wrong in the contest — answerable with a server-graded reveal
 * (correct option + explanation). The DPP is pure extra practice: no tally, no
 * rating impact.
 */

interface DppQuestion {
  id: string;
  text: string;
  options: string[] | null;
  subject: string;
  chapter: string;
  questionType: string;
  image: string | null;
  optionImages: (string | null)[] | null;
}

type Dpp =
  | { locked: true; reason: 'not_registered' | 'not_premium' | 'not_published' }
  | { locked: false; weakChapters: string[]; questions: DppQuestion[] };

interface Feedback {
  selected: number;
  correct: boolean;
  correctOption: number | null;
  correctOptions: number[] | null;
  explanation: string | null;
}

export function ContestDpp({ contestId }: { contestId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'locked' | 'ok' | 'empty' | 'error'>('loading');
  const [dpp, setDpp] = useState<Dpp | null>(null);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Record<string, Feedback>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contest/dpp?contestId=${encodeURIComponent(contestId)}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('failed');
        const body = (await res.json()) as { dpp: Dpp };
        if (cancelled) return;
        setDpp(body.dpp);
        if (body.dpp.locked) {
          setStatus('locked');
        } else if (body.dpp.questions.length === 0) {
          setStatus('empty');
        } else {
          setStatus('ok');
          track('contest_dpp_start', { contest_id: contestId });
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contestId]);

  const questions = dpp && !dpp.locked ? dpp.questions : [];
  const current = questions[index];
  const currentAnswered = current ? answered[current.id] : undefined;

  const answer = async (selected: number) => {
    if (!current || currentAnswered || submitting) return;
    setSubmitting(true);
    try {
      const res = await mutateJson('/api/contest/dpp/answer', {
        method: 'POST',
        body: JSON.stringify({ contestId, questionId: current.id, selectedOption: selected }),
      });
      if (res.ok) {
        const b = (await res.json()) as Omit<Feedback, 'selected'>;
        setAnswered((prev) => ({ ...prev, [current.id]: { selected, ...b } }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') return <Centered>Loading your mistake practice…</Centered>;
  if (status === 'error') return <Centered>Couldn&apos;t load your DPP. Please try again.</Centered>;

  if (status === 'locked' && dpp?.locked) {
    const copy: Record<string, { title: string; body: string; cta: string; onClick: () => void }> = {
      not_published: {
        title: 'Results not published yet',
        body: 'Your custom practice unlocks once the contest results are out.',
        cta: 'Back to dashboard',
        onClick: () => router.push('/dashboard'),
      },
      not_registered: {
        title: 'Only for participants',
        body: 'Practice-from-mistakes is built from the questions you attempted in this contest.',
        cta: 'Back to dashboard',
        onClick: () => router.push('/dashboard'),
      },
      not_premium: {
        title: 'Unlock practice from your mistakes',
        body: 'Go premium to get a fresh, personalised set on exactly the chapters you got wrong.',
        cta: 'See premium',
        onClick: () => router.push('/premium'),
      },
    };
    const c = copy[dpp.reason];
    return (
      <Centered>
        <Lock className="w-10 h-10 text-primary mb-3" />
        <h2 className="text-lg font-black text-foreground mb-2">{c.title}</h2>
        <p className="text-muted-foreground text-center max-w-sm mb-6">{c.body}</p>
        <NeuButton onClick={c.onClick}>{c.cta}</NeuButton>
      </Centered>
    );
  }

  if (status === 'empty') {
    return (
      <Centered>
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
        <h2 className="text-lg font-black text-foreground mb-2">Nothing to practice — nice!</h2>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          You didn&apos;t get any questions wrong in this contest, so there&apos;s no mistake set to drill.
        </p>
        <NeuButton onClick={() => router.push(`/contest/${contestId}/result`)}>Back to result</NeuButton>
      </Centered>
    );
  }

  const weakChapters = dpp && !dpp.locked ? dpp.weakChapters : [];

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="p-2 rounded-xl neu-raised text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Practice Your Mistakes
          </h1>
        </div>

        {weakChapters.length > 0 && (
          <div className="neu-raised rounded-2xl p-4">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Weak chapters</div>
            <div className="flex flex-wrap gap-1.5">
              {weakChapters.map((c) => (
                <span key={c} className="px-2.5 py-1 rounded-lg text-[11px] font-bold neu-inset text-foreground">{c}</span>
              ))}
            </div>
          </div>
        )}

        {current && (
          <div className="neu-raised rounded-2xl p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
              {current.subject} · {index + 1}/{questions.length}
            </div>
            <div className="text-[15px] font-bold text-foreground leading-relaxed mb-3">
              <LatexRenderer content={String(current.text ?? '')} />
            </div>
            {current.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.image} alt="Question diagram" className="mb-5 max-h-72 w-auto max-w-full rounded-xl object-contain neu-inset p-2" />
            )}
            <div className="space-y-3">
              {(current.options ?? []).map((opt, oi) => {
                const chosen = currentAnswered?.selected === oi;
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
                        <img src={current.optionImages[oi] as string} alt={`Option ${String.fromCharCode(65 + oi)}`} className="mt-2 max-h-32 w-auto max-w-full rounded-lg object-contain" />
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
                <div className={cn('flex items-center gap-2 text-[13px] font-black', currentAnswered.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {currentAnswered.correct ? <><CheckCircle2 className="w-4 h-4" /> Correct!</> : <><XCircle className="w-4 h-4" /> Not quite — the right answer is highlighted.</>}
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
                <span className="inline-flex items-center gap-1.5 font-black text-[12px] uppercase"><ArrowLeft className="w-4 h-4" /> Prev</span>
              </NeuButton>
              <NeuButton onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={index >= questions.length - 1} className="!px-5">
                <span className="inline-flex items-center gap-1.5 font-black text-[12px] uppercase text-primary">Next <ArrowRight className="w-4 h-4" /></span>
              </NeuButton>
            </div>
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
