"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Flame,
  GraduationCap,
  Loader2,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { apiJson } from "@/lib/teacher-client";
import { cn } from "@/lib/utils";
import {
  CHART_COLORS,
  formatDuration,
  formatPercent,
  formatStudyMinutes,
  initialsOf,
  scoreTone,
  TONE_SURFACE,
  TONE_TEXT,
  truncateLabel,
} from "@/lib/teacher-analytics";

import { AnalyticsEmptyState } from "./AnalyticsEmptyState";
import { ChartFrame } from "./ChartFrame";
import { ContributionHeatmap } from "./ContributionHeatmap";
import { MetricTile } from "./MetricTile";
import { ScoreTrendChart } from "./ScoreTrendChart";
import { TimeAnalyticsChart } from "./TimeAnalyticsChart";

// Mirrors StudentDeepProfile from workspace-analytics-service.
type TopicRow = {
  topic: string;
  subject: string;
  chapter: string | null;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // 0–1
  /** BKT posterior from analytics-service (0–1), not a copy of accuracy. */
  masteryScore: number;
  anomaly?: boolean;
  lastAttemptAt: string | null;
};

type TestRow = {
  resultId: string;
  title: string;
  subject: string | null;
  percentage: number;
  score: number | null;
  totalMarks: number | null;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTakenSeconds: number;
  submittedAt: string;
};

type DeepProfile = {
  student: {
    studentId: string;
    name: string | null;
    email: string | null;
    studentClass: string | null;
    streak: number;
    totalStudyTimeMinutes: number;
    status: string;
    enrolledAt: string;
    batches: Array<{ id: string; name: string }>;
  };
  kpis: {
    averagePercentage: number | null;
    bestPercentage: number | null;
    worstPercentage: number | null;
    testsTaken: number;
    questionsPracticed: number;
    accuracyRate: number | null;
  };
  scoreTrend: Array<{ date: string; percentage: number; title: string }>;
  subjects: Array<{ subject: string; accuracy: number; attempts: number; topics: number }>;
  topics: TopicRow[];
  strengths: TopicRow[];
  weaknesses: TopicRow[];
  testHistory: TestRow[];
  timeAnalytics: Array<{
    date: string;
    dayName: string;
    webpageTime: number;
    practiceTime: number;
    pomodoroTime: number;
  }>;
  contributions: Array<{ date: string; count: number }>;
  streak: {
    currentStreak: number;
    longestStreak: number;
    weeklyData: boolean[];
    freezesRemaining: number | null;
  } | null;
  points: number;
  latestAnalysis: { summary: string; recommendations: string[]; testTitle: string } | null;
};

type Props = {
  workspaceId: string;
  /** The open student, or null when the panel is closed. */
  studentId: string | null;
  onClose: () => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The 360° student profile — a slide-over opened from the Overview leaderboards,
 * the batch ranking table, and the student directory.
 *
 * Built on the shadcn Sheet so focus trapping, Escape-to-close and the overlay
 * click all come from Radix rather than being re-implemented (the standalone
 * mock hand-rolled them).
 */
export function StudentProfilePanel({ workspaceId, studentId, onClose }: Props) {
  const [profile, setProfile] = useState<DeepProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    // Reset + fetch inside a .then() chain so the effect body performs no
    // synchronous state update (React Compiler: cascading renders) — the same
    // shape AnalyticsCenterHighFidelity's loader uses.
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        setError(null);
        setProfile(null);
      })
      .then(() =>
        apiJson<{ profile: DeepProfile }>(
          `/api/teacher/workspaces/${workspaceId}/analytics/students/${studentId}?type=full`,
        ),
      )
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setProfile(result.data.profile);
        else setError(result.detail || "Could not load this student's analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, studentId]);

  const student = profile?.student;
  const name = student?.name || "Student";

  return (
    <Sheet open={Boolean(studentId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-3xl"
        aria-describedby={undefined}
      >
        <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
          <SheetTitle className="flex items-center gap-3 pr-8 text-left">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary"
            >
              {initialsOf(name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold">{name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {student?.email || "—"}
              </span>
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Full academic profile for {name}, including scores, topic mastery, and study activity.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-6 pb-10 pt-5">
          {loading ? <ProfileSkeleton /> : null}

          {!loading && error ? (
            <AnalyticsEmptyState
              icon={AlertTriangle}
              title="Could not load this profile"
              description={error}
            />
          ) : null}

          {!loading && profile && student ? (
            <>
              {/* Identity chips */}
              <div className="flex flex-wrap gap-2 text-xs">
                {student.batches.map((batch) => (
                  <span
                    key={batch.id}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-semibold text-primary"
                  >
                    <BookOpen aria-hidden="true" className="size-3" />
                    {batch.name}
                  </span>
                ))}
                {student.studentClass ? (
                  <Chip icon={GraduationCap}>Class {student.studentClass}</Chip>
                ) : null}
                <Chip icon={Flame}>{student.streak}-day streak</Chip>
                <Chip icon={Timer}>{formatStudyMinutes(student.totalStudyTimeMinutes)} studied</Chip>
                <Chip icon={Award}>{profile.points.toLocaleString("en-IN")} pts</Chip>
                <Chip icon={CalendarDays}>
                  Joined {new Date(student.enrolledAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Chip>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricTile
                  label="Average score"
                  value={formatPercent(profile.kpis.averagePercentage, 1)}
                  tone={scoreTone(profile.kpis.averagePercentage)}
                  icon={Target}
                />
                <MetricTile
                  label="Best score"
                  value={formatPercent(profile.kpis.bestPercentage, 1)}
                  tone={profile.kpis.bestPercentage == null ? "muted" : "success"}
                  icon={TrendingUp}
                />
                <MetricTile
                  label="Lowest score"
                  value={formatPercent(profile.kpis.worstPercentage, 1)}
                  tone={profile.kpis.worstPercentage == null ? "muted" : "danger"}
                  icon={AlertTriangle}
                />
                <MetricTile
                  label="Tests taken"
                  value={String(profile.kpis.testsTaken)}
                  icon={ClipboardList}
                />
                <MetricTile
                  label="Questions practised"
                  value={profile.kpis.questionsPracticed.toLocaleString("en-IN")}
                  icon={Activity}
                />
                <MetricTile
                  label="Topic accuracy"
                  value={formatPercent(profile.kpis.accuracyRate, 1)}
                  tone={scoreTone(profile.kpis.accuracyRate)}
                  icon={Trophy}
                />
              </div>

              {/* Score trend */}
              <Panel
                title="Score trend"
                description="Every test in this institute, oldest first. The dashed line is a 3-test rolling average."
              >
                {profile.scoreTrend.length === 0 ? (
                  <AnalyticsEmptyState
                    icon={TrendingUp}
                    title="No graded tests yet"
                    description="A point appears here each time this student submits an institute test and it finishes analysis."
                  />
                ) : (
                  <ScoreTrendChart points={profile.scoreTrend} />
                )}
              </Panel>

              {/* Subject radar */}
              <Panel title="Subject breakdown" description="Mean accuracy per subject across all analysed work.">
                {profile.subjects.length === 0 ? (
                  <AnalyticsEmptyState
                    icon={Target}
                    title="No subject data yet"
                    description="Subject accuracy is derived from per-topic analysis of submitted tests."
                  />
                ) : (
                  <ChartFrame height={260}>
                    <ResponsiveContainer width="100%" height="100%">
                      {/* Capped at 8 spokes — a radar stops being readable beyond that. */}
                      <RadarChart data={profile.subjects.slice(0, 8)} outerRadius="72%">
                        <PolarGrid stroke={CHART_COLORS.grid} />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          className="text-muted-foreground capitalize"
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
                          stroke={CHART_COLORS.primary}
                          fill={CHART_COLORS.primary}
                          fillOpacity={0.22}
                          isAnimationActive={false}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                )}
              </Panel>

              {/* Strengths / weaknesses */}
              {profile.strengths.length > 0 || profile.weaknesses.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <TopicListPanel
                    title="Strongest topics"
                    icon={Trophy}
                    rows={profile.strengths}
                    tone="success"
                  />
                  <TopicListPanel
                    title="Weakest topics"
                    icon={AlertTriangle}
                    rows={profile.weaknesses}
                    tone="danger"
                  />
                </div>
              ) : null}

              {/* Study activity */}
              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="Study time — last 7 days" description="Minutes, split by activity type.">
                  <TimeAnalyticsChart data={profile.timeAnalytics} />
                </Panel>
                <Panel title="Activity" description="Questions practised per day.">
                  <ContributionHeatmap days={profile.contributions} />
                  {profile.streak ? (
                    <div className="mt-4 flex flex-wrap items-center gap-5 border-t pt-4">
                      <StreakStat label="Current streak" value={`${profile.streak.currentStreak}d`} />
                      <StreakStat label="Longest streak" value={`${profile.streak.longestStreak}d`} />
                      <div className="flex gap-1.5">
                        {WEEKDAYS.map((day, index) => (
                          <div key={day} className="text-center">
                            <span
                              className={cn(
                                "grid size-7 place-items-center rounded-md border text-[0.6rem] font-bold",
                                profile.streak?.weeklyData[index]
                                  ? "border-primary/40 bg-primary/15 text-primary"
                                  : "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {profile.streak?.weeklyData[index] ? "✓" : "·"}
                            </span>
                            <span className="mt-1 block text-[0.55rem] text-muted-foreground">{day}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Panel>
              </div>

              {/* Topic mastery matrix */}
              <Panel
                title="Topic mastery"
                description="Every topic this student has been assessed on, weakest first."
              >
                {profile.topics.length === 0 ? (
                  <AnalyticsEmptyState
                    icon={Target}
                    title="No topic analytics yet"
                    description="Topic rows populate once a submitted test finishes analysis."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3 font-semibold">Topic</th>
                          <th className="px-2 py-2 font-semibold">Subject</th>
                          <th className="px-2 py-2 text-center font-semibold">Accuracy</th>
                          <th className="px-2 py-2 text-center font-semibold">Mastery</th>
                          <th className="px-2 py-2 text-center font-semibold">Correct</th>
                          <th className="px-2 py-2 font-semibold">Last attempt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-xs">
                        {[...profile.topics]
                          .sort((a, b) => a.accuracy - b.accuracy)
                          .map((topic) => {
                            const accuracyPct = Math.round(topic.accuracy * 100);
                            const masteryPct = Math.round(topic.masteryScore * 100);
                            return (
                              <tr key={`${topic.subject}-${topic.topic}`} className="hover:bg-muted/30">
                                <td className="max-w-[12rem] truncate py-2.5 pr-3 font-semibold">
                                  {topic.topic}
                                  {topic.anomaly ? (
                                    <span
                                      className="ml-1.5 inline-flex align-middle text-amber-500"
                                      title="The analytics service flagged an anomalous answer pattern on this topic (e.g. correct answers far faster than expected)"
                                    >
                                      <AlertTriangle aria-hidden="true" className="size-3" />
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-2 py-2.5 capitalize text-muted-foreground">
                                  {topic.subject}
                                </td>
                                <td
                                  className={cn(
                                    "px-2 py-2.5 text-center font-mono font-bold tabular-nums",
                                    TONE_TEXT[scoreTone(accuracyPct)],
                                  )}
                                >
                                  {accuracyPct}%
                                </td>
                                <td className="px-2 py-2.5">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                      <span
                                        className="block h-full rounded-full bg-primary"
                                        style={{ width: `${masteryPct}%` }}
                                      />
                                    </span>
                                    <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                                      {masteryPct}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 py-2.5 text-center font-mono tabular-nums text-muted-foreground">
                                  {topic.correctAttempts}/{topic.totalAttempts}
                                </td>
                                <td className="px-2 py-2.5 text-[0.7rem] text-muted-foreground">
                                  {topic.lastAttemptAt
                                    ? new Date(topic.lastAttemptAt).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                      })
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              {/* AI analysis */}
              {profile.latestAnalysis &&
              (profile.latestAnalysis.summary || profile.latestAnalysis.recommendations.length > 0) ? (
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5">
                  <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-primary">
                    <Sparkles aria-hidden="true" className="size-3.5" />
                    Analysis · {profile.latestAnalysis.testTitle}
                  </p>
                  {profile.latestAnalysis.summary ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {profile.latestAnalysis.summary}
                    </p>
                  ) : null}
                  {profile.latestAnalysis.recommendations.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {profile.latestAnalysis.recommendations.map((item) => (
                        <li key={item} className="flex gap-2 text-xs text-muted-foreground">
                          <span aria-hidden="true" className="font-bold text-primary">
                            →
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* Test history */}
              <Panel title="Test history" description={`${profile.testHistory.length} submitted`}>
                {profile.testHistory.length === 0 ? (
                  <AnalyticsEmptyState
                    icon={ClipboardList}
                    title="No submissions yet"
                    description="Tests appear here once this student submits one you assigned to their batch."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3 font-semibold">Test</th>
                          <th className="px-2 py-2 font-semibold">Date</th>
                          <th className="px-2 py-2 text-center font-semibold">Score</th>
                          <th className="px-2 py-2 text-center font-semibold">%</th>
                          <th className="px-2 py-2 text-center font-semibold">C / W / U</th>
                          <th className="px-2 py-2 text-center font-semibold">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-xs">
                        {profile.testHistory.map((test) => (
                          <tr key={test.resultId} className="hover:bg-muted/30">
                            <td className="max-w-[12rem] truncate py-2.5 pr-3 font-semibold">
                              {test.title}
                            </td>
                            <td className="px-2 py-2.5 text-[0.7rem] text-muted-foreground">
                              {new Date(test.submittedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono tabular-nums text-muted-foreground">
                              {test.score == null || test.totalMarks == null
                                ? "—"
                                : `${test.score}/${test.totalMarks}`}
                            </td>
                            <td
                              className={cn(
                                "px-2 py-2.5 text-center font-mono font-bold tabular-nums",
                                TONE_TEXT[scoreTone(test.percentage)],
                              )}
                            >
                              {Math.round(test.percentage)}%
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono text-[0.7rem] tabular-nums">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {test.correctAnswers}
                              </span>
                              <span className="text-muted-foreground"> / </span>
                              <span className="text-destructive">{test.wrongAnswers}</span>
                              <span className="text-muted-foreground"> / {test.unattempted}</span>
                            </td>
                            <td className="px-2 py-2.5 text-center text-[0.7rem] text-muted-foreground">
                              {formatDuration(test.timeTakenSeconds)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Flame; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 font-medium text-muted-foreground">
      <Icon aria-hidden="true" className="size-3" />
      {children}
    </span>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-bold tracking-tight">{title}</h3>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TopicListPanel({
  title,
  icon: Icon,
  rows,
  tone,
}: {
  title: string;
  icon: typeof Trophy;
  rows: TopicRow[];
  tone: "success" | "danger";
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h3 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
        <Icon aria-hidden="true" className={cn("size-4", TONE_TEXT[tone])} />
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <li className="text-xs text-muted-foreground">Not enough attempts yet.</li>
        ) : (
          rows.map((row) => (
            <li
              key={`${row.subject}-${row.topic}`}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold" title={row.topic}>
                  {truncateLabel(row.topic, 28)}
                </span>
                <span className="block text-[0.65rem] capitalize text-muted-foreground">
                  {row.subject} · {row.totalAttempts} attempts
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs font-bold tabular-nums",
                  TONE_SURFACE[tone],
                )}
              >
                {Math.round(row.accuracy * 100)}%
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function StreakStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-lg font-bold tabular-nums text-primary">{value}</div>
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/** Reserves the panel's layout while data loads, so nothing jumps on arrival. */
function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        Loading profile…
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[5.5rem] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
