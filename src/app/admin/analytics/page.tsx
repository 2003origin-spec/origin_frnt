export const dynamic = "force-dynamic";

import { Users, GraduationCap, Building2, Store, BadgeCheck } from "lucide-react";

import { getAdminOverviewStats } from "@/server/admin/overview-service";

export default async function AdminAnalyticsPage() {
  const s = await getAdminOverviewStats();
  const totalUsers = s.students + s.teachers + s.admins;
  const pct = (n: number) => (totalUsers === 0 ? 0 : Math.round((n / totalUsers) * 100));

  const roleRows = [
    { label: "Students", value: s.students, icon: Users, tone: "bg-blue-500" },
    { label: "Teachers", value: s.teachers, icon: GraduationCap, tone: "bg-emerald-500" },
    { label: "Admins", value: s.admins, icon: BadgeCheck, tone: "bg-amber-500" },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Global Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Real platform composition — accounts, workspaces, and collaboration health.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total accounts</p>
          <h3 className="text-2xl font-black text-foreground">{totalUsers.toLocaleString("en-IN")}</h3>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Institutes</p>
          <h3 className="text-2xl font-black text-foreground">{s.institutes.toLocaleString("en-IN")}</h3>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Personal teacher spaces</p>
          <h3 className="text-2xl font-black text-foreground">{s.personalWorkspaces.toLocaleString("en-IN")}</h3>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Active collaborations</p>
          <h3 className="text-2xl font-black text-foreground">{s.activeCollaborations.toLocaleString("en-IN")}</h3>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">Accounts by role</h3>
        <div className="space-y-4">
          {roleRows.map((r) => (
            <div key={r.label} className="flex items-center gap-4">
              <r.icon className="w-4 h-4 text-muted-foreground" />
              <span className="w-24 text-sm font-bold text-foreground">{r.label}</span>
              <div className="flex-1 h-3 rounded-full bg-accent overflow-hidden">
                <div className={`h-full ${r.tone} rounded-full`} style={{ width: `${pct(r.value)}%` }} />
              </div>
              <span className="w-14 text-right text-sm font-mono text-muted-foreground">{pct(r.value)}%</span>
              <span className="w-16 text-right text-sm font-bold text-foreground">{r.value.toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3">
          <Store className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-2xl font-black text-foreground">{s.activeSubscriptions.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">Active subscriptions</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-2xl font-black text-foreground">{s.pendingApprovals.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">Institutes awaiting approval</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-2xl font-black text-foreground">{s.pendingOgcode.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">OG-Code questions to review</p>
          </div>
        </div>
      </div>
    </div>
  );
}
