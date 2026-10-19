'use client';

/**
 * Guardian consent landing page for Origin NOW (link from the consent email).
 * Public: the guardian has no Origin account; the single-use token in the URL
 * is the credential. Plan: V1/ORIGIN_NOW_PLAN.md, build step 4.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Mic, ShieldCheck, VideoOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

type Preview = {
  childName: string;
  guardianName: string;
  purpose: 'student' | 'solver';
  expired: boolean;
  alreadyConfirmed: boolean;
};

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; preview: Preview }
  | { kind: 'done'; preview: Preview };

function ConsentForm() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'This consent link is not valid.' });
      return;
    }
    let cancelled = false;
    fetch(`/api/now/consent/preview?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: 'error', message: body.detail ?? 'This consent link is not valid.' });
          return;
        }
        const preview = body as Preview;
        setState(preview.alreadyConfirmed ? { kind: 'done', preview } : { kind: 'ready', preview });
      })
      .catch(() => !cancelled && setState({ kind: 'error', message: 'Could not load this page. Please try again.' }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function confirm(preview: Preview) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/now/consent/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acceptedPolicy: accepted }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(body.detail ?? 'Something went wrong. Please try again.');
        return;
      }
      setState({ kind: 'done', preview });
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === 'loading') {
    return <p className="text-center text-sm text-slate-500">Loading…</p>;
  }
  if (state.kind === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link not valid</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const { preview } = state;
  if (state.kind === 'done') {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
          <CardTitle>Thank you, {preview.guardianName}</CardTitle>
          <CardDescription>
            Your consent is recorded. {preview.childName} can now use Origin NOW. To withdraw consent at any time, email
            support@o3origin.com.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (preview.expired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This link has expired</CardTitle>
          <CardDescription>Ask {preview.childName} to send a new consent request from the Origin app.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const what =
    preview.purpose === 'student'
      ? 'join short live doubt-solving calls with verified Origin teachers'
      : 'help other students as an Origin doubt solver';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consent for {preview.childName}</CardTitle>
        <CardDescription>
          Dear {preview.guardianName}, {preview.childName} would like to {what} on Origin NOW.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <li className="flex gap-3">
            <Mic className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
            Calls are audio only. {preview.purpose === 'student' ? 'Your child’s camera is never turned on.' : ''}
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
            Every call is recorded for safety, kept for 30 days and reviewed only if someone reports a problem.
          </li>
          <li className="flex gap-3">
            <VideoOff className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
            Phone numbers and contact details are never shared, and there is no private chat.
          </li>
        </ul>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
          <span>
            I am {preview.childName}’s parent or legal guardian, I have read the{' '}
            <a href="/childrens-policy" target="_blank" rel="noreferrer" className="text-blue-600 underline">
              children’s privacy policy
            </a>
            , and I give my consent.
          </span>
        </label>
        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
        <Button className="w-full" disabled={!accepted || submitting} onClick={() => confirm(preview)}>
          {submitting ? 'Saving…' : 'Give consent'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OriginNowConsentPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <Suspense fallback={<p className="text-center text-sm text-slate-500">Loading…</p>}>
        <ConsentForm />
      </Suspense>
    </main>
  );
}
