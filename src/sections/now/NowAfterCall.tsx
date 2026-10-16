'use client';

/**
 * Origin NOW after-call panel (build step 7; plan doc screens "Rate" and
 * "Practice"): the student's stars, tags, comment and optional tip; three
 * practice questions on the same concept; report and block for both sides.
 * `ReportForm` is also used inside the live room.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, Flag, Loader2, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiCall } from '@/lib/api';

type AfterCall = {
  sessionId: string;
  role: 'student' | 'solver';
  status: string;
  canRate: boolean;
  rating: { stars: number; tags: string[]; tipCoins: number } | null;
  tipCap: number;
  outcome: string | null;
  canRecordOutcome: boolean;
  canReport: boolean;
  reported: boolean;
  practice: string[];
  peerName: string;
};

const TAGS: { id: string; label: string }[] = [
  { id: 'clear_explanation', label: 'Clear explanation' },
  { id: 'fast_response', label: 'Quick to help' },
  { id: 'strong_subject_knowledge', label: 'Knows the subject' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'not_resolved', label: 'Doubt not solved' },
];

const OUTCOMES: { id: string; label: string }[] = [
  { id: 'resolved', label: 'Solved — they understood it' },
  { id: 'partial', label: 'Partly solved' },
  { id: 'unresolved', label: 'Not solved' },
];

const ROOT_CAUSES: { id: string; label: string }[] = [
  { id: 'conceptual_gap', label: 'Concept gap' },
  { id: 'calculation_error', label: 'Calculation slip' },
  { id: 'misread', label: 'Misread the question' },
  { id: 'careless_error', label: 'Careless mistake' },
  { id: 'time_pressure', label: 'Time pressure' },
  { id: 'other', label: 'Other' },
];

const REASONS: { id: string; label: string }[] = [
  { id: 'child_safety', label: 'Inappropriate or unsafe behaviour' },
  { id: 'abuse', label: 'Rude or abusive' },
  { id: 'contact_sharing', label: 'Asked for phone, social media or to meet' },
  { id: 'wrong_content', label: 'Wrong or misleading explanation' },
  { id: 'no_show', label: 'Did not show up' },
  { id: 'other', label: 'Something else' },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function ReportForm({
  sessionId,
  peerName,
  canBlock,
  onDone,
  onCancel,
}: {
  sessionId: string;
  peerName: string;
  canBlock: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await apiCall(`/now/sessions/${sessionId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason, details: details.trim() || null, block: canBlock && block }),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Report {peerName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-muted-foreground">What happened?</legend>
          {REASONS.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="now-report-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1">
          <Label htmlFor="now-report-details">Anything else we should know (optional)</Label>
          <Textarea id="now-report-details" value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} rows={3} />
        </div>
        {canBlock && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={block} onCheckedChange={(v) => setBlock(v === true)} />
            Never match me with {peerName} again
          </label>
        )}
        {reason === 'child_safety' || reason === 'abuse' ? (
          <p className="text-xs text-muted-foreground">If the call is still on, it ends as soon as you send this. The recording is kept for our team.</p>
        ) : null}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="destructive" onClick={submit} disabled={!reason || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flag className="mr-2 h-4 w-4" />}
            Send report
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NowAfterCall({ sessionId, botSession }: { sessionId: string; botSession: boolean }) {
  const [after, setAfter] = useState<AfterCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [outcome, setOutcome] = useState<string>('');
  const [rootCause, setRootCause] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiCall(`/now/sessions/${sessionId}/after`);
      setAfter(data.after as AfterCall);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitRating = async () => {
    setBusy('rate');
    setError(null);
    try {
      const data = await apiCall(`/now/sessions/${sessionId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ stars, tags, comment: comment.trim() || null, tipCoins: tip }),
      });
      setAfter(data.after as AfterCall);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const submitOutcome = async () => {
    setBusy('outcome');
    setError(null);
    try {
      await apiCall(`/now/sessions/${sessionId}/outcome`, {
        method: 'POST',
        body: JSON.stringify({ outcome, rootCause: rootCause || null }),
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const block = async () => {
    setBusy('block');
    try {
      await apiCall(`/now/sessions/${sessionId}/block`, { method: 'POST' });
      setNotice(`You will not be matched with ${after?.peerName ?? 'them'} again.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!after) {
    return error ? <p className="text-sm text-red-600">{error}</p> : null;
  }

  const isStudent = after.role === 'student';

  return (
    <div className="flex flex-col gap-4">
      {isStudent && after.canRate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How was the help from {after.peerName}?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-1" role="radiogroup" aria-label="Stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={stars === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onClick={() => setStars(n)}
                  className="rounded p-1 hover:bg-muted"
                >
                  <Star className={`h-7 w-7 ${n <= stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((t) => {
                const on = tags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTags(on ? tags.filter((x) => x !== t.id) : [...tags, t.id])}
                    className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-primary bg-primary/10 text-primary' : ''}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="now-rating-comment">A note for {after.peerName} (optional)</Label>
              <Textarea id="now-rating-comment" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            {after.tipCap > 0 && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="now-tip">Tip in Ori Coins (optional, up to {after.tipCap})</Label>
                <Input
                  id="now-tip"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={after.tipCap}
                  value={tip}
                  onChange={(e) => setTip(Math.max(0, Math.min(after.tipCap, Math.floor(Number(e.target.value) || 0))))}
                  className="w-32"
                />
              </div>
            )}
            <Button onClick={submitRating} disabled={stars === 0 || busy === 'rate'} className="self-start">
              {busy === 'rate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send rating{tip > 0 ? ` and ${tip} coin tip` : ''}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isStudent && after.canRecordOutcome && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How did it go? (needed to get your coins)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Outcome">
              {OUTCOMES.map((o) => (
                <Button key={o.id} variant={outcome === o.id ? 'default' : 'outline'} role="radio" aria-checked={outcome === o.id} onClick={() => setOutcome(o.id)}>
                  {o.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">What was behind the doubt? (optional)</span>
              <div className="flex flex-wrap gap-2">
                {ROOT_CAUSES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={rootCause === c.id}
                    onClick={() => setRootCause(rootCause === c.id ? '' : c.id)}
                    className={`rounded-full border px-3 py-1 text-sm ${rootCause === c.id ? 'border-primary bg-primary/10 text-primary' : ''}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={submitOutcome} disabled={!outcome || busy === 'outcome'} className="self-start">
              {busy === 'outcome' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      {!isStudent && after.outcome && <p className="text-sm text-muted-foreground">Outcome saved: {OUTCOMES.find((o) => o.id === after.outcome)?.label}.</p>}

      {isStudent && after.rating && (
        <p className="text-sm text-muted-foreground">
          Thanks — you gave {after.rating.stars} star{after.rating.stars > 1 ? 's' : ''}
          {after.rating.tipCoins > 0 ? ` and a ${after.rating.tipCoins} coin tip` : ''}.
        </p>
      )}

      {isStudent && after.practice.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lock it in: {after.practice.length} questions on the same idea</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {after.practice.map((questionId, index) => (
              <Link
                key={questionId}
                href={`/ogcode/${encodeURIComponent(questionId)}`}
                onClick={() => {
                  void apiCall(`/now/sessions/${sessionId}/practice`, { method: 'POST', body: JSON.stringify({ questionId }) }).catch(
                    () => undefined,
                  );
                }}
                className="rounded border px-3 py-2 text-sm hover:bg-muted"
              >
                Practice question {index + 1}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {reporting ? (
        <ReportForm
          sessionId={sessionId}
          peerName={after.peerName}
          canBlock={!botSession || !isStudent}
          onCancel={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            setNotice('Thanks for telling us. Our team will look at it; safety reports get a reply within a working day.');
            void load();
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {after.canReport && (
            <Button variant="outline" size="sm" onClick={() => setReporting(true)}>
              <Flag className="mr-2 h-4 w-4" /> Report a problem
            </Button>
          )}
          {after.reported && <span className="text-sm text-muted-foreground">You reported this call.</span>}
          {!(botSession && isStudent) && (
            <Button variant="ghost" size="sm" onClick={block} disabled={busy === 'block'}>
              <Ban className="mr-2 h-4 w-4" /> Don&apos;t match me with {after.peerName} again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
