"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, Dumbbell, Loader2, Medal, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiJson } from "@/lib/teacher-client";
import type {
  PracticeLeaderboardEntry,
  PracticeLeaderboardSummary,
  PracticeRankBasis,
} from "@/server/workspaces/practice-leaderboard";
import type { BatchLeaderboardEntryLite } from "@/server/workspaces/batch-cohort-store";

import { AnalyticsEmptyState } from "./analytics/AnalyticsEmptyState";
import { MetricTile } from "./analytics/MetricTile";

type Payload = {
  performers: BatchLeaderboardEntryLite[];
  practitioners: PracticeLeaderboardEntry[];
  practiceSummary: PracticeLeaderboardSummary;
  basis: PracticeRankBasis;
  practiceEnabled: boolean;
};

type Props = { workspaceId: string; batchId: string };

const BASIS_LABELS: Record<PracticeRankBasis, string> = {
  combined: "Combined",
  dpp: "DPP only",
  ogcode: "OG Code only",
};

/** Gold / silver / bronze for the top three, muted after that. */
function medalClass(rank: number): string {
  if (rank === 1) return "text-amber-500";
  if (rank === 2) return "text-slate-400";
  if (rank === 3) return "text-orange-600";
  return "text-muted-foreground";
}

function RankCell({ rank }: { rank: number }) {
  return (
    <span className={`inline-flex w-8 items-center justify-center font-mono font-bold tabular-nums ${medalClass(rank)}`}>
      {rank <= 3 ? <Medal className="h-4 w-4" /> : rank}
    </span>
  );
}

/**
 * The batch leaderboard: two rankings side by side.
 *
 * Kept as two boards rather than one blended score on purpose — outcome (tests)
 * and effort (practice) answer different questions, and the student worth
 * finding is usually the one who ranks high on one and low on the other.
 */
export function BatchLeaderboardPanel({ workspaceId, batchId }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [basis, setBasis] = useState<PracticeRankBasis>("combined");

  const load = useCallback(
    async (nextBasis: PracticeRankBasis) => {
      setLoading(true);
      const res = await apiJson<Payload>(
        `/api/teacher/workspaces/${workspaceId}/analytics/batches/${batchId}?type=leaderboards&basis=${nextBasis}`,
      );
      setData(res.ok ? res.data : null);
      setLoading(false);
    },
    [workspaceId, batchId],
  );

  useEffect(() => {
    void load(basis);
  }, [load, basis]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading leaderboards…
      </div>
    );
  }

  if (!data) {
    return (
      <AnalyticsEmptyState
        icon={Trophy}
        title="Leaderboards unavailable"
        description="The analytics database could not be reached. Reload in a moment."
      />
    );
  }

  const { performers, practitioners, practiceSummary, practiceEnabled } = data;

  return (
    <div className="space-y-6">
      {practiceEnabled ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Active practitioners"
            value={`${practiceSummary.activePractitioners}/${practiceSummary.totalStudents}`}
            hint="Students with a scored DPP or OG Code work"
          />
          <MetricTile
            label="DPP questions done"
            value={String(practiceSummary.questionsAttempted)}
            hint="Answered across the batch"
          />
          <MetricTile
            label="Mean DPP accuracy"
            value={practiceSummary.meanDppAccuracy === null ? "—" : `${practiceSummary.meanDppAccuracy}%`}
            hint="Marks scored ÷ marks available"
          />
          <MetricTile
            label="OG Code questions"
            value={String(practiceSummary.totalOgcodeQuestions)}
            hint="Self-directed practice, all-time"
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Top Performers: outcome ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Performers
            </CardTitle>
            <CardDescription>Ranked on tests this batch has taken.</CardDescription>
          </CardHeader>
          <CardContent>
            {performers.length === 0 ? (
              <AnalyticsEmptyState
                icon={Trophy}
                title="No test results yet"
                description="Assign a test to this batch — rankings appear once students submit."
              />
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="pb-2 pl-1 font-semibold">#</th>
                    <th className="pb-2 font-semibold">Student</th>
                    <th className="pb-2 text-right font-semibold">Mean %</th>
                    <th className="pb-2 pr-1 text-right font-semibold">Tests</th>
                  </tr>
                </thead>
                <tbody>
                  {performers.map((entry) => (
                    <tr key={entry.studentId} className="border-b border-dashed last:border-0">
                      <td className="py-2 pl-1"><RankCell rank={entry.rank} /></td>
                      <td className="py-2 font-medium">{entry.displayName}</td>
                      <td className="py-2 text-right font-mono font-bold tabular-nums">
                        {entry.meanPercentage}%
                      </td>
                      <td className="py-2 pr-1 text-right font-mono tabular-nums text-muted-foreground">
                        {entry.attempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ── Top Practitioners: effort ───────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  Top Practitioners
                </CardTitle>
                <CardDescription>
                  Your shared DPPs plus the student&apos;s own OG Code practice.
                </CardDescription>
              </div>
              {practiceEnabled ? (
                <div className="flex rounded-lg border p-0.5">
                  {(Object.keys(BASIS_LABELS) as PracticeRankBasis[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBasis(key)}
                      className={`rounded-md px-2 py-1 text-[0.7rem] font-semibold transition-colors ${
                        basis === key
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {BASIS_LABELS[key]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {!practiceEnabled ? (
              <AnalyticsEmptyState
                icon={Dumbbell}
                title="DPP sharing is off"
                description="Practice ranking needs the teacher DPP feature enabled for this environment."
              />
            ) : practitioners.length === 0 ? (
              <AnalyticsEmptyState
                icon={Dumbbell}
                title="No students in this batch"
                description="Add students to the batch, then share a test as a DPP to start ranking practice."
              />
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="pb-2 pl-1 font-semibold">#</th>
                    <th className="pb-2 font-semibold">Student</th>
                    <th
                      className={`pb-2 text-right font-semibold ${basis === "dpp" ? "text-primary" : ""}`}
                      title="Marks scored across your shared DPPs"
                    >
                      DPP{basis === "dpp" ? " ▾" : ""}
                    </th>
                    <th
                      className={`pb-2 text-right font-semibold ${basis === "ogcode" ? "text-primary" : ""}`}
                      title="All-time OG Code practice score"
                    >
                      OG Code{basis === "ogcode" ? " ▾" : ""}
                    </th>
                    <th
                      className={`pb-2 pr-1 text-right font-semibold ${
                        basis === "combined" ? "text-primary" : ""
                      }`}
                      title="Blended 0–100 practice index"
                    >
                      Index{basis === "combined" ? " ▾" : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {practitioners.map((entry) => (
                    <tr key={entry.studentId} className="border-b border-dashed last:border-0">
                      <td className="py-2 pl-1"><RankCell rank={entry.rank} /></td>
                      <td className="py-2">
                        <span className="font-medium">{entry.displayName}</span>
                        <span className="ml-2 text-[0.7rem] text-muted-foreground">
                          {entry.questionsAttempted}q in {entry.dppsAttempted} DPP
                          {entry.dppsAttempted === 1 ? "" : "s"}
                          {entry.dppAccuracy !== null ? ` · ${entry.dppAccuracy}%` : ""}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono font-bold tabular-nums">
                        {entry.dppScore}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {entry.ogcodeScore}
                        <span className="ml-1 text-[0.65rem]">({entry.ogcodeQuestions}q)</span>
                      </td>
                      <td className="py-2 pr-1 text-right">
                        <Badge variant="secondary" className="font-mono tabular-nums">
                          {entry.practiceIndex}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {practiceEnabled && practitioners.length > 0 ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Award className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="text-foreground">Index</strong> is 0–100: each student&apos;s DPP
            and OG Code scores are scaled against this batch&apos;s best on that source, then
            blended 60% DPP / 40% OG Code. It exists because raw OG Code totals dwarf DPP marks,
            so summing them would rank purely on OG Code. Whoever leads both sources scores 100 —
            in a small batch that can mean the ranking looks the same on every toggle.
          </span>
        </p>
      ) : null}
    </div>
  );
}
