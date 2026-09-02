'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Download, Search, Eye, EyeOff, Loader2, ShieldAlert, ChevronLeft, ChevronRight, X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type {
  AttemptState, ParticipantAnswer, ParticipantRow, ParticipantsSummary,
} from '@/server/contest/contest-participants-service';

const PAGE = 50;

const ATTEMPT_LABEL: Record<AttemptState, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  auto_submitted: 'Auto-submitted',
};

const ATTEMPT_TONE: Record<AttemptState, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  submitted: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  auto_submitted: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

function secs(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function when(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ContestParticipants({ contestId, contestName }: { contestId: string; contestName: string }) {
  const [summary, setSummary] = useState<ParticipantsSummary | null>(null);
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  // filters
  const [search, setSearch] = useState('');
  const [attemptState, setAttemptState] = useState<AttemptState | 'all'>('all');
  const [regStatus, setRegStatus] = useState<'all' | 'registered' | 'waitlisted'>('all');
  const [flagged, setFlagged] = useState(false);
  const [sort, setSort] = useState('rank');
  const [reveal, setReveal] = useState(false);

  // detail drawer
  const [detail, setDetail] = useState<ParticipantRow | null>(null);
  const [answers, setAnswers] = useState<ParticipantAnswer[] | null>(null);
  const [snapshots, setSnapshots] = useState<{ r2Key: string; capturedAt: string }[]>([]);

  const query = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({
      limit: String(PAGE), offset: String(offset), sort,
      attemptState, registrationStatus: regStatus, ...extra,
    });
    if (search.trim()) p.set('search', search.trim());
    if (flagged) p.set('flagged', '1');
    if (reveal) p.set('reveal', '1');
    return p.toString();
  }, [offset, sort, attemptState, regStatus, search, flagged, reveal]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contest/${contestId}/participants?${query()}`, { credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as { summary?: ParticipantsSummary; rows?: ParticipantRow[]; total?: number };
      setSummary(body.summary ?? null);
      setRows(body.rows ?? []);
      setTotal(body.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [contestId, query]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (r: ParticipantRow) => {
    setDetail(r); setAnswers(null); setSnapshots([]);
    try {
      const res = await fetch(`/api/admin/contest/${contestId}/participants?userId=${encodeURIComponent(r.userId)}`, { credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as { answers?: ParticipantAnswer[]; snapshots?: { r2Key: string; capturedAt: string }[] };
      setAnswers(body.answers ?? []);
      setSnapshots(body.snapshots ?? []);
    } catch {
      setAnswers([]);
    }
  };

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">Participants</h1>
          <p className="text-sm text-muted-foreground truncate">{contestName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border/50 px-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {reveal ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
            {reveal ? 'Hide numbers' : 'Reveal numbers'}
          </button>
          <a
            href={`/api/admin/contest/${contestId}/participants?${query({ format: 'csv' })}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border/50 px-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
          </a>
          <Link
            href="/admin/contest"
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Contests
          </Link>
        </div>
      </header>

      {/* PII notice — most Origin students are minors. */}
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
        This view contains student personal data. Access and exports are audit-logged. Phone numbers are masked by default.
      </p>

      {/* ── Funnel summary ─────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Registered" value={summary.registered} />
          <Stat label="Waitlisted" value={summary.waitlisted} />
          <Stat label="Started" value={summary.started} sub={summary.registered ? `${Math.round((summary.started / summary.registered) * 100)}%` : undefined} />
          <Stat label="Submitted" value={summary.submitted} sub={summary.started ? `${Math.round((summary.submitted / summary.started) * 100)}%` : undefined} />
          <Stat label="No-shows" value={summary.noShows} />
          <Stat label="Drop-offs" value={summary.dropOffs} />
          <Stat label="Avg score" value={summary.avgScore ?? '—'} />
          <Stat label="Median" value={summary.medianScore ?? '—'} />
          <Stat label="Top score" value={summary.topScore ?? '—'} />
          <Stat label="Avg time" value={secs(summary.avgTimeSeconds)} />
          <Stat label="Flagged" value={summary.flagged} tone={summary.flagged > 0 ? 'text-rose-500' : undefined} />
          <Stat label="Ineligible" value={summary.ineligible} tone={summary.ineligible > 0 ? 'text-rose-500' : undefined} />
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search participants by name or email</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            placeholder="Search name or email…"
            className="min-h-11 w-56 rounded-lg border border-border/50 bg-background pl-8 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <Select label="Attempt" value={attemptState} onChange={(v) => { setAttemptState(v as AttemptState | 'all'); setOffset(0); }}
          options={[['all', 'All attempts'], ['not_started', 'Not started'], ['in_progress', 'In progress'], ['submitted', 'Submitted'], ['auto_submitted', 'Auto-submitted']]} />
        <Select label="Registration" value={regStatus} onChange={(v) => { setRegStatus(v as typeof regStatus); setOffset(0); }}
          options={[['all', 'All registrations'], ['registered', 'Registered'], ['waitlisted', 'Waitlisted']]} />
        <Select label="Sort" value={sort} onChange={(v) => { setSort(v); setOffset(0); }}
          options={[['rank', 'Rank'], ['score', 'Score'], ['name', 'Name'], ['registered', 'Registered'], ['time', 'Time taken'], ['violations', 'Violations']]} />
        <button
          type="button"
          onClick={() => { setFlagged((v) => !v); setOffset(0); }}
          aria-pressed={flagged}
          className={cn(
            'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            flagged ? 'bg-rose-500 text-white' : 'border border-border/50 text-foreground hover:bg-muted',
          )}
        >
          <ShieldAlert className="w-4 h-4" aria-hidden="true" /> Flagged only
        </button>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {loading ? 'Loading…' : `${total} participant${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>#</Th><Th>Participant</Th><Th>Registered</Th><Th>Attempt</Th>
              <Th align="right">Score</Th><Th align="right">Acc.</Th><Th align="right">Time</Th>
              <Th align="right">%ile</Th><Th align="right">Viol.</Th><Th>ORBIT</Th><Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                No participants match this filter.
              </td></tr>
            ) : rows.map((r) => (
              <tr key={r.userId} className={cn('border-t border-border/30 align-top', !r.eligible && 'opacity-60')}>
                <td className="px-3 py-2 font-mono text-muted-foreground tabular-nums">{r.rank ?? '—'}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    {r.name ?? 'Unnamed'}
                    {r.isPremium && <span className="rounded bg-amber-500/15 px-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">PRO</span>}
                    {!r.eligible && <span className="rounded bg-rose-500/15 px-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">INELIGIBLE</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground break-all">{r.email ?? '—'}</div>
                  {r.mobile && <div className="text-[11px] text-muted-foreground tabular-nums">{r.mobile}</div>}
                  {r.teamName && <div className="text-[11px] text-muted-foreground">Team: {r.teamName}</div>}
                </td>
                <td className="px-3 py-2 text-[11px] text-muted-foreground">
                  {when(r.registeredAt)}
                  {r.registrationStatus === 'waitlisted' && (
                    <div className="mt-0.5 inline-block rounded bg-amber-500/15 px-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">WAITLIST</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', ATTEMPT_TONE[r.attemptState])}>
                    {ATTEMPT_LABEL[r.attemptState]}
                  </span>
                  {r.finishedAt && <div className="mt-0.5 text-[10px] text-muted-foreground">{when(r.finishedAt)}</div>}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{r.score ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.accuracyPct == null ? '—' : `${r.accuracyPct}%`}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{secs(r.timeTakenSeconds)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.percentile ?? '—'}</td>
                <td className={cn('px-3 py-2 text-right tabular-nums', r.violationCount > 0 ? 'font-bold text-rose-500' : 'text-muted-foreground')}>
                  {r.violationCount}
                  {r.reviewStatus !== 'none' && <div className="text-[10px] font-normal">{r.reviewStatus}</div>}
                </td>
                <td className="px-3 py-2 text-[11px] tabular-nums">
                  {r.ratingChange == null ? '—' : (
                    <span className={r.ratingChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                      {r.ratingChange >= 0 ? '+' : ''}{Math.round(r.ratingChange)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void openDetail(r)}
                    className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-bold text-primary transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-border/50 text-foreground transition-colors duration-200 hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Previous page</span>
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-border/50 text-foreground transition-colors duration-200 hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronRight className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Next page</span>
          </button>
        </div>
      )}

      {/* ── Detail drawer ──────────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal="true" aria-label="Participant detail">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground">{detail.name ?? 'Unnamed'}</h2>
                <p className="text-sm text-muted-foreground break-all">{detail.email}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Close"
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <Stat label="Score" value={detail.score ?? '—'} />
              <Stat label="Rank" value={detail.rank ?? '—'} />
              <Stat label="Time" value={secs(detail.timeTakenSeconds)} />
            </div>

            {detail.sectionScores && Object.keys(detail.sectionScores).length > 0 && (
              <div className="mb-4 rounded-xl border border-border/40 p-3">
                <h3 className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Subject-wise</h3>
                {Object.entries(detail.sectionScores as Record<string, { score?: number; correct?: number; total?: number }>).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-foreground">{k}</span>
                    <span className="tabular-nums text-muted-foreground">{v.score ?? 0} · {v.correct ?? 0}/{v.total ?? 0}</span>
                  </div>
                ))}
              </div>
            )}

            {snapshots.length > 0 && (
              <div className="mb-4 rounded-xl border border-border/40 p-3">
                <h3 className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  Proctoring snapshots ({snapshots.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Captured frames are stored in R2. Keys: {snapshots.slice(0, 3).map((s) => s.r2Key.split('/').pop()).join(', ')}
                  {snapshots.length > 3 ? ` +${snapshots.length - 3} more` : ''}
                </p>
              </div>
            )}

            <h3 className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Question-by-question</h3>
            {answers === null ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading responses…
              </div>
            ) : answers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submitted responses (they did not finish this contest).</p>
            ) : (
              <ol className="space-y-2">
                {answers.map((a) => (
                  <li key={a.position} className="rounded-lg border border-border/30 p-2.5 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                        Q{a.position + 1}{a.subject ? ` · ${a.subject}` : ''}
                      </span>
                      <span className={cn('text-[11px] font-bold', a.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : a.isCorrect === false ? 'text-rose-500' : 'text-muted-foreground')}>
                        {a.isCorrect ? 'Correct' : a.isCorrect === false ? 'Wrong' : 'Skipped'} · {a.marksAwarded ?? 0}
                        {a.timeSpentSeconds != null && ` · ${a.timeSpentSeconds}s`}
                      </span>
                    </div>
                    <p className="mb-1 text-foreground line-clamp-2">{a.text}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Answered: <strong>{a.submittedOption != null ? String.fromCharCode(65 + a.submittedOption) : a.submittedText ?? '—'}</strong>
                      {' · '}Correct: <strong>{a.correctOption != null ? String.fromCharCode(65 + a.correctOption) : '—'}</strong>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border/40 px-3 py-2">
      <div className={cn('text-lg font-black tabular-nums text-foreground', tone)}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return <th scope="col" className={cn('px-3 py-2', align === 'right' ? 'text-right' : 'text-left')}>{children}</th>;
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 cursor-pointer rounded-lg border border-border/50 bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
