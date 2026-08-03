"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ClipboardList,
  Flame,
  Grid3x3,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatPercent,
  formatStudyMinutes,
  initialsOf,
  scoreTone,
  TONE_SURFACE,
  TONE_TEXT,
} from "@/lib/teacher-analytics";
import type { WorkspaceOverviewAnalytics as OverviewData } from "@/server/workspaces/workspace-analytics-service";

import { AnalyticsEmptyState } from "./analytics/AnalyticsEmptyState";
import { BatchComparisonChart } from "./analytics/BatchComparisonChart";
import { MetricTile } from "./analytics/MetricTile";
import { ScoreDistributionChart } from "./analytics/ScoreDistributionChart";
import { StudentProfilePanel } from "./analytics/StudentProfilePanel";
import { SubjectBatchHeatmap } from "./analytics/SubjectBatchHeatmap";

type Props = {
  workspaceId: string;
  data: OverviewData;
};

/**
 * The Overview analytics block — appended BELOW the existing hero, alert grid
 * and schedule. Nothing above it changes; the institute-code controls in
 * particular stay exactly where they were.
 *
 * Data is computed server-side and handed down as props (plan D2), so this
 * component does no fetching — it only owns the student drill-down state.
 */
export function WorkspaceOverviewAnalytics({ workspaceId, data }: Props) {
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const hasBatches = data.batches.length > 0;

  return (
    <section className="space-y-4" aria-labelledby="workspace-analytics-heading">
      <div className="flex items-center gap-2">
        <BarChart3 aria-hidden="true" className="size-5 text-primary" />
        <div>
          <h2 id="workspace-analytics-heading" className="text-lg font-bold tracking-tight">
            Institute analytics
          </h2>
          <p className="text-xs text-muted-foreground">
            Live performance across every batch, derived from submitted tests.
          </p>
        </div>
      </div>

      {/* KPI strip — always rendered; each tile shows — when it has no data. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Students" value={String(data.kpis.totalStudents)} icon={Users} />
        <MetricTile label="Active batches" value={String(data.kpis.activeBatches)} icon={BookOpen} />
        <MetricTile
          label="Average score"
          value={formatPercent(data.kpis.averagePercentage, 1)}
          tone={scoreTone(data.kpis.averagePercentage)}
          icon={Target}
          hint={data.rankedStudents > 0 ? `${data.rankedStudents} ranked` : "No submissions yet"}
        />
        <MetricTile
          label="Tests conducted"
          value={String(data.kpis.testsConducted)}
          icon={ClipboardList}
        />
        <MetricTile
          label="Weak topics"
          value={String(data.kpis.weakTopics)}
          tone={data.kpis.weakTopics > 0 ? "danger" : "success"}
          icon={AlertTriangle}
          hint="Below 35% accuracy"
        />
        <MetricTile
          label="Avg study time"
          value={formatStudyMinutes(data.kpis.averageStudyMinutes)}
          icon={Timer}
          hint="Per student, all-time"
        />
      </div>

      {!data.available ? (
        <AnalyticsEmptyState
          icon={BarChart3}
          title={hasBatches ? "No analysed submissions yet" : "No batches yet"}
          description={
            hasBatches
              ? "Charts fill in as soon as your students submit an assigned test and it finishes analysis."
              : "Create a batch, add students, and assign a test — analytics builds itself from their submissions."
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Batch comparison */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 aria-hidden="true" className="size-4 text-primary" />
                  Batch performance
                </CardTitle>
                <CardDescription>
                  Average score per batch, highest first. Bars are coloured by performance band.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BatchComparisonChart data={data.batches} />
              </CardContent>
            </Card>

            {/* Top performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy aria-hidden="true" className="size-4 text-primary" />
                  Top performers
                </CardTitle>
                <CardDescription>Across all batches. Select a student for their profile.</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[19rem] overflow-y-auto p-0 pb-4">
                <ul className="divide-y">
                  {data.topPerformers.map((student, index) => (
                    <li key={student.studentId}>
                      <button
                        type="button"
                        onClick={() => setOpenStudentId(student.studentId)}
                        className="flex w-full cursor-pointer items-center gap-3 px-6 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      >
                        <span className="w-5 shrink-0 text-center font-mono text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <span
                          aria-hidden="true"
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[0.6rem] font-bold text-primary"
                        >
                          {initialsOf(student.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">{student.name}</span>
                          <span className="block truncate text-[0.65rem] text-muted-foreground">
                            {student.batchNames[0] ?? "Unassigned"}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span
                            className={cn(
                              "block font-mono text-xs font-bold tabular-nums",
                              TONE_TEXT[scoreTone(student.meanPercentage)],
                            )}
                          >
                            {student.meanPercentage.toFixed(1)}%
                          </span>
                          <span className="flex items-center justify-end gap-0.5 text-[0.6rem] text-muted-foreground">
                            <Flame aria-hidden="true" className="size-2.5" />
                            {student.streak}d
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Subject × batch heatmap */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Grid3x3 aria-hidden="true" className="size-4 text-primary" />
                  Subject strength by batch
                </CardTitle>
                <CardDescription>
                  Mean topic accuracy. Every cell shows its number, so the grid reads without colour.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.heatmap.rows.length === 0 ? (
                  <AnalyticsEmptyState
                    icon={Grid3x3}
                    title="No subject data yet"
                    description="This grid fills in once submitted tests have been analysed per topic."
                  />
                ) : (
                  <SubjectBatchHeatmap data={data.heatmap} />
                )}
              </CardContent>
            </Card>

            {/* At-risk students */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle aria-hidden="true" className="size-4 text-destructive" />
                  Needs attention
                </CardTitle>
                <CardDescription>Students averaging under 40% across their tests.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                {data.atRisk.length === 0 ? (
                  <div className="px-6">
                    <AnalyticsEmptyState
                      icon={TrendingUp}
                      title="Nobody is below 40%"
                      description="Every student with a submission is averaging above the at-risk threshold."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                          <th className="px-6 py-2 font-semibold">Student</th>
                          <th className="px-2 py-2 font-semibold">Batch</th>
                          <th className="px-2 py-2 text-center font-semibold">Mean</th>
                          <th className="px-6 py-2 font-semibold">Last active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-xs">
                        {data.atRisk.map((student) => (
                          <tr
                            key={student.studentId}
                            onClick={() => setOpenStudentId(student.studentId)}
                            className="cursor-pointer transition-colors hover:bg-muted/40"
                          >
                            <td className="max-w-[9rem] truncate px-6 py-2.5 font-semibold">
                              {student.name}
                            </td>
                            <td className="max-w-[8rem] truncate px-2 py-2.5 text-muted-foreground">
                              {student.batchNames[0] ?? "—"}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 font-mono text-[0.7rem] font-bold tabular-nums",
                                  TONE_SURFACE.danger,
                                )}
                              >
                                {student.meanPercentage.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-2.5 text-[0.7rem] text-muted-foreground">
                              {student.lastAttemptAt
                                ? new Date(student.lastAttemptAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Score distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users aria-hidden="true" className="size-4 text-primary" />
                Score distribution
              </CardTitle>
              <CardDescription>
                How your {data.rankedStudents} ranked students spread across mark bands.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreDistributionChart buckets={data.scoreDistribution} />
            </CardContent>
          </Card>
        </>
      )}

      <StudentProfilePanel
        workspaceId={workspaceId}
        studentId={openStudentId}
        onClose={() => setOpenStudentId(null)}
      />
    </section>
  );
}
