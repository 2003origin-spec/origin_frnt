'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Clock, Flag, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { LatexRenderer } from '@/components/ui/LatexRenderer';
import { useContestAttempt } from '@/features/contest/useContestAttempt';

/**
 * Contest attempt player (plan Phase 3 UI) — a sporty, mobile-first shell over
 * the reusable attempt logic (server-authoritative timer, rev-guarded autosave,
 * 3-strike anti-cheat). Distinct from the NTA-style CBT interface: sticky
 * gradient timer, large touch targets, one-question focus with a palette,
 * violation warnings, and a final-submit confirmation. Respects reduced-motion.
 */
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function ContestPlayer({ contestId }: { contestId: string }) {
  const router = useRouter();
  const { phase, error, questions, answers, violations, remaining, maxViolations, setAnswer, begin, submit } =
    useContestAttempt(contestId);
  const [index, setIndex] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  // Subject sections (CBT-style): the ordered distinct subjects + per-subject
  // answered/total, so the palette groups by subject instead of one long row.
  const subjects = useMemo(
    () => Array.from(new Set(questions.map((q) => q.subject ?? 'General'))),
    [questions],
  );
  const sectionStats = useMemo(() => {
    const m: Record<string, { answered: number; total: number }> = {};
    questions.forEach((q) => {
      const s = q.subject ?? 'General';
      m[s] ??= { answered: 0, total: 0 };
      m[s].total += 1;
      if (answers[String(q.position)] != null) m[s].answered += 1;
    });
    return m;
  }, [questions, answers]);
  const activeSubject = questions[index]?.subject ?? 'General';
  const jumpToSubject = (subject: string) => {
    // First unanswered question of that subject, else its first question.
    const firstUnanswered = questions.findIndex((q) => (q.subject ?? 'General') === subject && answers[String(q.position)] == null);
    const firstAny = questions.findIndex((q) => (q.subject ?? 'General') === subject);
    setIndex(firstUnanswered >= 0 ? firstUnanswered : firstAny >= 0 ? firstAny : index);
  };

  // Throttled screen-reader countdown: the visible timer ticks every 500ms
  // (aria-live off), but this polite region announces only at milestones — each
  // minute, the 30s mark, and the final 10s — so it's useful, not spammy.
  const srCountdown = useMemo(() => {
    const r = remaining;
    if (r <= 0) return 'Time is up.';
    if (r <= 10) return `${r} seconds remaining.`;
    if (r === 30) return '30 seconds remaining.';
    if (r % 60 === 0) return `${r / 60} minute${r / 60 === 1 ? '' : 's'} remaining.`;
    return '';
  }, [remaining]);
  const current = questions[index];
  const low = remaining <= 60;

  if (phase === 'loading') {
    return <Centered>Loading contest…</Centered>;
  }

  if (phase === 'error') {
    return (
      <Centered>
        <p className="text-destructive font-bold mb-4">{error ?? 'Something went wrong.'}</p>
        <NeuButton onClick={() => router.push('/dashboard')}>Back to dashboard</NeuButton>
      </Centered>
    );
  }

  if (phase === 'submitted') {
    return (
      <Centered>
        <Trophy className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-2xl font-black text-foreground mb-2">Submitted!</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-sm">
          Your attempt is locked. Results and your ORBIT change publish after the contest ends —
          we&apos;ll notify you, and you can check the result page anytime.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <NeuButton onClick={() => router.push(`/contest/${contestId}/result`)}>
            <span className="text-primary font-black uppercase tracking-wider text-[12px]">View result</span>
          </NeuButton>
          <NeuButton onClick={() => router.push('/dashboard')}>
            <span className="font-black uppercase tracking-wider text-[12px]">Back to dashboard</span>
          </NeuButton>
        </div>
      </Centered>
    );
  }

  if (phase === 'instructions') {
    return (
      <Centered>
        <div className="neu-raised rounded-2xl p-6 max-w-md w-full space-y-4">
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Ready to compete?
          </h1>
          <ul className="text-sm text-muted-foreground space-y-2 font-medium">
            <li>• The timer is fixed to the contest end — it won't pause.</li>
            <li>• Your answers auto-save as you go.</li>
            <li>• Switching tabs is flagged; {maxViolations} strikes auto-submits your attempt.</li>
            <li>• You can submit early once you're done.</li>
          </ul>
          <NeuButton onClick={() => void begin()} className="w-full">
            <span className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-wider">
              Start <ArrowRight className="w-4 h-4" />
            </span>
          </NeuButton>
        </div>
      </Centered>
    );
  }

  // running / submitting
  return (
    <div className="min-h-dvh neu-surface flex flex-col">
      {/* Sticky timer bar */}
      <div
        className={cn(
          'sticky top-0 z-30 px-4 py-3 flex items-center justify-between gap-3 border-b border-border/20 backdrop-blur',
          low ? 'bg-rose-500/10' : 'bg-primary/5',
        )}
      >
        <div className="flex items-center gap-2">
          <Clock className={cn('w-4 h-4', low ? 'text-rose-500 motion-safe:animate-pulse' : 'text-primary')} />
          <span
            className={cn('text-lg font-black tabular-nums', low ? 'text-rose-500' : 'text-foreground')}
            aria-live="off"
            role="timer"
          >
            {formatClock(remaining)}
          </span>
          {/* Sparse screen-reader announcements (visible timer stays aria-live off) */}
          <span className="sr-only" aria-live="polite" role="status">
            {srCountdown}
          </span>
        </div>
        <div className="text-[11px] font-bold text-muted-foreground">
          {answeredCount}/{questions.length} answered
        </div>
        {violations > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-500 uppercase">
            <AlertTriangle className="w-3.5 h-3.5" /> {violations}/{maxViolations}
          </span>
        )}
        <NeuButton onClick={() => setConfirmSubmit(true)} className="!px-4 !py-1.5">
          <span className="inline-flex items-center gap-1.5 text-primary font-black text-[11px] uppercase tracking-wider">
            <Flag className="w-3.5 h-3.5" /> Submit
          </span>
        </NeuButton>
      </div>

      {/* Subject section tabs (CBT-style) — jump + per-subject progress */}
      {subjects.length > 1 && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
          {subjects.map((s) => {
            const st = sectionStats[s] ?? { answered: 0, total: 0 };
            const on = s === activeSubject;
            return (
              <button
                key={s}
                type="button"
                onClick={() => jumpToSubject(s)}
                className={cn(
                  'shrink-0 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors',
                  on ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
                )}
              >
                {s} <span className={cn('ml-1 tabular-nums', on ? 'text-white/80' : 'text-muted-foreground/70')}>{st.answered}/{st.total}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Question palette for the ACTIVE subject only (numbers centered) */}
      <div className="px-4 py-3 flex flex-wrap gap-2">
        {questions.map((q, i) => {
          if ((q.subject ?? 'General') !== activeSubject) return null;
          const answered = answers[String(q.position)] != null;
          return (
            <button
              key={q.questionId}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Question ${i + 1}${answered ? ', answered' : ''}`}
              aria-current={i === index}
              className={cn(
                'shrink-0 w-9 h-9 rounded-xl text-[12px] font-black transition-colors flex items-center justify-center',
                i === index
                  ? 'bg-primary text-white'
                  : answered
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'neu-raised text-foreground',
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Current question */}
      {current && (
        <div className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
          <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
            {current.subject ?? 'Question'} · Q{index + 1}
          </div>
          <div className="text-[15px] font-bold text-foreground leading-relaxed mb-3">
            <LatexRenderer content={String(current.text ?? '')} />
          </div>
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
              const selected = answers[String(current.position)]?.selectedOption === oi;
              return (
                <button
                  key={oi}
                  type="button"
                  onClick={() => setAnswer(current.position, oi)}
                  className={cn(
                    'w-full text-left px-4 py-3.5 rounded-2xl flex items-center gap-3 transition-all min-h-[52px]',
                    selected ? 'bg-primary/10 ring-2 ring-primary' : 'neu-raised',
                  )}
                >
                  <span
                    className={cn(
                      'w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-[13px] font-black',
                      selected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
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
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Prev / Next */}
      <div className="sticky bottom-0 px-4 py-3 flex items-center justify-between gap-3 border-t border-border/20 neu-surface">
        <NeuButton onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="!px-5">
          <span className="inline-flex items-center gap-1.5 font-black text-[12px] uppercase">
            <ArrowLeft className="w-4 h-4" /> Prev
          </span>
        </NeuButton>
        <NeuButton
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={index >= questions.length - 1}
          className="!px-5"
        >
          <span className="inline-flex items-center gap-1.5 font-black text-[12px] uppercase text-primary">
            Next <ArrowRight className="w-4 h-4" />
          </span>
        </NeuButton>
      </div>

      {/* Submit confirmation */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmSubmit(false)} />
          <div className="relative neu-raised rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-black text-foreground">Submit your attempt?</h3>
            <p className="text-sm text-muted-foreground">
              You've answered {answeredCount} of {questions.length}. Submitting locks your attempt — you can't
              return.
            </p>
            <div className="flex gap-3">
              <NeuButton onClick={() => setConfirmSubmit(false)} className="flex-1">
                <span className="font-black text-[12px] uppercase">Keep going</span>
              </NeuButton>
              <NeuButton
                onClick={() => {
                  setConfirmSubmit(false);
                  void submit({ violationCount: violations });
                }}
                disabled={phase === 'submitting'}
                className="flex-1"
              >
                <span className="font-black text-[12px] uppercase text-primary">
                  {phase === 'submitting' ? 'Submitting…' : 'Submit'}
                </span>
              </NeuButton>
            </div>
          </div>
        </div>
      )}
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
