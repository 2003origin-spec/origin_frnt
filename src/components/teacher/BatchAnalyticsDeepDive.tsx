"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  Flame,
  GraduationCap,
  LineChart as LineChartIcon,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiJson } from "@/lib/teacher-client";
import { cn } from "@/lib/utils";
import type { Batch } from "@/server/workspaces/types";
import {
  CHART_COLORS,
  formatPercent,
  formatStudyMinutes,
  initialsOf,
  scoreTone,
  type ScoreBucket,
  TONE_TEXT,
  truncateLabel,
} from "@/lib/teacher-analytics";

import { AnalyticsEmptyState } from "./analytics/AnalyticsEmptyState";
import { ChartFrame } from "./analytics/ChartFrame";
import { MetricTile } from "./analytics/MetricTile";
import { ScoreDistributionChart } from "./analytics/ScoreDistributionChart";
import { ScoreTrendChart } from "./analytics/ScoreTrendChart";
import { StudentProfilePanel } from "./analytics/StudentProfilePanel";

type TopicRow = {
  id: string;
  topic: string;
  subject: string;
  accuracy: number; // 0–1
  attempts: number;
  severity: "high" | "medium" | "low";
  covered: boolean;
  students: number;
  studentsAffected: number;
};

type TimelinePoint = {
  testId: string;
  title: string;
  averagePercentage: number;
  topPercentage: number;
  students: number;
  conductedAt: string;
};

type DeepPayload = {
  summary: {
    available: boolean;
    averagePercentage: number | null;
    topPercentage: number | null;
    lowestPercentage: number | null;
    medianPercentage: number | null;
    rankedStudents: number;
    weakTopics: number;
    scoreDistribution: ScoreBucket[];
  };
  topics: TopicRow[];
  leaderboard: Array<{
    rank: number;
    studentId: string;
    displayName: string;
    meanPercentage: number;
    attempts: number;
    platformRank: number;
  }>;
  timeline: TimelinePoint[];
};

type RosterRow = {
  rank: number;
  studentId: string;
  displayName: string;
  meanPercentage: number;
  attempts: number;
  platformRank: number;
  /** Mean TOPIC accuracy 0–100 — a different question from meanPercentage. */
  accuracy: number | null;
  /** BKT mastery 0–100 from analytics-service. */
  mastery: number | null;
  anomalousTopics: number;
  streak: number;
  studyMinutes: number;
  points: number;
};

type SortKey =
  | "rank"
  | "meanPercentage"
  | "accuracy"
  | "mastery"
  | "attempts"
  | "streak"
  | "studyMinutes"
  | "points";

/**
 * The batch **Analytics** tab — the PRD's batch deep-dive, living inside the
 * existing batch planner tab bar rather than as a new page.
 *
 * Loads in two parallel requests against route branches that already existed
 * (`?type=deep`, `?type=roster`), so nothing new had to be registered.
 */
export function BatchAnalyticsDeepDive({
  workspaceId,
  batch,
  studentCount,
}: {
  workspaceId: string;
  batch: Batch;
  /** Roster size from the batch page — distinct from "ranked" students. */
  studentCount: number;
}) {
  const batchId = batch.id;
  const batchSubject = batch.subject;
  const [data, setData] = useState<DeepPayload | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "rank",
    dir: "asc",
  });

  const base = `/api/teacher/workspaces/${workspaceId}/analytics/batches/${batchId}`;

  useEffect(() => {
    let cancelled = false;
    // No synchronous setState in the effect body (React Compiler: cascading
    // renders). `loading` already starts true, and `base` is fixed for the
    // lifetime of a batch page, so there is nothing to reset here.
    Promise.all([
      apiJson<DeepPayload>(`${base}?type=deep`),
      apiJson<{ roster: RosterRow[] }>(`${base}?type=roster`),
    ])
      .then(([deepRes, rosterRes]) => {
        if (cancelled) return;
        if (deepRes.ok) setData(deepRes.data);
        if (rosterRes.ok) setRoster(rosterRes.data.roster ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const sortedRoster = useMemo(() => {
    const factor = sort.dir === "desc" ? -1 : 1;
    return [...roster].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      // Students with no topic analysis sink to the bottom in BOTH directions —
      // "no data" is not the same as "scored zero".
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      return (left - right) * factor;
    });
  }, [roster, sort]);

  const radarData = useMemo(
    () =>
      // Capped at 8 spokes: a radar past that is unreadable, and the full list
      // is right below in the intervention panel anyway.
      (data?.topics ?? []).slice(0, 8).map((topic) => ({
        topic: truncateLabel(topic.topic, 13),
        accuracy: Math.round(topic.accuracy * 100),
      })),
    [data],
  );

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "rank" ? "asc" : "desc" },
    );
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[5.5rem] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data || !data.summary.available) {
    return (
      <AnalyticsEmptyState
        icon={BarChart3}
        title="No graded submissions in this batch yet"
        description="Assign a test to this batch — once students submit and analysis completes, the full breakdown appears here."
      />
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-5">
      {/* Batch header — identity for the analytics below it, matching the batch
          card the teacher clicked through from. */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5">
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-lg font-bold text-primary"
        >
          {batch.name.trim().charAt(0).toUpperCase() || "B"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold tracking-tight">{batch.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {batch.course ? (
              <span className="inline-flex items-center gap-1">
                <BookOpen aria-hidden="true" className="size-3" />
                {batch.course}
              </span>
            ) : null}
            {batch.subject ? (
              <span className="inline-flex items-center gap-1 capitalize">
                <Target aria-hidden="true" className="size-3" />
                {batch.subject}
              </span>
            ) : null}
            {batch.classLevel ? (
              <span className="inline-flex items-center gap-1">
                <GraduationCap aria-hidden="true" className="size-3" />
                Class {batch.classLevel}
              </span>
            ) : null}
            {batch.scheduleText ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock aria-hidden="true" className="size-3" />
                {batch.scheduleText}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider",
              batch.status === "active"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            {batch.status}
          </span>
          <span className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
            Since{" "}
            {new Date(batch.startsAt ?? batch.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Performance summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <MetricTile
          label="Average"
          value={formatPercent(summary.averagePercentage, 1)}
          tone={scoreTone(summary.averagePercentage)}
          icon={Target}
        />
        <MetricTile
          label="Median"
          value={formatPercent(summary.medianPercentage, 1)}
          tone={scoreTone(summary.medianPercentage)}
          icon={BarChart3}
        />
        <MetricTile
          label="Top score"
          value={formatPercent(summary.topPercentage, 1)}
          tone="success"
          icon={ArrowUpRight}
        />
        <MetricTile
          label="Lowest"
          value={formatPercent(summary.lowestPercentage, 1)}
          tone="danger"
          icon={ArrowDownRight}
        />
        <MetricTile label="Students" value={String(studentCount)} icon={Users} />
        <MetricTile
          label="Ranked"
          value={String(summary.rankedStudents)}
          icon={Trophy}
          hint={
            studentCount > summary.rankedStudents
              ? `${studentCount - summary.rankedStudents} yet to submit`
              : undefined
          }
        />
        <MetricTile
          label="Weak topics"
          value={String(summary.weakTopics)}
          tone={summary.weakTopics > 0 ? "danger" : "success"}
          icon={AlertTriangle}
          hint="High severity, uncovered"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Score distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 aria-hidden="true" className="size-4 text-primary" />
              Score distribution
            </CardTitle>
            <CardDescription>Students per mark band, from their mean test percentage.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreDistributionChart buckets={summary.scoreDistribution} />
          </CardContent>
        </Card>

        {/* Topic mastery radar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target aria-hidden="true" className="size-4 text-primary" />
              Topic mastery
            </CardTitle>
            <CardDescription>
              Cohort accuracy across this batch&apos;s {batchSubject || "syllabus"} topics — weakest eight.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length === 0 ? (
              <AnalyticsEmptyState
                icon={Target}
                title="No topic analysis yet"
                description="Topic accuracy appears once a submitted test has been analysed."
              />
            ) : (
              <ChartFrame height={240}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke={CHART_COLORS.grid} />
                    <PolarAngleAxis
                      dataKey="topic"
                      tick={{ fontSize: 9 }}
                      stroke="currentColor"
                      className="text-muted-foreground"
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fontSize: 9 }}
                      stroke="currentColor"
                      className="text-muted-foreground"
                    />
                    <Radar
                      name="Accuracy"
                      dataKey="accuracy"
                      stroke={CHART_COLORS.accent}
                      fill={CHART_COLORS.accent}
                      fillOpacity={0.22}
                      isAnimationActive={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartFrame>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Test timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChartIcon aria-hidden="true" className="size-4 text-primary" />
              Test performance over time
            </CardTitle>
            <CardDescription>Batch average per test, oldest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.timeline.length === 0 ? (
              <AnalyticsEmptyState
                icon={TrendingUp}
                title="Not enough tests yet"
                description="Each test this batch sits adds a point to the trend."
              />
            ) : (
              <ScoreTrendChart
                label="Batch average"
                points={data.timeline.map((point) => ({
                  date: point.conductedAt,
                  percentage: point.averagePercentage,
                  title: point.title,
                }))}
              />
            )}
          </CardContent>
        </Card>

        {/* Weak topic interventions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle aria-hidden="true" className="size-4 text-destructive" />
              Intervention list
            </CardTitle>
            <CardDescription>
              Topics by severity, with how many students are below 50% on each.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[16rem] space-y-2 overflow-y-auto">
            {data.topics.length === 0 ? (
              <AnalyticsEmptyState
                icon={Target}
                title="No topics analysed yet"
                description="This list is built from per-topic analysis of submitted tests."
              />
            ) : (
              data.topics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        topic.severity === "high"
                          ? "bg-destructive"
                          : topic.severity === "medium"
                            ? "bg-amber-500"
                            : "bg-emerald-500",
                      )}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-xs font-semibold",
                          topic.covered && "text-muted-foreground line-through",
                        )}
                        title={topic.topic}
                      >
                        {topic.topic}
                      </p>
                      <p className="text-[0.65rem] capitalize text-muted-foreground">
                        {topic.severity} · {topic.studentsAffected}/{topic.students} students below 50%
                        {topic.covered ? " · covered" : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs font-bold tabular-nums",
                      TONE_TEXT[scoreTone(topic.accuracy * 100)],
                    )}
                  >
                    {Math.round(topic.accuracy * 100)}%
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Student ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy aria-hidden="true" className="size-4 text-primary" />
            Student rankings
          </CardTitle>
          <CardDescription>
            Sort by any column. Select a row to open that student&apos;s full profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {sortedRoster.length === 0 ? (
            <div className="px-6">
              <AnalyticsEmptyState
                icon={Users}
                title="No ranked students yet"
                description="A student appears here after their first analysed submission for this batch."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    <SortableHeader
                      label="Rank"
                      sortKey="rank"
                      active={sort}
                      onSort={toggleSort}
                      className="px-6"
                    />
                    <th className="px-2 py-2 font-semibold">Student</th>
                    <SortableHeader label="Mean" sortKey="meanPercentage" active={sort} onSort={toggleSort} />
                    <SortableHeader label="Accuracy" sortKey="accuracy" active={sort} onSort={toggleSort} />
                    <SortableHeader label="Mastery" sortKey="mastery" active={sort} onSort={toggleSort} />
                    <SortableHeader label="Tests" sortKey="attempts" active={sort} onSort={toggleSort} />
                    <SortableHeader label="Streak" sortKey="streak" active={sort} onSort={toggleSort} />
                    <SortableHeader
                      label="Study (30d)"
                      sortKey="studyMinutes"
                      active={sort}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Points"
                      sortKey="points"
                      active={sort}
                      onSort={toggleSort}
                      className="pr-6"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {sortedRoster.map((row) => (
                    <tr
                      key={row.studentId}
                      onClick={() => setOpenStudentId(row.studentId)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td className="px-6 py-2.5 text-center font-mono font-bold tabular-nums">
                        {row.rank}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[0.55rem] font-bold text-primary"
                          >
                            {initialsOf(row.displayName)}
                          </span>
                          <span className="max-w-[10rem] truncate font-semibold">{row.displayName}</span>
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2.5 text-center font-mono font-bold tabular-nums",
                          TONE_TEXT[scoreTone(row.meanPercentage)],
                        )}
                      >
                        {row.meanPercentage.toFixed(1)}%
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2.5 text-center font-mono font-semibold tabular-nums",
                          TONE_TEXT[scoreTone(row.accuracy)],
                        )}
                        title="Mean accuracy across every topic this student has been assessed on"
                      >
                        {formatPercent(row.accuracy)}
                      </td>
                      <td className="px-2 py-2.5" title="Bayesian Knowledge Tracing mastery">
                        <div className="flex items-center justify-center gap-2">
                          <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(0, Math.min(100, row.mastery ?? 0))}%` }}
                            />
                          </span>
                          <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                            {formatPercent(row.mastery)}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono tabular-nums text-muted-foreground">
                        {row.attempts}
                        {row.anomalousTopics > 0 ? (
                          <span
                            className="ml-1 inline-flex align-middle text-amber-500"
                            title={`${row.anomalousTopics} topic${row.anomalousTopics === 1 ? "" : "s"} flagged as an anomalous answer pattern by the analytics service`}
                          >
                            <AlertTriangle aria-hidden="true" className="size-3" />
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 text-center text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Flame aria-hidden="true" className="size-3" />
                          {row.streak}d
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Timer aria-hidden="true" className="size-3" />
                          {formatStudyMinutes(row.studyMinutes)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-6 text-center font-mono tabular-nums text-muted-foreground">
                        {row.points.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <StudentProfilePanel
        workspaceId={workspaceId}
        studentId={openStudentId}
        onClose={() => setOpenStudentId(null)}
      />
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  active,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = active.key === sortKey;
  return (
    <th
      scope="col"
      className={cn("px-2 py-2 text-center font-semibold", className)}
      aria-sort={isActive ? (active.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground",
          isActive && "text-foreground",
        )}
      >
        {label}
        <span aria-hidden="true" className={cn("text-[0.6rem]", !isActive && "opacity-40")}>
          {isActive && active.dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
