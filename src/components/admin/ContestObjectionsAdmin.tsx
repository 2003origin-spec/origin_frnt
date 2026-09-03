'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { apiCall } from '@/lib/api';

interface Objection {
  id: string; position: number; reason: string; status: 'open' | 'accepted' | 'rejected'; authorName: string; createdAt: string;
}

export function ContestObjectionsAdmin({ contestId, initial }: { contestId: string; initial: Objection[] }) {
  const [objections, setObjections] = useState<Objection[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (o: Objection, action: 'accept' | 'reject') => {
    let newCorrectOption: number | undefined;
    if (action === 'accept') {
      const entered = window.prompt(`New CORRECT option index for Q${o.position + 1} (0 = A, 1 = B, …). This re-grades the question and re-ranks the contest.`);
      if (entered === null) return;
      newCorrectOption = Number(entered);
      if (!Number.isInteger(newCorrectOption) || newCorrectOption < 0) { toast.error('Enter a valid option index.'); return; }
    }
    setBusy(o.id);
    try {
      const res = (await apiCall(`/admin/contest/${contestId}/objections`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectionId: o.id, action, newCorrectOption }),
      })) as { regraded?: number };
      setObjections((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: action === 'accept' ? 'accepted' : 'rejected' } : x)));
      toast.success(action === 'accept' ? `Accepted — re-graded ${res.regraded ?? 0} attempts and re-ranked.` : 'Objection rejected.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not resolve.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Answer-key objections</h1>
        <Link href="/admin/contest" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"><ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Contests</Link>
      </div>
      {objections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No objections filed.</p>
      ) : (
        <ul className="space-y-3">
          {objections.map((o) => (
            <li key={o.id} className="rounded-2xl border border-border/40 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-primary">Q{o.position + 1} · {o.authorName}</span>
                <span className={`text-[11px] font-bold ${o.status === 'open' ? 'text-amber-500' : o.status === 'accepted' ? 'text-emerald-500' : 'text-muted-foreground'}`}>{o.status}</span>
              </div>
              <p className="text-sm text-foreground mb-2">{o.reason}</p>
              {o.status === 'open' && (
                <div className="flex gap-2">
                  <button type="button" disabled={busy === o.id} onClick={() => resolve(o, 'accept')} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Accept & re-grade</button>
                  <button type="button" disabled={busy === o.id} onClick={() => resolve(o, 'reject')} className="rounded-lg px-3 py-1.5 text-xs font-black uppercase text-muted-foreground hover:bg-muted disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Reject</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
