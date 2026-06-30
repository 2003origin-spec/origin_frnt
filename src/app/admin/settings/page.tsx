export const dynamic = "force-dynamic";

import Link from "next/link";
import { Siren, Database, Gauge } from "lucide-react";

import { ALL_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { getIncidentSnapshot } from "@/server/incidents";

export default async function AdminSettingsPage() {
  const snapshot = await getIncidentSnapshot();
  const flags = ALL_FLAG_KEYS.map((key) => ({
    key,
    enabled: isFeatureEnabled(key),
    override: key in snapshot.flagOverrides ? snapshot.flagOverrides[key] : null,
  }));

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">System Config</h1>
        <p className="text-sm text-muted-foreground mt-1">Live feature-flag states and incident posture. Runtime kill-switches are applied from Incidents.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3">
          <Gauge className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-sm font-black text-foreground capitalize">{snapshot.rateLimitMode}</p>
            <p className="text-xs text-muted-foreground">Rate-limit mode</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3">
          <Database className={`w-5 h-5 ${snapshot.redisConfigured ? "text-emerald-500" : "text-amber-500"}`} />
          <div>
            <p className="text-sm font-black text-foreground">{snapshot.redisConfigured ? "Connected" : "Pod-local"}</p>
            <p className="text-xs text-muted-foreground">Incident store (Redis)</p>
          </div>
        </div>
        <Link href="/admin/incidents" className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3 hover:border-rose-500/40 transition-colors">
          <Siren className="w-5 h-5 text-rose-500" />
          <div>
            <p className="text-sm font-black text-foreground">Incident controls</p>
            <p className="text-xs text-muted-foreground">Kill-switches &amp; lockdown</p>
          </div>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Feature flags</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Effective state = env override ?? launch default. A red override means a kill-switch is active.</p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {flags.map((f) => (
              <tr key={f.key} className="border-t border-border first:border-t-0">
                <td className="px-5 py-3 font-mono text-foreground">{f.key}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      f.enabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {f.enabled ? "on" : "off"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {f.override !== null && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      override: {f.override ? "on" : "killed"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
