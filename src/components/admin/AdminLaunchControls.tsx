"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mutateJson } from "@/lib/csrf";
import type { LaunchSettings } from "@/server/launch-settings";

function Toggle({
  label,
  desc,
  value,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${value ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

/** Convert an ISO string to the value a datetime-local input expects (local time). */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function AdminLaunchControls({ initial }: { initial: LaunchSettings }) {
  const [settings, setSettings] = useState<LaunchSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Partial<LaunchSettings>) {
    setSaving(true);
    setError(null);
    setStatus(null);
    // Optimistic
    const prev = settings;
    setSettings((s) => ({ ...s, ...patch }));
    try {
      const res = await mutateJson("/api/admin/launch", { method: "PATCH", body: JSON.stringify(patch) });
      const data = (await res.json().catch(() => ({}))) as LaunchSettings & { detail?: string };
      if (!res.ok) throw new Error(data.detail ?? "Save failed.");
      setSettings(data);
      setStatus("Saved.");
    } catch (err) {
      setSettings(prev);
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
          <CardDescription>Turn user login and signup on or off.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/40">
          <Toggle
            label="Allow Login"
            desc="When off, users cannot log in (existing sessions continue)."
            value={settings.allowLogin}
            onChange={(v) => save({ allowLogin: v })}
            disabled={saving}
          />
          <Toggle
            label="Allow Signup"
            desc="When off, new registrations (email and Google) are blocked."
            value={settings.allowSignup}
            onChange={(v) => save({ allowSignup: v })}
            disabled={saving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pre-launch Cover</CardTitle>
          <CardDescription>
            When enabled, the countdown cover hides the whole site (except this admin panel) until the launch time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            label="Show Cover Page"
            desc="Displays the launch countdown on every public URL until the launch time passes."
            value={settings.coverEnabled}
            onChange={(v) => save({ coverEnabled: v })}
            disabled={saving}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Launch date &amp; time</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={toLocalInputValue(settings.launchAt)}
                onChange={(e) => setSettings((s) => ({ ...s, launchAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ launchAt: settings.launchAt })}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Save time
              </button>
              {settings.launchAt && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save({ launchAt: null })}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              If empty or already past, the cover reveals the site automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      {status && <p className="text-xs font-bold text-emerald-600">{status}</p>}
      {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
    </div>
  );
}
