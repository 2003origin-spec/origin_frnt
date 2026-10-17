'use client';

/**
 * "Become a solver" (plan doc "Teacher verification": apply → KYC → subject
 * quiz → demo → admin approval). The applicant fills the draft, uploads
 * documents straight to private storage, takes a timed quiz per subject
 * (answers never reach the browser), accepts the Helper Agreement and
 * submits. An under-18 applicant needs guardian consent for purpose "solver".
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, FileUp, Loader2 } from 'lucide-react';

import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { GuardianConsentForm } from '@/components/now/GuardianConsentForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiCall } from '@/lib/api';

type Application = {
  id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  role: string | null;
  displayName: string;
  subjects: string[];
  languages: string[];
  documents: string[];
  panMasked: string | null;
  quizScores: Record<string, number>;
  agreementVersion: string | null;
  rejectReason: string | null;
  isMinor: boolean;
  hasSolverConsent: boolean;
  readiness: { ready: boolean; missing: string[] };
};
type Quiz = { attemptId: string; subject: string; expiresAt: string; questions: { id: string; text: string; options: string[]; image: string | null }[] };
type QuizRules = { questions: number; minutes: number; passPercent: number };

const ROLES = [
  { id: 'teacher', label: 'Teacher' },
  { id: 'college_student', label: 'College student' },
  { id: 'school_student', label: 'School student (class 11–12)' },
  { id: 'other', label: 'Other' },
];
const SUBJECTS = ['physics', 'chemistry', 'mathematics', 'biology'];
const LANGUAGES = ['english', 'hindi', 'hinglish', 'tamil', 'telugu', 'kannada', 'bengali', 'marathi'];
const DOCS: { id: string; label: string; hint: string }[] = [
  { id: 'aadhaar_masked', label: 'Masked Aadhaar', hint: 'First 8 digits hidden (download the masked copy from UIDAI). Never upload the full number.' },
  { id: 'selfie', label: 'Selfie', hint: 'A clear photo of your face, to match your ID.' },
  { id: 'marksheet', label: '10th or 12th marksheet', hint: 'Any one of marksheet, degree or teaching certificate is enough.' },
  { id: 'degree', label: 'Degree certificate', hint: '' },
  { id: 'teaching_certificate', label: 'Teaching certificate', hint: '' },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function QuizRunner({ quiz, onDone }: { quiz: Quiz; onDone: (message: string) => void }) {
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [left, setLeft] = useState(() => new Date(quiz.expiresAt).getTime() - Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setLeft(new Date(quiz.expiresAt).getTime() - Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [quiz.expiresAt]);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiCall(`/now/solver/quiz/${quiz.attemptId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
      onDone(res.passed ? `You scored ${res.percent}% in ${quiz.subject}. Passed.` : `You scored ${res.percent}% in ${quiz.subject}. You can retake it after 24 hours.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const seconds = Math.max(0, Math.floor(left / 1000));
  return (
    <Card className="border-primary">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base capitalize">
          {quiz.subject} quiz
          <span className={`flex items-center gap-1 font-mono text-sm ${seconds < 60 ? 'text-red-600' : ''}`}><Clock className="h-4 w-4" />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
        </CardTitle>
        <CardDescription>One attempt per subject every 24 hours. Your answers are checked on the server.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {quiz.questions.map((q, n) => (
          <fieldset key={q.id} className="flex flex-col gap-2 border-b pb-3 text-sm">
            <legend className="mb-1 font-medium">Q{n + 1}. <FormattedMessage content={q.text} inline /></legend>
            {q.image && (
              // eslint-disable-next-line @next/next/no-img-element -- catalog question figures come from the CDN
              <img src={q.image} alt="" className="max-h-56 rounded border object-contain" />
            )}
            {q.options.map((o, i) => (
              <label key={i} className="flex items-start gap-2">
                <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers({ ...answers, [q.id]: i })} />
                <span><strong>{String.fromCharCode(65 + i)}.</strong> <FormattedMessage content={o} inline /></span>
              </label>
            ))}
          </fieldset>
        ))}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button onClick={submit} disabled={busy || seconds === 0} className="self-start">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Submit quiz
        </Button>
      </CardContent>
    </Card>
  );
}

export default function NowSolverApplication() {
  const [app, setApp] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [agreementVersion, setAgreementVersion] = useState('');
  const [rules, setRules] = useState<QuizRules | null>(null);
  const [role, setRole] = useState('teacher');
  const [displayName, setDisplayName] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['english']);
  const [pan, setPan] = useState('');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const adopt = useCallback((next: Application | null) => {
    setApp(next);
    if (next) {
      setRole(next.role ?? 'teacher');
      setDisplayName(next.displayName);
      setSubjects(next.subjects);
      setLanguages(next.languages.length ? next.languages : ['english']);
    }
  }, []);

  const reload = useCallback(async () => {
    const res = await apiCall('/now/solver/application');
    adopt(res.application as Application | null);
    setAgreementVersion(res.agreementVersion as string);
    setRules(res.quiz as QuizRules);
  }, [adopt]);

  useEffect(() => {
    let cancelled = false;
    apiCall('/now/solver/application')
      .then((res) => {
        if (cancelled) return;
        adopt(res.application as Application | null);
        setAgreementVersion(res.agreementVersion as string);
        setRules(res.quiz as QuizRules);
        setLoaded(true);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [adopt]);

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const saveDetails = () =>
    run('save', async () => {
      const res = await apiCall('/now/solver/application', {
        method: 'PUT',
        body: JSON.stringify({ role, displayName: displayName.trim(), subjects, languages, ...(pan.trim() ? { pan: pan.trim() } : {}) }),
      });
      adopt(res.application as Application);
      setPan('');
      setNotice('Saved.');
    });

  const upload = (kind: string, file: File) =>
    run(`doc:${kind}`, async () => {
      if (!app) {
        const res = await apiCall('/now/solver/application', { method: 'PUT', body: JSON.stringify({ role, displayName, subjects, languages }) });
        adopt(res.application as Application);
      }
      const ticket = await apiCall('/now/solver/application/documents', {
        method: 'POST',
        body: JSON.stringify({ kind, mimeType: file.type, sizeBytes: file.size }),
      });
      const put = await fetch(ticket.uploadUrl as string, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
      const res = await apiCall('/now/solver/application/documents/confirm', { method: 'POST', body: JSON.stringify({ kind, objectKey: ticket.objectKey }) });
      adopt(res.application as Application);
      setNotice('Document uploaded.');
    });

  const startQuiz = (subject: string) =>
    run(`quiz:${subject}`, async () => {
      const res = await apiCall('/now/solver/quiz', { method: 'POST', body: JSON.stringify({ subject }) });
      setQuiz(res.quiz as Quiz);
    });

  const accept = () =>
    run('agreement', async () => {
      const res = await apiCall('/now/solver/application/agreement', { method: 'POST', body: JSON.stringify({ version: agreementVersion }) });
      adopt(res.application as Application);
    });

  const submit = () =>
    run('submit', async () => {
      const res = await apiCall('/now/solver/application/submit', { method: 'POST' });
      adopt(res.application as Application);
      setNotice('Submitted. Our team will review your documents and set up a short demo doubt with you.');
    });

  if (!loaded) {
    return error ? <p className="p-6 text-sm text-muted-foreground">{error}</p> : <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>;
  }

  const locked = app?.status === 'submitted' || app?.status === 'approved';
  if (quiz) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <QuizRunner quiz={quiz} onDone={(message) => { setQuiz(null); setNotice(message); void reload(); }} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">Become an Origin solver</h1>
        <p className="text-sm text-muted-foreground">
          Help students with short live audio calls and earn Ori Coins to spend in the Origin Store. Everyone is verified before their first call.
        </p>
      </header>

      {app?.status === 'approved' && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500/10 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> You are an approved solver. <Link href="/now/solver" className="underline">Open your shift</Link>
        </p>
      )}
      {app?.status === 'submitted' && <p className="rounded-lg border p-3 text-sm">Your application is under review. We will contact you for a 10-minute demo doubt.</p>}
      {app?.status === 'rejected' && <p className="rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-sm">Not approved this time: {app.rejectReason}. You can update your details and apply again.</p>}
      {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">1. About you</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="now-role">You are a</Label>
              <select id="now-role" disabled={locked} className="h-9 rounded-md border bg-background px-2" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="now-name">Name students will see</Label>
              <Input id="now-name" disabled={locked} value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Ravi K" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="text-muted-foreground">Subjects:</span>
            {SUBJECTS.map((s) => (
              <label key={s} className="flex items-center gap-1 capitalize">
                <input type="checkbox" disabled={locked} checked={subjects.includes(s)} onChange={(e) => setSubjects(e.target.checked ? [...subjects, s] : subjects.filter((x) => x !== s))} />{s}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="text-muted-foreground">Languages:</span>
            {LANGUAGES.map((l) => (
              <label key={l} className="flex items-center gap-1 capitalize">
                <input type="checkbox" disabled={locked} checked={languages.includes(l)} onChange={(e) => setLanguages(e.target.checked ? [...languages, l] : languages.filter((x) => x !== l))} />{l}
              </label>
            ))}
          </div>
          {!app?.isMinor && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="now-pan">PAN (optional) {app?.panMasked ? `(saved: ${app.panMasked})` : ''}</Label>
              <Input id="now-pan" disabled={locked} className="w-48 uppercase" value={pan} maxLength={10} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" />
              <p className="text-xs text-muted-foreground">Not required to apply. If you add it, it is stored encrypted and only the last 4 characters are ever shown.</p>
            </div>
          )}
          {!locked && (
            <Button onClick={saveDetails} disabled={busy === 'save'} className="self-start">
              {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save details
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">2. Age and guardian</CardTitle></CardHeader>
        <CardContent><GuardianConsentForm purpose="solver" onReady={() => void reload()} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">3. Documents</CardTitle>
          <CardDescription>JPG, PNG, WebP or PDF, 5 MB each. Stored privately; only Origin&apos;s review team can open them, and they are deleted if you are not approved.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {DOCS.map((d) => {
            const done = app?.documents.includes(d.id);
            return (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                <span>
                  {done ? <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" /> : null}{d.label}
                  {d.hint && <span className="block text-xs text-muted-foreground">{d.hint}</span>}
                </span>
                {!locked && (
                  <label className="flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1 hover:bg-muted">
                    {busy === `doc:${d.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                    {done ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(d.id, f); }} />
                  </label>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">4. Subject quiz</CardTitle>
          {rules && <CardDescription>{rules.questions} questions, {rules.minutes} minutes, {rules.passPercent}% to pass. One attempt per subject every 24 hours.</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {(app?.subjects ?? []).length === 0 && <p className="text-muted-foreground">Save your subjects first.</p>}
          {(app?.subjects ?? []).map((s) => {
            const score = app?.quizScores[s];
            const passed = score !== undefined && rules !== null && score >= rules.passPercent;
            return (
              <div key={s} className="flex items-center justify-between gap-2">
                <span className="capitalize">{s}: {score === undefined ? 'not taken' : `${score}%${passed ? ' — passed' : ''}`}</span>
                {!locked && !passed && (
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => startQuiz(s)}>
                    {busy === `quiz:${s}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{score === undefined ? 'Start quiz' : 'Retake'}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">5. Helper Agreement ({agreementVersion})</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>You are paid in Ori Coins per session (plus tips), spendable in the Origin Store. Origin never pays rupees and never buys coins back.</li>
            <li>Calls are audio only and recorded for safety; recordings are kept 30 days, longer if a report is open.</li>
            <li>Never ask for or share phone numbers, social media, email, school or meeting up. Students appear by first name only.</li>
            <li>Many students are under 18: be patient and professional; anything else ends your access.</li>
            <li>Accept only doubts you can solve; if you accept, join within 2 minutes.</li>
            <li>Ratings, reports and the outcome you record are reviewed; repeated problems pause your offers.</li>
          </ul>
          {app?.agreementVersion === agreementVersion ? (
            <p className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Accepted.</p>
          ) : (
            !locked && (
              <Button onClick={accept} disabled={!app || busy === 'agreement'} className="self-start">
                {busy === 'agreement' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}I agree
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {!locked && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">6. Submit</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {app && !app.readiness.ready && (
              <ul className="list-disc pl-5 text-muted-foreground">{app.readiness.missing.map((m) => <li key={m}>{m}</li>)}</ul>
            )}
            <Button onClick={submit} disabled={!app?.readiness.ready || busy === 'submit'} className="self-start">
              {busy === 'submit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Submit for review
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
