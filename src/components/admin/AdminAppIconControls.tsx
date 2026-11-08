'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

import { APP_ICONS, type AppIconId } from '@/lib/app-icons';
import { mutateJson } from '@/lib/csrf';

/** Pick the native app's launcher icon; talks to /api/admin/app-icon. */
export default function AdminAppIconControls({ initialIcon }: { initialIcon: AppIconId | null }) {
  const [current, setCurrent] = useState<AppIconId | null>(initialIcon);
  const [saving, setSaving] = useState<AppIconId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(icon: AppIconId) {
    if (saving || icon === current) return;
    setSaving(icon);
    setError(null);
    try {
      const res = await mutateJson('/api/admin/app-icon', { method: 'PUT', body: JSON.stringify({ icon }) });
      const data = (await res.json().catch(() => ({}))) as { icon?: AppIconId; detail?: string };
      if (!res.ok || !data.icon) throw new Error(data.detail ?? 'Could not save the app icon.');
      setCurrent(data.icon);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the app icon.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      {current === null && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          No icon chosen yet: every phone keeps the icon its app version came with.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {APP_ICONS.map((icon) => {
          const on = icon.id === current;
          return (
            <li key={icon.id}>
              <button
                type="button"
                onClick={() => choose(icon.id)}
                disabled={saving !== null}
                aria-pressed={on}
                className={`flex w-full flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                  on ? 'border-sky-500 bg-sky-500/10' : 'border-border hover:border-sky-400'
                } disabled:opacity-60`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/app-icons/${icon.id}.png`} alt="" width={88} height={88} className="rounded-[22px]" />
                <span className="text-sm font-semibold">{icon.label}</span>
                <span className="text-xs text-muted-foreground">{icon.when}</span>
                <span className="flex h-5 items-center gap-1 text-xs font-semibold text-sky-600">
                  {saving === icon.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : on ? <><Check className="h-3.5 w-3.5" /> Chosen</> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
