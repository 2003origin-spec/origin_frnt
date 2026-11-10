'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDot, ExternalLink, Info, LogIn } from 'lucide-react';

import {
  NOT_ENOUGH_DATA,
  QUALITY_LABEL,
  formatPercentileRange,
  formatRankRange,
  spokenRange,
} from '@/lib/rank-predictor/format';
import type { Quality, RankBand } from '@/lib/rank-predictor/types';

import type { PredictionResponse } from './api';
import { LOGIN_HREF } from './login-links';

const QUALITY_STYLE: Record<Quality, string> = {
  good_estimate: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  estimate: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200',
  rough: 'bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-200',
};

/** 93.4123549 → "93.41"; a tiny PwD cut-off such as 0.0023186 → "0.0023" (never "0.00"). */
function formatCutoff(value: number): string {
  return value >= 1 ? value.toFixed(2) : String(Number(value.toPrecision(2)));
}

function QualityChip({ quality }: { quality: Quality }) {
  const Icon = quality === 'good_estimate' ? CheckCircle2 : quality === 'estimate' ? CircleDot : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${QUALITY_STYLE[quality]}`}>
      <Icon aria-hidden className="size-3.5" />
      {QUALITY_LABEL[quality]}
    </span>
  );
}

function RankRow({ title, band, status }: { title: string; band: RankBand | null; status?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[12px] bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{band?.label ?? title}</span>
        {band ? <QualityChip quality={band.quality} /> : null}
      </div>
      {band ? (
        <>
          <span className="font-display text-[27px] font-bold leading-tight tabular-nums text-foreground" aria-label={spokenRange(band.label ?? title, band, band.quality)}>
            {formatRankRange(band)}
          </span>
          {band.notEnoughData ? <span className="text-[13px] text-muted-foreground">{NOT_ENOUGH_DATA}</span> : null}
        </>
      ) : (
        <span className="text-[14px] text-foreground">{status}</span>
      )}
    </div>
  );
}

function ComingSoon() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-foreground">Coming soon</span>
      <span className="text-[13px] text-muted-foreground">No official state-wise data for JEE yet.</span>
    </span>
  );
}

export default function ResultCard({
  response,
  examLabel,
  whatIfDelta,
  onWhatIf,
  signedIn,
  onLoginForColleges,
}: {
  response: PredictionResponse;
  examLabel: string;
  whatIfDelta: number | null;
  onWhatIf: (delta: number) => void;
  signedIn: boolean;
  /** Visitors: keep the form before going to log in. */
  onLoginForColleges: () => void;
}) {
  const p = response.prediction;
  const airTitle = p.exam === 'jee-advanced' ? 'Common rank list (CRL)' : 'All India rank';
  // Answered in the same response, so a chip never uses up a free check.
  const whatIf = whatIfDelta === null ? null : (response.whatIf ?? []).find((w) => w.delta === whatIfDelta) ?? null;
  const rankWord = p.exam === 'jee-advanced' ? 'CRL' : 'AIR';
  const whatIfText = !whatIf
    ? null
    : whatIf.added === 0
      ? 'You are already at full marks.'
      : whatIf.air
        ? `With +${whatIf.added} marks: ${rankWord} ${formatRankRange(whatIf.air)}`
        : `With +${whatIf.added} marks: still not on the rank list.`;

  return (
    <section aria-labelledby="rp-result-heading" className="flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="rp-result-heading" className="font-display text-[21px] font-bold text-foreground">
          Your {examLabel} prediction
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Total {p.total} marks{p.marksUsed.low !== p.marksUsed.high ? ` (looked up ${Math.round(p.marksUsed.low)}–${Math.round(p.marksUsed.high)})` : ''}
        </p>
      </div>

      {/* Headline: AIR / CRL range */}
      <div className="flex flex-col gap-2 rounded-[18px] bg-surface-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[14px] font-medium text-muted-foreground">{airTitle}</span>
          {p.air ? <QualityChip quality={p.air.quality} /> : null}
        </div>
        {p.air ? (
          <>
            <p className="font-display text-[40px] font-extrabold leading-none tabular-nums text-foreground sm:text-[52px]" aria-label={spokenRange(airTitle, p.air, p.air.quality)}>
              {formatRankRange(p.air)}
            </p>
            {p.topText ? <p className="text-[14px] font-semibold text-primary">{p.topText}</p> : null}
            {p.air.notEnoughData ? <p className="text-[13px] text-muted-foreground">{NOT_ENOUGH_DATA}</p> : null}
          </>
        ) : (
          <p className="text-[15px] text-foreground">Not on the rank list with these marks in recent years.</p>
        )}
        {p.percentile ? (
          <p className="text-[14px] text-foreground">
            Percentile <span className="font-semibold tabular-nums">{formatPercentileRange(p.percentile)}</span>
          </p>
        ) : null}
      </div>

      {/* Category / PwD / state */}
      <div className="grid gap-3 sm:grid-cols-2">
        {p.categoryRank ? <RankRow title="Category rank" band={p.categoryRank} /> : null}
        {p.pwdRank ? <RankRow title="PwD rank" band={p.pwdRank} /> : null}
        {p.stateRankStatus === 'coming_soon' ? (
          <RankRow title="State rank" band={null} status={<ComingSoon />} />
        ) : p.stateRankStatus === 'ok' ? (
          <RankRow title="State rank" band={p.stateRank} />
        ) : p.stateRankStatus === 'not_available' ? (
          <RankRow title="State rank" band={null} status="Not available for your state yet (we only use official state lists)." />
        ) : (
          <RankRow title="State rank" band={null} status="Pick your home state to see a state rank." />
        )}
      </div>

      {/* Eligibility / qualifying */}
      {p.eligibility || p.qualifying ? (
        <ul className="flex flex-col gap-2" aria-label="Cut-off checks">
          {p.eligibility ? (
            <li className="flex items-start gap-2 text-[14px] text-foreground">
              {p.eligibility.status === 'likely' ? (
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <span>
                JEE Advanced:{' '}
                <strong>
                  {p.eligibility.status === 'likely' ? 'Likely eligible' : p.eligibility.status === 'borderline' ? 'Borderline' : 'Not eligible this year'}
                </strong>{' '}
                (the {p.eligibility.year} cut-off was {formatCutoff(p.eligibility.cutoff)} percentile)
              </span>
            </li>
          ) : null}
          {p.qualifying ? (
            <li className="flex items-start gap-2 text-[14px] text-foreground">
              {p.qualifying.status === 'qualifies' ? (
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <span>
                {p.qualifying.summary}{' '}
                <span className="text-muted-foreground">
                  ({p.qualifying.years.map((y) => `${y.year}: ${y.minMarks}`).join(', ')})
                </span>
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* What if */}
      {response.whatIf?.length ? (
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">What if you score more?</span>
        <div className="flex flex-wrap gap-2">
          {[10, 20].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => onWhatIf(delta)}
              aria-pressed={whatIfDelta === delta}
              className={`min-h-12 cursor-pointer rounded-full border px-5 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                whatIfDelta === delta ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-foreground hover:bg-surface-2'
              }`}
            >
              +{delta} marks
            </button>
          ))}
        </div>
        <p className="min-h-5 text-[14px] text-foreground" aria-live="polite">
          {whatIfText}
        </p>
      </div>
      ) : null}

      {/* What changed the range */}
      <details className="group rounded-[12px] border border-border">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[14px] font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          What changed the range
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="flex flex-col gap-3 px-4 pb-4 text-[14px] leading-relaxed text-foreground">
          {p.spread.map((line) => (
            <p key={line.label}>
              <span className="font-semibold">{line.label}: </span>
              {line.text}
            </p>
          ))}
          <p className="text-muted-foreground">{p.tieBreakNote}</p>
          {p.notes.length ? (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {p.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>

      {signedIn ? (
        <p className="flex items-start gap-2 rounded-[12px] bg-surface-2 px-4 py-3 text-[13px] text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>College finder for this rank is coming soon.</span>
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-[12px] bg-surface-2 px-4 py-3">
          <Link
            href={LOGIN_HREF}
            onClick={onLoginForColleges}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-[15px] font-semibold text-foreground hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <LogIn aria-hidden className="size-4" /> Log in to see colleges you could get
          </Link>
          <span className="text-center text-[13px] text-muted-foreground">The college finder is coming soon, free with an Origin account.</span>
        </div>
      )}

      {/* Sources + checked date + disclaimer: always under every result (T5.6) */}
      <footer className="flex flex-col gap-2 border-t border-border pt-3 text-[13px] leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Data: </span>
          {response.sources.map((s, i) => (
            <span key={`${s.publisher}-${s.url}`}>
              {i > 0 ? ' · ' : ''}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-0.5 underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                {s.publisher}
                {s.official ? ' (official)' : ' (anchor points)'}
                <ExternalLink aria-hidden className="size-3" />
              </a>
            </span>
          ))}{' '}
          · checked {response.checkedOn}
        </p>
        <p>{response.disclaimer}</p>
      </footer>
    </section>
  );
}

