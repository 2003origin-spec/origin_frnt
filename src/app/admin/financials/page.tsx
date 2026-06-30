export const dynamic = "force-dynamic";

import Link from "next/link";
import { IndianRupee, CreditCard, ShoppingCart, ArrowRight } from "lucide-react";

import { getAdminFinancials, formatInr } from "@/server/admin/overview-service";

const SUBJECT_LABEL: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  mathematics: "Mathematics",
  biology: "Biology",
};

export default async function AdminFinancialsPage() {
  const fin = await getAdminFinancials();
  const maxSubs = Math.max(1, ...fin.bySubject.map((s) => s.subs));

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Financials</h1>
          <p className="text-sm text-muted-foreground mt-1">Live revenue from platform subscriptions and institute enrollments (INR).</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/pricing" className="rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent transition-colors">Manage pricing</Link>
          <Link href="/admin/coupons" className="rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent transition-colors">Coupons</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 w-fit mb-3"><IndianRupee className="w-5 h-5" /></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Monthly recurring revenue</p>
          <h3 className="text-2xl font-black text-foreground">{formatInr(fin.mrrMinor)}</h3>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500 w-fit mb-3"><CreditCard className="w-5 h-5" /></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Active subscriptions</p>
          <h3 className="text-2xl font-black text-foreground">{fin.activeSubscriptions.toLocaleString("en-IN")}</h3>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 w-fit mb-3"><ShoppingCart className="w-5 h-5" /></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Institute enrollments (paid)</p>
          <h3 className="text-2xl font-black text-foreground">{formatInr(fin.paidOrdersMinor)}</h3>
          <p className="text-xs text-muted-foreground mt-1">{fin.paidOrders.toLocaleString("en-IN")} order{fin.paidOrders === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-4">Subscriptions by subject</h3>
        {fin.bySubject.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No active subscriptions yet.</p>
        ) : (
          <div className="space-y-3">
            {fin.bySubject.map((s) => (
              <div key={s.subject} className="flex items-center gap-4">
                <span className="w-28 text-sm font-bold text-foreground">{SUBJECT_LABEL[s.subject] ?? s.subject}</span>
                <div className="flex-1 h-3 rounded-full bg-accent overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.subs / maxSubs) * 100}%` }} />
                </div>
                <span className="w-16 text-right text-sm font-mono text-muted-foreground">{s.subs}</span>
                <span className="w-24 text-right text-sm font-bold text-foreground">{formatInr(s.mrrMinor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link href="/admin/pricing" className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 hover:border-emerald-500/40 transition-colors">
        <div>
          <p className="font-bold text-foreground">Set subject &amp; bundle pricing</p>
          <p className="text-xs text-muted-foreground">Change the ₹/subject price or configure a bundle offer.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </div>
  );
}
