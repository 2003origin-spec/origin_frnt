'use client';

import { ChevronDown, CircleCheck, ShieldCheck, Target, TrendingDown, TrendingUp } from 'lucide-react';

import { BAND_LABEL, BODY_LABEL, INSTITUTE_TYPE_LABEL, formatRank, genderPoolLabel } from '@/lib/counselling/format';
import type { ChanceBand, CounsellingResultRow, InstituteType } from '@/lib/counselling/types';

/** Band colours: tinted chip + icon + word, never colour alone (contrast ≥ 4.5:1 in both themes). */
export const BAND_STYLE: Record<ChanceBand, string> = {
  safe: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  likely: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  reach: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200',
};

export const BAND_ICON = { safe: ShieldCheck, likely: CircleCheck, reach: Target } as const;

export function BandChip({ band }: { band: ChanceBand }) {
  const Icon = BAND_ICON[band];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${BAND_STYLE[band]}`}>
      <Icon aria-hidden className="size-3.5" />
      {BAND_LABEL[band]}
    </span>
  );
}

/** "Round 3" → "R3"; other labels ("Mop-up", "Final …") stay as they are, shortened. */
function shortRound(label: string): string {
  const m = /^Round (\d+)/u.exec(label);
  if (m) return `R${m[1]}`;
  return label.length > 18 ? `${label.slice(0, 16)}…` : label;
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-foreground">{children}</span>;
}

export default function ResultRow({ row }: { row: CounsellingResultRow }) {
  const typeLabel = INSTITUTE_TYPE_LABEL[row.instituteType as InstituteType] ?? row.instituteType;
  const opened = row.openedInRound;
  const TrendIcon = row.trend?.includes('rose') ? TrendingUp : TrendingDown;
  return (
    <li className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-[15px] font-semibold leading-snug text-foreground">{row.institute}</h3>
          <p className="text-[14px] text-foreground">{row.program}</p>
          <p className="text-[13px] text-muted-foreground">
            {typeLabel}
            {row.state ? ` · ${row.state}` : ''} · {BODY_LABEL[row.body]} {row.year}
          </p>
        </div>
        <BandChip band={row.band} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Tag>{row.quotaLabel === row.quota ? row.quota : `${row.quotaLabel} (${row.quota})`}</Tag>
        <Tag>
          {row.seatType}
          {row.pwd ? ' · PwD' : ''}
        </Tag>
        <Tag>{genderPoolLabel(row)}</Tag>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-[12px] bg-surface-2 px-4 py-3">
        <div className="flex flex-col">
          <dt className="text-[12px] text-muted-foreground">Closing rank, last round</dt>
          <dd className="font-display text-[22px] font-bold leading-tight tabular-nums text-foreground">{formatRank(row.finalClosing, row.finalClosingPrep)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[12px] text-muted-foreground">Your {row.rankUsedLabel}</dt>
          <dd className="font-display text-[22px] font-bold leading-tight tabular-nums text-foreground">
            {row.rankUsedRange.low === row.rankUsedRange.high
              ? formatRank(row.rankUsed)
              : `${formatRank(row.rankUsedRange.low)} – ${formatRank(row.rankUsedRange.high)}`}
          </dd>
        </div>
      </dl>

      {row.rounds.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">Closing rank in each round</span>
          <ol className="flex flex-wrap gap-1.5">
            {row.rounds.map((r) => {
              const isOpened = opened?.round === r.round;
              return (
                <li
                  key={r.round}
                  aria-label={`${r.label}: closing rank ${formatRank(r.closing, r.closingPrep)}${isOpened ? ', opened for your rank here' : ''}`}
                  className={`rounded-[10px] px-2.5 py-1 text-[12px] tabular-nums ${
                    isOpened ? 'bg-primary/15 font-semibold text-foreground ring-1 ring-primary' : 'bg-surface-2 text-foreground'
                  }`}
                >
                  <span className="text-muted-foreground">{shortRound(r.label)}</span> {formatRank(r.closing, r.closingPrep)}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      <p className="text-[13px] text-foreground">
        {opened
          ? row.rounds.length > 1
            ? `Would have opened for your rank in ${opened.label}.`
            : `Your rank was inside the closing rank (${opened.label}).`
          : 'Closed just before your rank in every round: a reach.'}
      </p>

      {row.trend || row.expectedNextYear ? (
        <div className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {row.trend ? (
            <span className="inline-flex items-center gap-1.5">
              <TrendIcon aria-hidden className="size-4 shrink-0" /> Closing rank {row.trend.replace(/^closing rank /u, '')}.
            </span>
          ) : null}
          {row.expectedNextYear ? <span>{row.expectedNextYear}. A hint only, not part of the chance.</span> : null}
        </div>
      ) : null}

      {row.notes.length ? (
        <details className="group text-[13px] text-muted-foreground">
          <summary className="inline-flex min-h-12 cursor-pointer list-none items-center gap-1 rounded-full font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            About this number <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="list-disc space-y-1 pl-5">
            {row.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
