"use client";

import { useState } from "react";

/**
 * CBT teacher settings — the institute logo shown to students on the
 * post-submission thank-you screen (Origin × Institute logo). Uploads to R2 via
 * /api/cbt/teacher/logo, which also persists the URL to cbt.teachers.logo.
 */
export function CbtSettings({ initialLogo, instituteName }: { initialLogo: string | null; instituteName: string | null }) {
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/cbt/teacher/logo", { method: "POST", body: fd, credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; detail?: string };
      if (!res.ok || !data.url) throw new Error(data.detail ?? "Upload failed.");
      setLogo(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cbt/teacher/logo", { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail ?? "Failed to remove logo.");
      }
      setLogo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {instituteName ? `${instituteName} · ` : ""}Your institute branding for students.
        </p>
      </div>

      <div className="neu-raised space-y-4 rounded-2xl p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Institute Logo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Shown next to the Origin logo on the thank-you screen students see after submitting a test. PNG, JPG, WebP or GIF — up to 5 MB.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl neu-inset">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Institute logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90">
              <input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={busy} />
              {busy ? "Working…" : logo ? "Replace logo" : "Upload logo"}
            </label>
            {logo ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="rounded-xl neu-raised px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-xs font-bold text-rose-500">{error}</p> : null}
      </div>
    </div>
  );
}
