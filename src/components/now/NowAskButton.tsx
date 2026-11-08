'use client';

/**
 * "Need human help" on an OGCode question (plan doc screen "Ask"; build step
 * "entry screens"). Invisible unless the flag is on and the student is in the
 * pilot cohort. After an attempt it shows the price and the balance; with too
 * few coins it becomes "Buy coins"; tapping it holds the coins, starts the
 * request and opens the room (which shows "Finding a solver…" with Cancel).
 * "Ask first" (pilot readiness item 2) lets the student pick one of their own
 * solvers who is online; if that solver is busy or lets the offer lapse, the
 * usual matching carries on.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Headphones, Loader2 } from 'lucide-react';

import { apiCall } from '@/lib/api';
import { acceptTimeText } from '@/lib/now-format';

import { NowAskLaterForm } from './NowAskLaterForm';

type Quote = {
  available: boolean;
  blockedReason: string | null;
  priceCoins: number | null;
  botPriceCoins: number | null;
  minutes: number | null;
  balance: number;
  canAfford: boolean;
  humansLikely: boolean;
  botOn: boolean;
  attempted: boolean;
  mySolvers: { helperId: string; name: string; favourite: boolean; online: boolean; medianAcceptSeconds?: number | null }[];
  openRequestId: string | null;
};

const BLOCKED: Record<string, string> = {
  needs_guardian_consent: 'A parent or guardian needs to approve live help first.',
  suspended: 'Live help is paused on this account after a report review.',
  attempt_first: 'Try the question first, then ask a teacher live.',
};

export function NowAskButton({ questionId, attempted }: { questionId: string; attempted: boolean }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferred, setPreferred] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/now/quote?questionId=${encodeURIComponent(questionId)}`, { credentials: 'include', cache: 'no-store' });
      setQuote(res.ok ? ((await res.json()).quote as Quote) : null);
    } catch {
      setQuote(null);
    }
  }, [questionId]);

  // Re-quote when the student finishes an attempt on this page.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/now/quote?questionId=${encodeURIComponent(questionId)}`, { credentials: 'include', cache: 'no-store' })
      .then(async (res) => (res.ok ? ((await res.json()).quote as Quote) : null))
      .then((q) => !cancelled && setQuote(q))
      .catch(() => !cancelled && setQuote(null));
    return () => {
      cancelled = true;
    };
  }, [questionId, attempted]);

  const ask = async () => {
    if (!quote) return;
    if (quote.openRequestId) {
      router.push(`/now/room?request=${encodeURIComponent(quote.openRequestId)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiCall('/now/requests', {
        method: 'POST',
        body: JSON.stringify({ questionId, ...(preferred ? { preferredHelperId: preferred } : {}) }),
      });
      router.push(`/now/room?request=${encodeURIComponent(res.request.id as string)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start live help.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  // Not in the pilot / flag off / unsupported question: render nothing.
  if (!quote || (!quote.available && !quote.blockedReason) || quote.blockedReason === 'not_invited' || quote.blockedReason === 'flag_off' || quote.blockedReason === 'question_not_supported') {
    return null;
  }

  const blockedText = quote.blockedReason ? BLOCKED[quote.blockedReason] : null;
  const who = quote.humansLikely ? 'a teacher' : quote.botOn ? 'Origin (AI solver)' : 'a teacher';
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4" data-testid="now-ask">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold"><Headphones className="h-4 w-4 text-primary" aria-hidden /> Still stuck? Talk it through live</p>
          <p className="text-xs text-muted-foreground">
            {blockedText ??
              (quote.openRequestId
                ? 'You already have a live help request open.'
                : `${quote.minutes ?? 5}-minute audio call with ${who}. Only your first name is shared.`)}
          </p>
        </div>
        {!blockedText && (
          quote.openRequestId ? (
            <button onClick={ask} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Open my request</button>
          ) : quote.canAfford ? (
            <button onClick={ask} disabled={busy} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              Solve live · {quote.priceCoins} coins
            </button>
          ) : (
            <button onClick={() => router.push('/now/wallet')} className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary">
              <Coins className="h-4 w-4" /> Buy coins
            </button>
          )
        )}
        {quote.blockedReason === 'needs_guardian_consent' && (
          <button onClick={() => router.push('/now/start')} className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary">Ask a parent</button>
        )}
      </div>
      {!blockedText && !quote.openRequestId && quote.canAfford && (quote.mySolvers ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`now-ask-first-${questionId}`} className="text-muted-foreground">Ask first</label>
          <select
            id={`now-ask-first-${questionId}`}
            value={preferred}
            onChange={(e) => setPreferred(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="">Anyone available</option>
            {quote.mySolvers.map((m) => (
              <option key={m.helperId} value={m.helperId} disabled={!m.online}>
                {m.favourite ? '★ ' : ''}
                {m.name} · {m.online ? 'online' : 'away'}
                {m.online && acceptTimeText(m.medianAcceptSeconds) ? ` · ${acceptTimeText(m.medianAcceptSeconds)}` : ''}
              </option>
            ))}
          </select>
          {preferred && (
            <span className="text-xs text-muted-foreground">
              {quote.mySolvers.find((m) => m.helperId === preferred)?.name} is asked first. If they are busy or do not answer in 25 seconds,
              we ask the next teacher.
            </span>
          )}
        </div>
      )}
      {!blockedText && !quote.openRequestId && (
        <p className="text-xs text-muted-foreground">
          You have {quote.balance} coins.{quote.botOn && quote.botPriceCoins !== null && quote.botPriceCoins !== quote.priceCoins
            ? ` If no teacher is free, Origin's AI solver takes it for ${quote.botPriceCoins} coins and the difference is adjusted.`
            : ''} Coins are only taken for a session that happens.
        </p>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {!blockedText && !quote.openRequestId && quote.attempted && <NowAskLaterForm questionId={questionId} />}
    </div>
  );
}
