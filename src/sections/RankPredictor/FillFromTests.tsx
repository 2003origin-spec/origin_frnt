'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Loader2, RotateCcw, Sigma } from 'lucide-react';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatISTDayDMY } from '@/lib/format-time';
import type { AttemptFill, AttemptSummary } from '@/lib/rank-predictor/attempt-mapping';
import { EXAM_LABEL } from '@/lib/rank-predictor/format';
import type { RankPredictorExam } from '@/lib/rank-predictor/types';

import { fetchAttemptFill, fetchAttempts, fetchAverageFill, friendlyError } from './api';
import { SHEET_CLOSE_48 } from './LimitSheet';

const KIND_LABEL: Record<AttemptSummary['kind'], string> = {
  full_mock: 'Full mock',
  subject: 'Subject test',
  teacher: 'Teacher test',
  other: 'Test',
};

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; attempts: AttemptSummary[] };

export default function FillFromTests({
  open,
  onOpenChange,
  exam,
  onFill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: RankPredictorExam;
  onFill: (fill: AttemptFill) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', attempts: await fetchAttempts(exam) });
    } catch (error) {
      setState({ status: 'error', message: friendlyError(error, 'Could not load your tests.') });
    }
  }, [exam]);

  useEffect(() => {
    if (open) {
      setPickError(null);
      void load();
    }
  }, [open, load]);

  const pick = async (id: string | 'avg3') => {
    setBusyId(id);
    setPickError(null);
    try {
      const fill = id === 'avg3' ? await fetchAverageFill(exam) : await fetchAttemptFill(id, exam);
      onFill(fill);
      onOpenChange(false);
    } catch (error) {
      setPickError(friendlyError(error, 'Could not use that test.'));
    } finally {
      setBusyId(null);
    }
  };

  const mocks = state.status === 'ready' ? state.attempts.filter((a) => a.kind === 'full_mock').length : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" closeClassName={SHEET_CLOSE_48} className="max-h-[85dvh] overflow-y-auto rounded-t-[26px] border-border bg-card px-4 pb-6 sm:mx-auto sm:max-w-xl">
        <SheetHeader className="px-0">
          <SheetTitle className="font-display text-[21px] font-bold">Fill from my tests</SheetTitle>
          <SheetDescription>
            Pick a past Origin test. A full {EXAM_LABEL[exam]} mock fills every subject; other tests fill only the subjects they cover.
          </SheetDescription>
        </SheetHeader>

        {pickError ? (
          <p role="alert" className="rounded-[12px] bg-surface-2 px-4 py-3 text-[14px] text-foreground">
            {pickError}
          </p>
        ) : null}

        {state.status === 'loading' ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading your tests">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-[12px] bg-surface-2 motion-safe:animate-pulse" />
            ))}
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-[12px] bg-surface-2 p-4">
            <p className="text-[14px] text-foreground">{state.message}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-border px-5 text-[14px] font-semibold text-foreground hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <RotateCcw aria-hidden className="size-4" /> Try again
            </button>
          </div>
        ) : null}

        {state.status === 'ready' && state.attempts.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-[12px] bg-surface-2 p-4">
            <ClipboardList aria-hidden className="size-6 text-muted-foreground" />
            <p className="text-[14px] text-foreground">No past tests for {EXAM_LABEL[exam]} yet.</p>
            <Link
              href="/tests"
              className="inline-flex min-h-12 items-center rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Take a full mock
            </Link>
          </div>
        ) : null}

        {state.status === 'ready' && state.attempts.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {mocks > 0 ? (
              <li>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void pick('avg3')}
                  className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[12px] border border-primary/60 bg-primary/10 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === 'avg3' ? <Loader2 aria-hidden className="size-5 shrink-0 motion-safe:animate-spin" /> : <Sigma aria-hidden className="size-5 shrink-0 text-primary" />}
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold text-foreground">Average of my last {Math.min(3, mocks)} full mock{Math.min(3, mocks) === 1 ? '' : 's'}</span>
                    <span className="text-[13px] text-muted-foreground">Steadier than one lucky paper</span>
                  </span>
                </button>
              </li>
            ) : null}
            {state.attempts.map((a) => (
              <li key={a.resultId}>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void pick(a.resultId)}
                  className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-[12px] bg-surface-2 px-4 py-3 text-left hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold text-foreground">{a.title}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {KIND_LABEL[a.kind]} · {formatISTDayDMY(a.takenAt)} · {Object.keys(a.subjects).length} subject{Object.keys(a.subjects).length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-[17px] font-bold tabular-nums text-foreground">
                    {busyId === a.resultId ? <Loader2 aria-label="Loading" className="size-5 motion-safe:animate-spin" /> : `${Math.round(a.score)}/${Math.round(a.outOf)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
