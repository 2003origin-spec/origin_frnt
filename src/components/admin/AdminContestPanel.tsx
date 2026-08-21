'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Calendar, Trophy, Ban, Rocket } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { apiCall } from '@/lib/api';
import type { ContestRecord } from '@/server/contest/contest-admin-service';

/**
 * Admin contest builder (plan Phase 0 UI). No-deploy create → schedule → resolve
 * questions (preview) → publish, plus cancel/reschedule, over /api/admin/contest/*.
 */

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

export function AdminContestPanel({ initial }: { initial: ContestRecord[] }) {
  const [contests, setContests] = useState<ContestRecord[]>(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [subjects, setSubjects] = useState<string[]>(['Physics', 'Chemistry', 'Mathematics']);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const res = (await apiCall('/admin/contest')) as { contests: ContestRecord[] };
    setContests(res.contests ?? []);
  };

  const create = async () => {
    if (!name.trim()) return toast.error('Give the contest a name.');
    setCreating(true);
    try {
      await apiCall('/admin/contest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), subjects }),
      });
      toast.success('Contest created as a draft.');
      setName('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed.');
    } finally {
      setCreating(false);
    }
  };

  const schedule = async (c: ContestRecord) => {
    // Simple prompt-driven scheduling (a full date-picker is a follow-up polish).
    const startStr = window.prompt('Start (ISO, e.g. 2026-09-01T13:00:00Z)?');
    if (!startStr) return;
    const durMin = Number(window.prompt('Duration minutes?', '60'));
    if (!Number.isFinite(durMin) || durMin <= 0) return toast.error('Bad duration.');
    const start = new Date(startStr);
    if (Number.isNaN(start.getTime())) return toast.error('Bad start date.');
    const end = new Date(start.getTime() + durMin * 60_000);
    const regOpen = new Date(start.getTime() - 5 * 86_400_000); // default 5 days prior
    setBusy(c.id);
    try {
      await apiCall(`/admin/contest/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regOpen: regOpen.toISOString(),
          regClose: start.toISOString(),
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        }),
      });
      toast.success('Schedule set.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Schedule failed.');
    } finally {
      setBusy(null);
    }
  };

  const publish = async (c: ContestRecord) => {
    const perSubject = Number(window.prompt('Questions per subject?', '10'));
    if (!Number.isFinite(perSubject) || perSubject <= 0) return;
    setBusy(c.id);
    try {
      // Resolve a preview of the paper from OGCode (shortfall-checked server-side).
      const resolved = (await apiCall(`/admin/contest/${c.id}/questions/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections: c.subjects.map((s) => ({ subject: s, count: perSubject })) }),
      })) as { questions: unknown[]; count: number };
      if (!window.confirm(`Publish ${resolved.count} questions? This freezes the paper.`)) {
        setBusy(null);
        return;
      }
      await apiCall(`/admin/contest/${c.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: resolved.questions }),
      });
      toast.success('Contest published!');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed.');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (c: ContestRecord) => {
    if (!window.confirm(`Cancel "${c.name}"? Registrations are released.`)) return;
    setBusy(c.id);
    try {
      await apiCall(`/admin/contest/${c.id}/cancel`, { method: 'POST' });
      toast.success('Contest cancelled.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
        <Trophy className="w-6 h-6 text-amber-500" /> Weekly Contests
      </h1>

      {/* Create */}
      <div className="neu-raised rounded-2xl p-5 space-y-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New contest</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Origin Weekly #N"
          className="w-full neu-inset rounded-xl px-4 py-2.5 text-sm font-bold text-foreground bg-transparent outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => {
            const on = subjects.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSubjects((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-colors',
                  on ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
        <NeuButton onClick={create} disabled={creating} className="w-full sm:w-auto">
          <span className="inline-flex items-center gap-2 text-primary font-black text-[12px] uppercase tracking-wider">
            <Plus className="w-4 h-4" /> {creating ? 'Creating…' : 'Create draft'}
          </span>
        </NeuButton>
      </div>

      {/* List */}
      <div className="space-y-3">
        {contests.length === 0 && <div className="text-sm text-muted-foreground">No contests yet.</div>}
        {contests.map((c) => (
          <div key={c.id} className="neu-raised rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-foreground truncate">{c.name}</span>
                <StatusChip status={c.status} />
              </div>
              <div className="text-[11px] font-bold text-muted-foreground">
                {c.subjects.join(' · ')}
                {c.startAt && ` · starts ${new Date(c.startAt).toLocaleString()}`}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {c.status === 'draft' && (
                <>
                  <IconBtn onClick={() => schedule(c)} busy={busy === c.id} icon={<Calendar className="w-3.5 h-3.5" />} label="Schedule" />
                  <IconBtn onClick={() => publish(c)} busy={busy === c.id} icon={<Rocket className="w-3.5 h-3.5" />} label="Publish" primary />
                </>
              )}
              {(c.status === 'draft' || c.status === 'scheduled') && (
                <IconBtn onClick={() => cancel(c)} busy={busy === c.id} icon={<Ban className="w-3.5 h-3.5" />} label="Cancel" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-500',
    scheduled: 'bg-primary/10 text-primary',
    result_processing: 'bg-amber-500/10 text-amber-500',
    result_published: 'bg-emerald-500/10 text-emerald-500',
    archived: 'bg-slate-500/10 text-slate-400',
    cancelled: 'bg-rose-500/10 text-rose-500',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider', map[status] ?? map.draft)}>
      {status.replace('_', ' ')}
    </span>
  );
}

function IconBtn({
  onClick,
  busy,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  busy: boolean;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors',
        primary ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
      )}
    >
      {icon} {label}
    </button>
  );
}
