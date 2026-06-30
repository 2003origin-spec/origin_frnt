export const dynamic = "force-dynamic";

import Link from "next/link";
import { FileQuestion, CheckCircle2, Clock, Globe, ArrowRight } from "lucide-react";

import { getAdminContentStats } from "@/server/admin/overview-service";

export default async function AdminContentPage() {
  const c = await getAdminContentStats();

  const cards = [
    { label: "Total questions", value: c.totalQuestions, icon: FileQuestion, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Ready questions", value: c.readyQuestions, icon: CheckCircle2, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "OG-Code submitted", value: c.ogcodeSubmitted, icon: Clock, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { label: "OG-Code published", value: c.ogcodePublished, icon: Globe, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Content &amp; LMS</h1>
        <p className="text-sm text-muted-foreground mt-1">Live question-bank and OG-Code publication counts across all workspaces.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-2xl p-5">
            <div className={`p-2.5 rounded-xl border w-fit mb-3 ${card.tone}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{card.label}</p>
            <h3 className="text-2xl font-black text-foreground">{card.value.toLocaleString("en-IN")}</h3>
          </div>
        ))}
      </div>

      <Link href="/admin/ogcode/moderation" className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 hover:border-emerald-500/40 transition-colors">
        <div>
          <p className="font-bold text-foreground">Moderate OG-Code submissions</p>
          <p className="text-xs text-muted-foreground">Approve coaching-center questions into the student OG-Code pool.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </div>
  );
}
