export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Target, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchCreateButton } from "@/components/teacher/BatchCreateButton";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import { formatPercent, scoreTone, type ScoreTone, TONE_TEXT } from "@/lib/teacher-analytics";
import { listBatches } from "@/server/workspaces/batches";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import { getBatchScoreStatsSafe } from "@/server/workspaces/workspace-analytics-service";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceBatchesPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const canCreate =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  // Cards gain live performance stats (plan phase 4). The stats read degrades to
  // an empty map, so the list still renders when analytics is unavailable.
  const [batches, stats] = await Promise.all([
    listBatches(workspaceId, { status: "all" }),
    isFeatureEnabled("teacherDeepAnalytics")
      ? getBatchScoreStatsSafe(workspaceId)
      : Promise.resolve(new Map()),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {batches.length} total · group students for tests, rooms, and analytics.
          </p>
        </div>
        {canCreate ? <BatchCreateButton workspaceId={workspaceId} /> : null}
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No batches yet</CardTitle>
            <CardDescription>
              Create a batch to organize students by course, subject, or class level.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {batches.map((batch) => {
            const batchStats = stats.get(batch.id);
            const ranked = batchStats?.rankedStudents ?? 0;
            return (
              <Link
                key={batch.id}
                href={`/teacher/workspaces/${workspaceId}/batches/${batch.id}`}
                className="block"
              >
                <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate">{batch.name}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider",
                          batch.status === "active"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {batch.status}
                      </span>
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      {[
                        batch.course,
                        batch.subject,
                        batch.classLevel ? `Class ${batch.classLevel}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                      {batch.scheduleText ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <span aria-hidden="true">·</span>
                          <CalendarClock aria-hidden="true" className="size-3" />
                          {batch.scheduleText}
                        </span>
                      ) : null}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {ranked === 0 ? (
                      // No submissions yet: say so, rather than drawing 0% stats
                      // that read as "this batch is failing".
                      <p className="text-sm text-muted-foreground">
                        {batch.studentCount} student{batch.studentCount === 1 ? "" : "s"}
                        <span className="text-xs"> · no graded submissions yet</span>
                      </p>
                    ) : (
                      <dl className="grid grid-cols-4 gap-3">
                        <BatchStat icon={Users} label="Students" value={String(batch.studentCount)} />
                        <BatchStat
                          icon={Target}
                          label="Average"
                          value={formatPercent(batchStats?.averagePercentage)}
                          tone={scoreTone(batchStats?.averagePercentage)}
                        />
                        <BatchStat
                          icon={ArrowUpRight}
                          label="Top"
                          value={formatPercent(batchStats?.topPercentage)}
                          tone="success"
                        />
                        <BatchStat
                          icon={ArrowDownRight}
                          label="Lowest"
                          value={formatPercent(batchStats?.lowestPercentage)}
                          tone="danger"
                        />
                      </dl>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BatchStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: ScoreTone;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        <Icon aria-hidden="true" className="size-3" />
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 font-mono text-base font-bold tabular-nums",
          tone ? TONE_TEXT[tone] : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
