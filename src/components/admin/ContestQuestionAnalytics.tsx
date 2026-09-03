'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import type { QuestionAnalyticsRow } from '@/server/contest/contest-analytics-service';

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

/** Colour a %-correct: red (too hard) → amber → green (easy). */
function difficultyTone(p: number | null): string {
  if (p == null) return 'text-muted-foreground';
  if (p < 0.3) return 'text-rose-500';
  if (p < 0.7) return 'text-amber-500';
  return 'text-emerald-500';
}

export function ContestQuestionAnalytics({ contestId, rows }: { contestId: string; rows: QuestionAnalyticsRow[] }) {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Per-question analytics</h1>
          <p className="text-sm text-muted-foreground">%-correct, mean time, discrimination & option spread.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/admin/contest/${contestId}/analytics?format=csv`}
            className="rounded-lg border border-border/50 px-3 py-1.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Export CSV
          </a>
          <Link href="/admin/contest" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"><ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Contests</Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attempts yet — analytics appear once students submit.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Subject · Chapter</th>
                <th className="px-3 py-2 text-right">Attempted</th>
                <th className="px-3 py-2 text-right">% correct</th>
                <th className="px-3 py-2 text-right">Avg time</th>
                <th className="px-3 py-2 text-right" title="Top-third minus bottom-third correctness (higher = better discriminator)">Discrim.</th>
                <th className="px-3 py-2 text-left">Options</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.position} className="border-t border-border/30 align-top">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.position + 1}</td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{r.subject ?? '—'}{r.chapter ? ` · ${r.chapter}` : ''}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[22ch]">{r.text}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.attempted}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${difficultyTone(r.percentCorrect)}`}>{pct(r.percentCorrect)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.avgTimeSeconds == null ? '—' : `${r.avgTimeSeconds}s`}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.discrimination == null ? '—' : r.discrimination.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.optionCounts.map((c, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {String.fromCharCode(65 + i)}:{c}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
