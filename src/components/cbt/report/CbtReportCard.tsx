"use client";

/**
 * The CBT participant report card.
 *
 * Read by a student on their phone, minutes after a test, and printed by their
 * parents. So: one column under `sm`, every wide element scrolls inside its own
 * container (the page body never scrolls sideways), and every colour that
 * carries meaning is paired with an icon and a label.
 *
 * Deliberately NOT here: DPPs, recommendations, "practice this next", or any
 * link into the authenticated Origin app. This surface is public and anonymous;
 * it reports the paper the student sat and nothing else.
 */

import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LatexRenderer } from "@/components/ui/LatexRenderer";
import type { CbtReportCard as CbtReportCardData, CbtReportQuestion } from "@/server/cbt/cbt-report-service";

import { CbtReportDownloadButton } from "./CbtReportDownloadButton";
import { VERDICTS, VERDICT_ORDER, formatDuration, scoreBand, type CbtReportVerdictKey } from "./report-visuals";

type LogTab = CbtReportVerdictKey | "all";

export function CbtReportCard({ report }: { report: CbtReportCardData }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<LogTab>("wrong");
  const [expanded, setExpanded] = useState<number | null>(null);

  const band = scoreBand(report.totals.percentage);

  const distribution = useMemo(
    () =>
      VERDICT_ORDER.map((key) => ({
        key,
        name: VERDICTS[key].label,
        value:
          key === "correct"
            ? report.totals.correct
            : key === "wrong"
              ? report.totals.wrong
              : key === "skipped"
                ? report.totals.skipped
                : report.totals.needsReview,
      })).filter((d) => d.value > 0),
    [report.totals],
  );

  const sectionData = useMemo(
    () =>
      report.sections.map((s) => ({
        name: s.label,
        score: s.score,
        maxScore: s.maxScore,
        accuracy: s.accuracy,
        timeSeconds: s.timeSeconds,
      })),
    [report.sections],
  );

  const timingData = useMemo(
    () =>
      report.questions.map((q) => ({
        name: `Q${q.position + 1}`,
        seconds: q.timeSeconds,
        verdict: q.verdict,
      })),
    [report.questions],
  );

  const logQuestions = useMemo(
    () => (tab === "all" ? report.questions : report.questions.filter((q) => q.verdict === tab)),
    [report.questions, tab],
  );

  return (
    <div className="cbt-report-page mx-auto w-full max-w-4xl space-y-4 px-3 py-5 sm:px-5 sm:py-8">
      <div className="flex justify-end print:hidden">
        <CbtReportDownloadButton targetRef={printRef} report={report} />
      </div>

      <div ref={printRef} className="space-y-4">
        <ReportHeader report={report} />

        {/* Hero: the one number the student came for. */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your score</p>
              <p className="mt-1 flex items-baseline justify-center gap-1 sm:justify-start">
                <span className="text-5xl font-black tabular-nums text-foreground">{report.totals.score}</span>
                <span className="text-xl font-semibold text-muted-foreground">/ {report.totals.maxScore}</span>
              </p>
              <p className={`mt-1 text-sm font-bold ${band.tone}`}>
                {report.totals.percentage}% · {band.label}
              </p>
            </div>
            <dl className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4">
              <Stat label="Rank" value={report.totals.rank ? `#${report.totals.rank}` : "—"}
                hint={report.totals.totalParticipants ? `of ${report.totals.totalParticipants}` : undefined} />
              <Stat label="Accuracy" value={`${report.totals.accuracy}%`} hint="of attempted" />
              <Stat label="Attempted" value={`${report.totals.attempted}`} hint={`of ${report.totals.totalQuestions}`} />
              <Stat label="Time" value={formatDuration(report.totals.timeTakenSeconds)} hint="on the paper" />
            </dl>
          </div>
          {report.totals.autoSubmitted ? (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              This paper was submitted automatically
              {report.totals.finalizeReason === "timer" ? " when the time ran out." : "."}
            </p>
          ) : null}
          {report.totals.needsReview > 0 ? (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {report.totals.needsReview} answer{report.totals.needsReview === 1 ? "" : "s"} still need your
              teacher&apos;s review, so your score may change.
            </p>
          ) : null}
        </section>

        {/* Distribution. ≤4 classes, part-to-whole at a glance — every slice
            carries its icon + label, because the status red/green pair is not
            separable by colour alone under CVD. */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <SectionTitle>How your attempt breaks down</SectionTitle>
          <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-48 w-full max-w-[14rem] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {distribution.map((d) => (
                      <Cell key={d.key} fill={VERDICTS[d.key].color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${numberOf(value)} questions`, String(name ?? "")]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grid w-full grid-cols-2 gap-2 sm:grid-cols-1">
              {VERDICT_ORDER.map((key) => {
                const v = VERDICTS[key];
                const count = distribution.find((d) => d.key === key)?.value ?? 0;
                return (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                      style={{ backgroundColor: v.color }}
                    >
                      {v.glyph}
                    </span>
                    <span className="flex-1 text-muted-foreground">{v.label}</span>
                    <span className="font-bold tabular-nums text-foreground">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Sectional marking. Single series, one hue — the max is a track, not a
            second series, so there is only ever one scale on the axis. */}
        {sectionData.length > 0 ? (
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <SectionTitle>Marks by section</SectionTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Each subject on the paper, scored separately.
            </p>
            <div className="mt-3 overflow-x-auto">
              <div style={{ minWidth: Math.max(320, sectionData.length * 90) }} className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectionData} margin={{ top: 16, right: 8, bottom: 4, left: -18 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                    <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} />
                    <Tooltip
                      cursor={{ fill: "currentColor", opacity: 0.06 }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value, _name, item) => [
                        `${numberOf(value)} / ${payloadOf<{ maxScore?: number }>(item)?.maxScore ?? 0}`,
                        "Marks",
                      ]}
                    />
                    <Bar
                      dataKey="score"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* The table view — also the accessible fallback for both charts. */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-xs">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-2 font-medium">Section</th>
                    <th className="py-2 px-2 text-right font-medium">Marks</th>
                    <th className="py-2 px-2 text-right font-medium">Correct</th>
                    <th className="py-2 px-2 text-right font-medium">Wrong</th>
                    <th className="py-2 px-2 text-right font-medium">Skipped</th>
                    <th className="py-2 px-2 text-right font-medium">Accuracy</th>
                    <th className="py-2 pl-2 text-right font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sections.map((s) => (
                    <tr key={s.key} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium capitalize text-foreground">{s.label}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        <b>{s.score}</b>
                        <span className="text-muted-foreground"> / {s.maxScore}</span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.correct}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.wrong}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.skipped}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.accuracy}%</td>
                      <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">
                        {report.timing.available ? formatDuration(s.timeSeconds) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Time analysis. Bars are coloured by verdict — that IS a status
            meaning ("you spent 4 minutes on one you got wrong"), and the legend
            above carries the icon + label for each. */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <SectionTitle>Time per question</SectionTitle>
          {report.timing.available ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDuration(report.timing.accountedSeconds)} accounted across{" "}
                {report.totals.totalQuestions} questions · {formatDuration(report.timing.averageSeconds)} average
                {report.timing.slowest
                  ? ` · longest on Q${report.timing.slowest.position + 1} (${formatDuration(report.timing.slowest.seconds)})`
                  : ""}
              </p>
              <ul className="mt-2 flex flex-wrap gap-3">
                {VERDICT_ORDER.map((key) => (
                  <li key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      aria-hidden
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-[9px] font-black text-white"
                      style={{ backgroundColor: VERDICTS[key].color }}
                    >
                      {VERDICTS[key].glyph}
                    </span>
                    {VERDICTS[key].label}
                  </li>
                ))}
              </ul>
              <div className="mt-3 overflow-x-auto">
                {/* A fixed bar width that scrolls beats squashing 90 bars into
                    360px — on a phone the latter is an unreadable smear. */}
                <div style={{ minWidth: Math.max(320, timingData.length * 22) }} className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timingData} margin={{ top: 12, right: 8, bottom: 4, left: -18 }}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={AXIS_TICK} interval="preserveStartEnd" />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={AXIS_TICK}
                        width={44}
                        tickFormatter={(v: number) => `${Math.round(v / 60)}m`}
                      />
                      <Tooltip
                        cursor={{ fill: "currentColor", opacity: 0.06 }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, _name, item) => [
                          formatDuration(numberOf(value)),
                          VERDICTS[payloadOf<{ verdict?: CbtReportVerdictKey }>(item)?.verdict ?? "skipped"].label,
                        ]}
                      />
                      <ReferenceLine
                        y={report.timing.averageSeconds}
                        stroke="currentColor"
                        strokeDasharray="4 4"
                        opacity={0.35}
                      />
                      <Bar dataKey="seconds" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        {timingData.map((d, i) => (
                          <Cell key={i} fill={VERDICTS[d.verdict as CbtReportVerdictKey].color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Per-question timing wasn&apos;t recorded for this attempt. Everything else in this report is
              complete.
            </p>
          )}
        </section>

        {/* Logs + the full answer sheet. */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <SectionTitle>Your answers</SectionTitle>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["wrong", "correct", "skipped", "review", "all"] as LogTab[]).map((key) => {
              const count =
                key === "all"
                  ? report.questions.length
                  : report.questions.filter((q) => q.verdict === key).length;
              if (key !== "all" && count === 0) return null;
              const label = key === "all" ? "Full answer sheet" : VERDICTS[key].label;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {logQuestions.length === 0 ? (
            <p className="mt-4 rounded-lg bg-muted px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing here — nice.
            </p>
          ) : (
            <ul className="mt-3 divide-y rounded-xl border">
              {logQuestions.map((q) => (
                <QuestionRow
                  key={q.position}
                  question={q}
                  showSection={report.sections.length > 0}
                  showTime={report.timing.available}
                  open={expanded === q.position}
                  onToggle={() => setExpanded(expanded === q.position ? null : q.position)}
                />
              ))}
            </ul>
          )}
        </section>

        <ReportFooter />
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

const AXIS_TICK = { fontSize: 10, fill: "currentColor", opacity: 0.6 } as const;

/** Recharts hands tooltip formatters a loose value/entry; narrow them once. */
function numberOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function payloadOf<T>(item: unknown): T | undefined {
  return (item as { payload?: T } | undefined)?.payload;
}

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
} as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-foreground">{children}</h2>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2 text-center sm:text-left">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-lg font-black tabular-nums text-foreground">{value}</dd>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ReportHeader({ report }: { report: CbtReportCardData }) {
  const date = report.test.date ? new Date(report.test.date) : null;
  return (
    <header className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {report.institute.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.institute.logo}
              alt={report.institute.name ?? "Institute"}
              crossOrigin="anonymous"
              className="h-11 w-11 shrink-0 rounded-xl object-contain"
            />
          ) : null}
          <div className="min-w-0">
            {report.institute.name ? (
              <p className="truncate text-xs font-bold text-muted-foreground">{report.institute.name}</p>
            ) : null}
            <h1 className="truncate text-lg font-black tracking-tight text-foreground">{report.test.title}</h1>
            {date ? (
              <p className="text-xs text-muted-foreground">
                {date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">{report.student.displayName}</p>
          <p className="font-mono text-xs tracking-widest text-muted-foreground">{report.student.studentCode}</p>
        </div>
      </div>
    </header>
  );
}

function QuestionRow({
  question,
  showSection,
  showTime,
  open,
  onToggle,
}: {
  question: CbtReportQuestion;
  showSection: boolean;
  showTime: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const v = VERDICTS[question.verdict];
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span
          aria-hidden
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
          style={{ backgroundColor: v.color }}
        >
          {v.glyph}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground">Q{question.position + 1}</span>
            <span className={`rounded-full px-1.5 py-0.5 font-medium ${v.chip}`}>{v.label}</span>
            {showSection ? <span className="capitalize">{question.sectionLabel}</span> : null}
            {showTime && question.timeSeconds > 0 ? <span>{formatDuration(question.timeSeconds)}</span> : null}
          </span>
          <span className="mt-1 line-clamp-2 block text-xs text-foreground">
            <LatexRenderer content={question.stem} />
          </span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums">
          <span className="font-bold text-foreground">
            {question.marksAwarded > 0 ? `+${question.marksAwarded}` : question.marksAwarded}
          </span>
          <span className="block text-[10px] text-muted-foreground">of {question.marks}</span>
        </span>
      </button>

      {open ? (
        <div className="space-y-2 border-t bg-muted/20 px-3 py-3 text-xs">
          {question.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={question.image}
              alt=""
              crossOrigin="anonymous"
              className="max-h-56 w-auto max-w-full rounded-lg border"
            />
          ) : null}
          <div className="text-foreground">
            <LatexRenderer content={question.stem} />
          </div>
          {question.options.length > 0 ? (
            <ol className="space-y-1 text-muted-foreground">
              {question.options.map((opt, i) => (
                <li key={i}>
                  <span className="font-bold">{String.fromCharCode(65 + i)}.</span>{" "}
                  <LatexRenderer content={opt} />
                </li>
              ))}
            </ol>
          ) : null}
          <dl className="grid gap-1.5 sm:grid-cols-2">
            <div className="rounded-lg bg-background px-2.5 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your answer</dt>
              <dd className="text-foreground">
                {question.yourAnswer ? <LatexRenderer content={question.yourAnswer} /> : "Not answered"}
              </dd>
            </div>
            <div className="rounded-lg bg-background px-2.5 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Correct answer
              </dt>
              <dd className="text-foreground">
                {question.correctAnswer ? <LatexRenderer content={question.correctAnswer} /> : "—"}
              </dd>
            </div>
          </dl>
          {question.explanation ? (
            <div className="rounded-lg bg-background px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Explanation</p>
              <div className="mt-0.5 text-foreground">
                <LatexRenderer content={question.explanation} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** The attribution the report is required to carry. */
function ReportFooter() {
  return (
    <footer className="flex items-center justify-center gap-2 pb-2 pt-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/Origin-New-Logo.jpeg" alt="" className="h-4 w-4 rounded object-contain" />
      <p className="text-[10px] text-muted-foreground">
        powered by <span className="font-semibold text-foreground">o3origin.com</span>
      </p>
    </footer>
  );
}
