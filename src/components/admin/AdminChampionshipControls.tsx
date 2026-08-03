'use client';

import { useState } from 'react';
import { Trophy, Upload, Trash2, Check, Loader2 } from 'lucide-react';
import { mutateJson } from '@/lib/csrf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  initialImageUrl: string | null;
  initialLabel: string | null;
}

/**
 * Admin control for the home Monthly-Championship prize photo + label.
 * Mirrors the CBT institute-logo uploader; talks to /api/admin/championship.
 */
export default function AdminChampionshipControls({ initialImageUrl, initialLabel }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [label, setLabel] = useState(initialLabel ?? '');
  const [savedLabel, setSavedLabel] = useState(initialLabel ?? '');
  const [busy, setBusy] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelSaved, setLabelSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await mutateJson('/api/admin/championship', { method: 'POST', body: fd });
      const data = (await res.json()) as { url?: string; detail?: string };
      if (!res.ok || !data.url) throw new Error(data.detail ?? 'Upload failed.');
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await mutateJson('/api/admin/championship', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove.');
      setImageUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove.');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveLabel() {
    setLabelBusy(true);
    setLabelSaved(false);
    setError(null);
    try {
      const res = await mutateJson('/api/admin/championship', {
        method: 'PATCH',
        body: JSON.stringify({ label: label.trim() || null }),
      });
      if (!res.ok) throw new Error('Failed to save label.');
      setSavedLabel(label.trim());
      setLabelSaved(true);
      setTimeout(() => setLabelSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save label.');
    } finally {
      setLabelBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Championship Prize
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Shown on the home Monthly-Championship banner. Upload the prize photo and a short label.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Prize" className="h-full w-full object-cover" />
            ) : (
              <Trophy className="h-9 w-9 text-muted-foreground/50" />
            )}
          </div>
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {imageUrl ? 'Replace photo' : 'Upload photo'}
              <input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={busy} />
            </label>
            {imageUrl && (
              <button
                onClick={onRemove}
                disabled={busy}
                className="ml-2 inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-sm font-bold text-muted-foreground transition hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            )}
            <p className="text-xs text-muted-foreground">JPG/PNG, max 5 MB.</p>
          </div>
        </div>

        {/* Label */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground">Prize label</label>
          <div className="flex gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              placeholder="e.g. Winner merch + a founders’ letter"
              className="flex-1 rounded-xl border border-border/60 bg-background px-4 py-2 text-sm outline-none focus:border-primary/50"
            />
            <button
              onClick={onSaveLabel}
              disabled={labelBusy || label.trim() === savedLabel}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {labelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : labelSaved ? <Check className="h-4 w-4" /> : null}
              Save
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
