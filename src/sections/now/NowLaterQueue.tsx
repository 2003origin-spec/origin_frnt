'use client';

/**
 * Ask later for solvers (decision B94): doubts waiting in your subjects,
 * oldest first. Claim one (you hold it for a set time; one at a time), read
 * the question, the student's note and photos, and write the answer with up
 * to three photos of your working. Contact details are refused.
 */

import { useCallback, useEffect, useState } from 'react';
import { Camera, Clock, Loader2, PenLine, X } from 'lucide-react';

import { LATER_MAX_PHOTOS, LATER_PHOTO_ACCEPT, uploadLaterPhoto } from '@/components/now/later-photos';
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
  question: { text: string; options: string[]; image: string | null };
  note: string | null;
  photos: string[];
  priceCoins: number;
  status: string;
  otherName: string | null;
  answer: { text: string; at: string } | null;
  stars: number | null;
  tipCoins: number;
  expiresAt: string;
  claimExpiresAt: string | null;
};
type Queue = { open: Item[]; mine: Item[] };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function AnswerForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<{ key: string; name: string }[]>([]);
  const [busy, setBusy] = useState<'photo' | 'send' | 'release' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    setError(null);
    try {
      const key = await uploadLaterPhoto(file, item.id);
      setPhotos((p) => [...p, { key, name: file.name }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const call = async (path: 'answer' | 'release', body?: unknown) => {
    setBusy(path === 'answer' ? 'send' : 'release');
    setError(null);
    try {
      await apiCall(`/now/helper/later/${item.id}/${path}`, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border p-3 leading-relaxed"><FormattedMessage content={item.question.text} /></div>
      {item.question.options.length > 0 && (
        <ol className="grid gap-1 text-xs sm:grid-cols-2">
          {item.question.options.map((o, i) => (
            <li key={i} className="rounded border px-2 py-1"><span className="mr-1 font-semibold">{String.fromCharCode(65 + i)}.</span><FormattedMessage content={o} inline /></li>
          ))}
        </ol>
      )}
      {item.note && <p className="rounded-md bg-muted p-2 text-sm">{item.otherName ?? 'The student'} wrote: {item.note}</p>}
      {item.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.photos.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer noopener">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed links to the private bucket */}
              <img src={u} alt={`Student's photo ${i + 1}`} className="h-24 w-24 rounded-md border object-cover" />
            </a>
          ))}
        </div>
      )}
      <label htmlFor={`later-answer-${item.id}`} className="text-xs text-muted-foreground">Your answer (step by step; LaTeX like $v^2 = u^2 + 2as$ works)</label>
      <textarea
        id={`later-answer-${item.id}`}
        className="min-h-40 rounded-md border bg-background p-3 text-base sm:text-sm"
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((p) => (
          <span key={p.key} className="flex min-h-[48px] items-center gap-1 rounded-full border pl-3 text-xs">
            {p.name.slice(0, 24)}
            <button className="inline-flex h-[48px] w-[48px] cursor-pointer items-center justify-center rounded-full" type="button" aria-label={`Remove ${p.name}`} onClick={() => setPhotos((all) => all.filter((x) => x.key !== p.key))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {photos.length < LATER_MAX_PHOTOS && (
          <label className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border px-4 text-xs">
            {busy === 'photo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" aria-hidden />}
            Add a photo of your working
            <input type="file" accept={LATER_PHOTO_ACCEPT} className="hidden" onChange={(e) => void addPhoto(e.target.files?.[0])} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="h-[48px]" size="sm" disabled={text.trim().length < 20 || busy !== null} onClick={() => call('answer', { text, photoKeys: photos.map((p) => p.key) })}>
          {busy === 'send' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Send answer
        </Button>
        <Button className="h-[48px]" size="sm" variant="ghost" disabled={busy !== null} onClick={() => call('release')}>
          Give it back to the queue
        </Button>
      </div>
      {item.claimExpiresAt && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Yours until {formatISTDateTimeDMY(item.claimExpiresAt)}. Never share phone numbers, emails or links.
        </p>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export function NowLaterQueue() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setQueue(((await apiCall('/now/helper/later')) as { queue: Queue }).queue);
      setError(null);
    } catch {
      setQueue(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/helper/later')
      .then((res) => !cancelled && setQueue((res as { queue: Queue }).queue))
      .catch(() => !cancelled && setQueue(null));
    return () => {
      cancelled = true;
    };
  }, []);

  // Off (or not a verified solver): nothing to show.
  if (!queue) return null;
  const held = queue.mine.find((m) => m.status === 'claimed');
  const done = queue.mine.filter((m) => m.status !== 'claimed').slice(0, 5);

  const claim = async (item: Item) => {
    setBusy(item.id);
    setError(null);
    try {
      await apiCall(`/now/helper/later/${item.id}/claim`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(errorMessage(err));
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><PenLine className="h-4 w-4 text-primary" aria-hidden /> Ask later</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {held ? (
          <AnswerForm item={held} onDone={() => void load()} />
        ) : queue.open.length === 0 ? (
          <p className="text-muted-foreground">No written doubts waiting in your subjects right now.</p>
        ) : (
          <ul className="divide-y">
            {queue.open.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span><span className="capitalize">{item.subject}</span> · {item.chapter ?? '—'} · <span className="capitalize">{item.difficulty}</span></span>
                  <span className="block text-xs text-muted-foreground">
                    {item.priceCoins} coins · due {formatISTDateTimeDMY(item.expiresAt)}
                    {item.note ? ' · has a note' : ''}
                  </span>
                </span>
                <Button className="h-[48px]" size="sm" variant="outline" disabled={busy !== null} onClick={() => claim(item)}>
                  {busy === item.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Answer this
                </Button>
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <div className="border-t pt-2 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Your recent written answers</p>
            {done.map((d) => (
              <p key={d.id} className="capitalize">
                {d.subject} · {d.difficulty} · {d.status}
                {d.stars ? ` · ${d.stars}★` : ''}
                {d.tipCoins ? ` · tip ${d.tipCoins}` : ''}
              </p>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <p className="text-xs text-muted-foreground">Coins for an accepted answer wait 24 hours, like a call. Students can report an answer; our team checks every report.</p>
      </CardContent>
    </Card>
  );
}
