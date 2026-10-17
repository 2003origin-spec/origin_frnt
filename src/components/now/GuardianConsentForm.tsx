'use client';

/**
 * Date of birth + guardian consent request (plan doc "Guardian consent"):
 * used by /now/start (purpose "student") and the solver application
 * (purpose "solver"). Adults need no consent; minors send their guardian a
 * single-use email link that is valid for 72 hours.
 */

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MailCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiCall } from '@/lib/api';

import { DateInputDMY } from './DateInputDMY';

export type ConsentStatus = {
  dateOfBirth: string | null;
  isMinor: boolean;
  student: { consented: boolean; pendingSentTo: string | null };
  solver: { consented: boolean; pendingSentTo: string | null };
};

const RELATIONSHIPS = [
  { id: 'mother', label: 'Mother' },
  { id: 'father', label: 'Father' },
  { id: 'legal_guardian', label: 'Legal guardian' },
  { id: 'other_guardian', label: 'Other guardian' },
];

export function GuardianConsentForm({ purpose, onReady }: { purpose: 'student' | 'solver'; onReady?: (status: ConsentStatus) => void }) {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [dob, setDob] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('mother');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resend, setResend] = useState(false);

  const apply = useCallback(
    (next: ConsentStatus) => {
      setStatus(next);
      const done = !next.isMinor || next[purpose].consented;
      if (done && next.dateOfBirth) onReady?.(next);
    },
    [onReady, purpose],
  );

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/consent')
      .then((res) => !cancelled && apply(res as ConsentStatus))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load.'));
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiCall('/now/consent/start', {
        method: 'POST',
        body: JSON.stringify({
          purpose,
          dateOfBirth: status?.dateOfBirth ? null : dob || null,
          guardianName: name.trim(),
          guardianEmail: email.trim(),
          guardianPhone: phone.trim() || null,
          relationship,
        }),
      });
      setResend(false);
      apply(res.status as ConsentStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request.');
      // The date of birth may have been saved before the guardian details were checked.
      await apiCall('/now/consent').then((res) => apply(res as ConsentStatus)).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!status) return error ? <p className="text-sm text-red-600">{error}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />;

  const mine = status[purpose];
  if (status.dateOfBirth && (!status.isMinor || mine.consented)) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> {status.isMinor ? 'Your parent or guardian has approved.' : 'No guardian approval needed.'}
      </p>
    );
  }
  if (status.dateOfBirth && mine.pendingSentTo && !resend) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="flex items-center gap-2"><MailCheck className="h-4 w-4 text-primary" /> We emailed {mine.pendingSentTo}. The link works once and lasts 72 hours.</p>
        <p className="text-muted-foreground">This page updates once they approve. Wrong email or no mail?</p>
        <Button variant="outline" size="sm" className="self-start" onClick={() => setResend(true)}>Send to a different email</Button>
      </div>
    );
  }

  const needsDob = !status.dateOfBirth;
  // With no date of birth yet we ask for the guardian too; an adult's guardian fields are simply ignored.
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      {needsDob && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="now-dob">Your date of birth</Label>
          <DateInputDMY id="now-dob" required value={dob} onChange={setDob} className="w-48" />
          <p className="text-xs text-muted-foreground">Under 18? A parent or guardian approves first. Adults can skip the rest.</p>
        </div>
      )}
      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-xs text-muted-foreground">Parent or guardian (needed if you are under 18)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="now-g-name">Their name</Label>
            <Input id="now-g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required={!needsDob} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="now-g-rel">They are your</Label>
            <select id="now-g-rel" className="h-9 rounded-md border bg-background px-2" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
              {RELATIONSHIPS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="now-g-email">Their email</Label>
            <Input id="now-g-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required={!needsDob} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="now-g-phone">Their phone (optional)</Label>
            <Input id="now-g-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
          </div>
        </div>
      </fieldset>
      {error && <p className="text-red-600" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} className="self-start">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {needsDob ? 'Continue' : 'Email my parent or guardian'}
      </Button>
    </form>
  );
}
