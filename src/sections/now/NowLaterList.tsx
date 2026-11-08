'use client';

/**
 * The student's ask-later doubts (decision B94): status, the written answer
 * with any photos, then accept (stars and an optional tip) or report it.
 * A doubt nobody has picked up yet can be cancelled for its coins.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Flag, Loader2, Star } from 'lucide-react';

import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiCall } from '@/lib/api';
import { formatISTDateTimeDMY } from '@/lib/format-time';

type Item = {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: string;
  question: { text: string };
  note: string | null;
  photos: string[];
  priceCoins: number;
  status: 'open' | 'claimed' | 'answered' | 'accepted' | 'disputed' | 'expired' | 'cancelled';
  otherName: string | null;
  answer: { text: string; photos: string[]; at: string } | null;
  stars: number | null;
  tipCoins: number;
  expiresAt: string;
  createdAt: string;
  canCancel: boolean;
  canRespond: boolean;
};

const STATUS: Record<Item['status'], string> = {
  open: 'Waiting for a solver',
  claimed: 'A solver is writing your answer',
  answered: 'Answered — please rate it',
  accepted: 'Done',
  disputed: 'Reported — our team is checking',
  expired: 'Nobody answered in time — coins returned',
  cancelled: 'Cancelled — coins returned',
};

const REASONS = [
  { id: 'wrong_content', label: 'Wrong or misleading answer' },
  { id: 'abuse', label: 'Rude or abusive' },
  { id: 'contact_sharing', label: 'Asked for phone, social media or to meet' },
  { id: 'child_safety', label: 'Inappropriate or unsafe' },
  { id: 'other', label: 'Something else' },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function Photos({ urls, label }: { urls: string[]; label: string }) {
  if (urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer noopener" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed links to the private bucket */}
          <img src={u} alt={`${label} ${i + 1}`} className="h-24 w-24 rounded-md border object-cover" />
        </a>
      ))}
    </div>
  );
}

function Respond({ item, onDone }: { item: Item; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const [tip, setTip] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (path: 'accept' | 'report', body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      await apiCall(`/now/later/${item.id}/${path}`, { method: 'POST', body: JSON.stringify(body) });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (reporting) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-destructive/40 p-3">
        <label htmlFor={`later-reason-${item.id}`} className="text-xs text-muted-foreground">What went wrong?</label>
        <select id={`later-reason-${item.id}`} className="min-h-[48px] rounded-md border bg-background px-3 text-base sm:text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Pick a reason</option>
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <textarea
          aria-label="More detail (optional)"
          className="min-h-24 rounded-md border bg-background p-3 text-base sm:text-sm"
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="More detail (optional)"
        />
        <p className="text-xs text-muted-foreground">Your coins wait while our team checks. If they agree, the coins come back to you.</p>
        <div className="flex gap-2">
          <Button className="h-[48px]" size="sm" variant="destructive" disabled={!reason || busy} onClick={() => send('report', { reason, details: details.trim() || null })}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Flag className="mr-1 h-4 w-4" />} Send report
          </Button>
          <Button className="h-[48px]" size="sm" variant="ghost" onClick={() => setReporting(false)} disabled={busy}>Back</Button>
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rate the answer">
        {[1, 2, 3, 4, 5].map((n) => (
          <button className="cursor-pointer rounded-full p-[12px]" key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setStars(n)}>
            <Star className={`h-[24px] w-[24px] ${n <= stars ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
          </button>
        ))}
      </div>
      <label htmlFor={`later-tip-${item.id}`} className="flex items-center gap-2 text-xs text-muted-foreground">
        Tip (coins, optional)
        <input
          id={`later-tip-${item.id}`}
          inputMode="numeric"
          className="min-h-[48px] w-24 rounded-md border bg-background px-3 text-base sm:text-sm"
          value={tip}
          onChange={(e) => setTip(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button className="h-[48px]" size="sm" disabled={!stars || busy} onClick={() => send('accept', { stars, tipCoins: tip ? Number(tip) : 0 })}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Done, it helped
        </Button>
        <Button className="h-[48px]" size="sm" variant="ghost" onClick={() => setReporting(true)} disabled={busy}>
          <Flag className="mr-1 h-4 w-4" /> Report a problem
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">If you do neither within 48 hours, the answer counts as accepted.</p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export default function NowLaterList() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(((await apiCall('/now/later')) as { items: Item[] }).items);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/later')
      .then((res) => !cancelled && setItems((res as { items: Item[] }).items))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const cancel = async (item: Item) => {
    setBusy(item.id);
    try {
      await apiCall(`/now/later/${item.id}/cancel`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!items) {
    return error ? (
      <p className="p-6 text-sm text-muted-foreground">{error}</p>
    ) : (
      <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Asked for later</h1>
          <p className="text-sm text-muted-foreground">Doubts answered in writing by a verified solver, without a live call.</p>
        </div>
        <Link href="/now/doubts" className="inline-flex min-h-[48px] items-center rounded-full border px-4 text-sm hover:bg-muted">My doubts</Link>
      </header>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. On any question you have tried, choose &ldquo;Or ask later&rdquo; under Solve live.
        </p>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span><span className="capitalize">{item.subject}</span> · {item.chapter ?? '—'} · <span className="capitalize">{item.difficulty}</span></span>
                <span className="text-xs font-normal text-muted-foreground">{STATUS[item.status]}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="line-clamp-4 text-muted-foreground"><FormattedMessage content={item.question.text} /></div>
              {item.note && <p className="rounded-md bg-muted p-2">You wrote: {item.note}</p>}
              <Photos urls={item.photos} label="Your photo" />
              {(item.status === 'open' || item.status === 'claimed') && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> Answer due by {formatISTDateTimeDMY(item.expiresAt)} · {item.priceCoins} coins held
                </p>
              )}
              {item.answer && (
                <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground">
                    Answer from {item.otherName ?? 'your solver'} · {formatISTDateTimeDMY(item.answer.at)}
                  </p>
                  <div className="leading-relaxed"><FormattedMessage content={item.answer.text} /></div>
                  <Photos urls={item.answer.photos} label="Solver's photo" />
                </div>
              )}
              {item.canRespond && <Respond item={item} onDone={() => void load()} />}
              {item.status === 'accepted' && item.stars && (
                <p className="text-xs text-muted-foreground">You rated it {item.stars}★{item.tipCoins ? ` and tipped ${item.tipCoins} coins` : ''}.</p>
              )}
              {item.canCancel && (
                <Button size="sm" variant="ghost" className="h-[48px] self-start" onClick={() => cancel(item)} disabled={busy === item.id}>
                  Cancel and get {item.priceCoins} coins back
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
