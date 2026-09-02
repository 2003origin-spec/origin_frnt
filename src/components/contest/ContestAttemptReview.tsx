'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, Loader2, BookOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { LatexRenderer } from '@/components/ui/LatexRenderer';
import { ContestDiscussion } from '@/components/contest/ContestDiscussion';

/**
 * Post-contest solutions review of the student's OWN attempt — every question
 * with their answer highlighted, the correct answer, and the explanation. The
 * highest-value learning surface (all from the immutable submission snapshots).
 */

interface Q {
  position: number;
  subject: string | null;
  chapter: string | null;
  text: string;
  options: string[] | null;
  image: string | null;
  optionImages: (string | null)[] | null;
  submittedOption: number | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  explanation: string | null;
}

export function ContestAttemptReview({ contestId }: { contestId: string }) {
  const router = useRouter();
  const [data, setData] = useState<{ contestName: string; questions: Q[] } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'pending' | 'error'>('loading');
  const [filter, setFilter] = useState<'all' | 'wrong'>('all');
  const [bookmarked, setBookmarked] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contest/bookmarks?contestId=${encodeURIComponent(contestId)}`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { positions: number[] };
        if (!cancelled) setBookmarked(new Set(body.positions ?? []));
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
  }, [contestId]);

  const objectToKey = async (position: number) => {
    const reason = typeof window !== 'undefined' ? window.prompt('Why do you think this key is wrong? (your objection goes to the admins)') : null;
    if (!reason || !reason.trim()) return;
    try {
      const { mutateJson } = await import('@/lib/csrf');
      const res = await mutateJson('/api/contest/objection', { method: 'POST', body: JSON.stringify({ contestId, position, reason: reason.trim() }) });
      if (res.ok) { const { toast } = await import('sonner'); toast.success('Objection submitted — thanks, an admin will review it.'); }
    } catch { /* non-blocking */ }
  };

  const toggleBookmark = async (position: number) => {
    const wasOn = bookmarked.has(position);
    setBookmarked((prev) => { const n = new Set(prev); if (wasOn) n.delete(position); else n.add(position); return n; });
    try {
      const { mutateJson } = await import('@/lib/csrf');
      await mutateJson('/api/contest/bookmarks', { method: 'POST', body: JSON.stringify({ contestId, position }) });
    } catch {
      setBookmarked((prev) => { const n = new Set(prev); if (wasOn) n.add(position); else n.delete(position); return n; }); // revert
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contest/attempt-review?contestId=${encodeURIComponent(contestId)}`, { credentials: 'include' });
        if (res.status === 403) { if (!cancelled) setStatus('pending'); return; }
        if (!res.ok) throw new Error('failed');
        const body = (await res.json()) as { contestName: string; questions: Q[] };
        if (!cancelled) { setData(body); setStatus('ok'); }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [contestId]);

  if (status === 'loading') return <Centered><Loader2 className="w-8 h-8 animate-spin text-primary" /></Centered>;
  if (status === 'error') return <Centered>Couldn&apos;t load the solutions.</Centered>;
  if (status === 'pending') return <Centered>Solutions unlock once results are published.</Centered>;
  if (!data) return null;

  const wrongCount = data.questions.filter((q) => q.isCorrect === false).length;
  const shown = filter === 'wrong' ? data.questions.filter((q) => q.isCorrect === false) : data.questions;

  const isCorrectOpt = (q: Q, oi: number) =>
    q.correctOptions?.length ? q.correctOptions.includes(oi) : q.correctOption === oi;

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="p-2 rounded-xl neu-raised text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Solutions
          </h1>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {(['all', 'wrong'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              disabled={f === 'wrong' && wrongCount === 0}
              className={cn(
                'px-3.5 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider transition-colors min-h-[40px] disabled:opacity-40',
                filter === f ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
              )}
            >
              {f === 'all' ? `All ${data.questions.length}` : `Wrong ${wrongCount}`}
            </button>
          ))}
        </div>

        {shown.map((q) => (
          <div key={q.position} className="neu-raised rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                Q{q.position + 1}{q.subject ? ` · ${q.subject}` : ''}{q.chapter ? ` · ${q.chapter}` : ''}
                <button
                  type="button"
                  onClick={() => void toggleBookmark(q.position)}
                  aria-label={bookmarked.has(q.position) ? 'Remove bookmark' : 'Bookmark this question'}
                  className={bookmarked.has(q.position) ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}
                >
                  {bookmarked.has(q.position) ? '★' : '☆'}
                </button>
                <button
                  type="button"
                  onClick={() => void objectToKey(q.position)}
                  className="text-muted-foreground hover:text-rose-500 normal-case"
                  title="Object to the answer key"
                >
                  ⚑
                </button>
              </span>
              {q.isCorrect === true ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /> +{q.marksAwarded}</span>
              ) : q.isCorrect === false ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-500"><XCircle className="w-3.5 h-3.5" /> {q.marksAwarded}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-muted-foreground"><MinusCircle className="w-3.5 h-3.5" /> Skipped</span>
              )}
            </div>

            <div className="text-[15px] font-bold text-foreground leading-relaxed mb-3"><LatexRenderer content={q.text} /></div>
            {q.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.image} alt="" className="mb-4 max-h-64 w-auto max-w-full rounded-xl object-contain neu-inset p-2" />
            )}

            <div className="space-y-2">
              {(q.options ?? []).map((opt, oi) => {
                const correct = isCorrectOpt(q, oi);
                const chosen = q.submittedOption === oi;
                const wrongChoice = chosen && !correct;
                return (
                  <div
                    key={oi}
                    className={cn(
                      'flex items-start gap-2 px-3 py-2.5 rounded-xl text-[13px]',
                      correct ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : wrongChoice ? 'bg-rose-500/10 ring-1 ring-rose-500/40' : 'neu-inset',
                    )}
                  >
                    <span className={cn('w-5 h-5 shrink-0 rounded flex items-center justify-center text-[11px] font-black',
                      correct ? 'bg-emerald-500 text-white' : wrongChoice ? 'bg-rose-500 text-white' : 'bg-muted text-muted-foreground')}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="text-foreground flex-1 min-w-0">
                      <LatexRenderer content={String(opt)} />
                      {q.optionImages?.[oi] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={q.optionImages[oi] as string} alt="" className="mt-1.5 max-h-24 w-auto max-w-full rounded object-contain" />
                      )}
                    </span>
                    {chosen && <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground shrink-0 self-center">you</span>}
                    {correct && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 self-center" />}
                    {wrongChoice && <XCircle className="w-4 h-4 shrink-0 text-rose-500 self-center" />}
                  </div>
                );
              })}
            </div>

            {q.explanation && (
              <div className="mt-3 neu-inset rounded-xl p-3 text-[13px] font-medium text-muted-foreground leading-relaxed">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary block mb-1">Explanation</span>
                <LatexRenderer content={q.explanation} />
              </div>
            )}

            <ContestDiscussion contestId={contestId} position={q.position} />
          </div>
        ))}

        <NeuButton onClick={() => router.push(`/contest/${contestId}/result`)} className="w-full">
          <span className="font-black text-[12px] uppercase tracking-wider">Back to result</span>
        </NeuButton>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh neu-surface flex flex-col items-center justify-center p-6 text-foreground">{children}</div>;
}
