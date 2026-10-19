'use client';

/**
 * "Ask later" under the Solve live card (decision B94): when nobody is free,
 * or the student prefers it, they post the doubt with a note and up to three
 * photos of their working; a solver answers in writing within the set hours.
 * Coins are held now and come back if nobody answers in time.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Camera, Loader2, PenLine, X } from 'lucide-react';

import { apiCall } from '@/lib/api';

import { LATER_MAX_PHOTOS, LATER_PHOTO_ACCEPT, uploadLaterPhoto } from './later-photos';

type Quote = { enabled: boolean; priceCoins: number | null; answerHours: number; balance: number; open: number; maxOpen: number };

export function NowAskLaterForm({ questionId }: { questionId: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<{ key: string; name: string }[]>([]);
  const [busy, setBusy] = useState<'photo' | 'post' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiCall(`/now/later/quote?question=${encodeURIComponent(questionId)}`)
      .then((res) => !cancelled && setQuote((res as { quote: Quote }).quote))
      .catch(() => !cancelled && setQuote(null));
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  if (!quote?.enabled || quote.priceCoins === null) return null;
  if (posted) {
    return (
      <p className="text-sm text-emerald-700" role="status">
        Posted. A solver will answer within {quote.answerHours} hours; we will email you. <Link className="underline" href="/now/later">See my doubts</Link>
      </p>
    );
  }
  const short = quote.balance < quote.priceCoins;
  const full = quote.open >= quote.maxOpen;

  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    setError(null);
    try {
      const key = await uploadLaterPhoto(file);
      setPhotos((p) => [...p, { key, name: file.name }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The photo did not upload.');
    } finally {
      setBusy(null);
    }
  };

  const post = async () => {
    setBusy('post');
    setError(null);
    try {
      await apiCall('/now/later', {
        method: 'POST',
        headers: { 'Idempotency-Key': `later:${questionId}:${crypto.randomUUID()}` },
        body: JSON.stringify({ questionId, note: note.trim() || null, photoKeys: photos.map((p) => p.key) }),
      });
      setPosted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the doubt.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t pt-3 text-sm" data-testid="now-ask-later">
      {!open ? (
        <button type="button" className="flex items-center gap-2 self-start text-primary underline-offset-4 hover:underline" onClick={() => setOpen(true)}>
          <PenLine className="h-4 w-4" aria-hidden /> Or ask later: a written answer within {quote.answerHours} hours for {quote.priceCoins} coins
        </button>
      ) : (
        <>
          <label htmlFor={`now-later-note-${questionId}`} className="text-xs text-muted-foreground">
            What are you stuck on? (optional)
          </label>
          <textarea
            id={`now-later-note-${questionId}`}
            className="min-h-20 rounded-md border bg-background p-2 text-sm"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="I got up to the second step but my answer does not match."
          />
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((p) => (
              <span key={p.key} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                {p.name.slice(0, 24)}
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPhotos((all) => all.filter((x) => x.key !== p.key))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {photos.length < LATER_MAX_PHOTOS && (
              <label className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs">
                {busy === 'photo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" aria-hidden />}
                Add a photo of your working
                <input type="file" accept={LATER_PHOTO_ACCEPT} className="hidden" onChange={(e) => void addPhoto(e.target.files?.[0])} />
              </label>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={post}
              disabled={busy !== null || short || full}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy === 'post' ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : null}
              {short ? `Need ${quote.priceCoins - quote.balance} more coins` : full ? 'Too many doubts waiting' : `Post for ${quote.priceCoins} coins`}
            </button>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setOpen(false)}>
              Not now
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Coins are held now and come back if nobody answers within {quote.answerHours} hours. Do not add phone numbers, emails or links.
          </p>
        </>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
