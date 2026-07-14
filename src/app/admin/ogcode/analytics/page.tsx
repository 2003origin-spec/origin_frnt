export const dynamic = "force-dynamic";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOgcodeAttemptTotals, getOgcodeWeeklyTerminals } from "@/server/ogcode-catalog";
import { getOgcodeTotalLivePresence } from "@/server/ogcode-presence";
import { getOgcodeLivePeakStats } from "@/server/ogcode-presence-peak";

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-bold uppercase tracking-widest">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-black tabular-nums">{value.toLocaleString()}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function AdminOgcodeAnalyticsPage() {
  const [attempts, currentLive, peak, weekly] = await Promise.all([
    getOgcodeAttemptTotals(),
    getOgcodeTotalLivePresence(),
    getOgcodeLivePeakStats(),
    getOgcodeWeeklyTerminals(8),
  ]);

  const maxWeek = Math.max(1, ...weekly.map((w) => w.count));

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OG-Code Analytics</h1>
        <p className="text-sm text-muted-foreground">Practice activity, live presence, and weekly trend.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Questions Attempted" value={attempts.distinctQuestionsAttempted} hint="Distinct questions with ≥1 attempt" />
        <StatCard label="Total Attempts" value={attempts.totalAttemptEvents} hint="Every submit across all students" />
        <StatCard label="Live Now" value={currentLive} hint="Practicing this moment" />
        <StatCard label="Peak Live (All-Time)" value={peak.allTime} hint={`Today ${peak.today} · This week ${peak.thisWeek}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Activity</CardTitle>
          <CardDescription>First-time question completions per week (last 8 weeks).</CardDescription>
        </CardHeader>
        <CardContent>
          {weekly.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ minHeight: 180 }}>
              {weekly.map((w) => {
                const pct = Math.round((w.count / maxWeek) * 100);
                const label = new Date(w.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                return (
                  <div key={w.weekStart} className="flex min-w-[44px] flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-bold tabular-nums text-foreground">{w.count.toLocaleString()}</span>
                    <div className="flex h-32 w-full items-end">
                      <div
                        className="w-full rounded-t-md bg-primary/80 transition-all"
                        style={{ height: `${Math.max(4, pct)}%` }}
                        title={`${w.count} completions`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
