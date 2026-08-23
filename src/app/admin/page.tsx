export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Users,
  GraduationCap,
  Building2,
  IndianRupee,
  BadgeCheck,
  Clock,
  FileCheck2,
  CreditCard,
  ArrowRight,
  Trophy,
} from "lucide-react";

import { getAdminOverviewStats, formatInr } from "@/server/admin/overview-service";
import { listAuditEventsService } from "@/server/workspaces/admin-service";
import { isFeatureEnabled } from "@/lib/feature-flags";

function Stat({
  label,
  value,
  icon: Icon,
  href,
  accent = "emerald",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  accent?: "emerald" | "blue" | "amber" | "rose";
}) {
  const tone: Record<string, string> = {
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  };
  const body = (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-emerald-500/40 transition-colors h-full">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl border ${tone[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {href && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <h3 className="text-2xl font-black text-foreground">{value}</h3>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminDashboard() {
  const [stats, recent] = await Promise.all([
    getAdminOverviewStats(),
    listAuditEventsService({ limit: 8 }),
  ]);

  return (
    <div className="space-y-8 pb-16 max-w-7xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Mission Control</h1>
        <p className="text-sm text-muted-foreground mt-1">Live platform metrics — students, institutes, revenue, and what needs your attention.</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Stat label="Students" value={stats.students.toLocaleString("en-IN")} icon={Users} accent="blue" href="/admin/users?role=student" />
        <Stat label="Teachers" value={stats.teachers.toLocaleString("en-IN")} icon={GraduationCap} accent="blue" href="/admin/users?role=teacher" />
        <Stat label="Institutes" value={stats.institutes.toLocaleString("en-IN")} icon={Building2} accent="emerald" href="/admin/workspaces" />
        <Stat label="MRR" value={formatInr(stats.mrrMinor)} icon={IndianRupee} accent="emerald" href="/admin/financials" />
        <Stat label="Active subscriptions" value={stats.activeSubscriptions.toLocaleString("en-IN")} icon={CreditCard} accent="emerald" href="/admin/financials" />
        <Stat label="Active collaborations" value={stats.activeCollaborations.toLocaleString("en-IN")} icon={BadgeCheck} accent="emerald" href="/admin/collaborations" />
        <Stat label="Pending approvals" value={stats.pendingApprovals.toLocaleString("en-IN")} icon={Clock} accent={stats.pendingApprovals > 0 ? "amber" : "emerald"} href="/admin/collaborations" />
        <Stat label="OG-Code to review" value={stats.pendingOgcode.toLocaleString("en-IN")} icon={FileCheck2} accent={stats.pendingOgcode > 0 ? "amber" : "emerald"} href="/admin/ogcode/moderation" />
      </div>

      {/* Needs attention */}
      {(stats.pendingApprovals > 0 || stats.pendingOgcode > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.pendingApprovals > 0 && (
            <Link href="/admin/collaborations" className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 hover:bg-amber-500/10 transition-colors">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-bold text-foreground">{stats.pendingApprovals} institute{stats.pendingApprovals === 1 ? "" : "s"} awaiting approval</p>
                  <p className="text-xs text-muted-foreground">Approve to make them visible to students.</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-500" />
            </Link>
          )}
          {stats.pendingOgcode > 0 && (
            <Link href="/admin/ogcode/moderation" className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 hover:bg-amber-500/10 transition-colors">
              <div className="flex items-center gap-3">
                <FileCheck2 className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-bold text-foreground">{stats.pendingOgcode} OG-Code question{stats.pendingOgcode === 1 ? "" : "s"} to review</p>
                  <p className="text-xs text-muted-foreground">Approve to publish into the student pool.</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-500" />
            </Link>
          )}
        </div>
      )}

      {/* Manage */}
      {isFeatureEnabled("contest") && (
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">Manage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/admin/contest" className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-bold text-foreground">Weekly Contests</p>
                  <p className="text-xs text-muted-foreground">Create, schedule, review &amp; extend ORBIT-rated contests.</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Recent activity</h3>
          <Link href="/admin/audit-events" className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">Audit log</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No audit events yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 py-3">
                <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 rounded px-2 py-0.5 whitespace-nowrap">{ev.action}</span>
                <p className="text-sm text-foreground truncate flex-1">
                  {ev.actorName ?? ev.actorUserId ?? "system"}
                  {ev.workspaceName ? <span className="text-muted-foreground"> · {ev.workspaceName}</span> : null}
                </p>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{new Date(ev.createdAt).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
