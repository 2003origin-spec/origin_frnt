'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trophy, Ban, Rocket, Loader2, ChevronDown, Eye, Save, Pencil } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { apiCall } from '@/lib/api';
import { formatIST, istLocalToUtcIso, utcIsoToIstLocal } from '@/lib/contest/ist';
import type { ContestRecord } from '@/server/contest/contest-admin-service';

/**
 * Admin contest builder — a single in-page form (no browser prompts). Select
 * everything once (name → subjects → per-subject topics + question counts →
 * schedule in IST) → save draft → preview the resolved paper → publish. Times are
 * entered and displayed in IST throughout; the DB stores UTC.
 */

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const REG_LEAD_DAYS = 5; // registration opens this many days before start by default

interface BuilderState {
  id: string | null; // set once saved as a draft
  name: string;
  subjects: string[];
  topics: Record<string, string[]>;
  counts: Record<string, number>;
  startLocal: string; // datetime-local, IST wall time
  durationMin: number;
  regOpenLocal: string; // datetime-local, IST wall time
}

const emptyBuilder = (): BuilderState => ({
  id: null,
  name: '',
  subjects: ['Physics', 'Chemistry', 'Mathematics'],
  topics: {},
  counts: {},
  startLocal: '',
  durationMin: 60,
  regOpenLocal: '',
});

export function AdminContestPanel({ initial }: { initial: ContestRecord[] }) {
  const [contests, setContests] = useState<ContestRecord[]>(initial);
  const [b, setB] = useState<BuilderState>(emptyBuilder());
  const [chapters, setChapters] = useState<Record<string, string[]>>({});
  const [loadingChapters, setLoadingChapters] = useState<Record<string, boolean>>({});
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ count: number; questions: unknown[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // action label while running
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const set = <K extends keyof BuilderState>(k: K, v: BuilderState[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  const refresh = useCallback(async () => {
    const res = (await apiCall('/admin/contest')) as { contests: ContestRecord[] };
    setContests(res.contests ?? []);
  }, []);

  // Lazy-load chapters for a subject the first time it's expanded.
  const loadChapters = useCallback(
    async (subject: string) => {
      if (chapters[subject] || loadingChapters[subject]) return;
      setLoadingChapters((p) => ({ ...p, [subject]: true }));
      try {
        const res = (await apiCall(`/admin/contest/chapters?subject=${encodeURIComponent(subject)}`)) as {
          chapters: string[];
        };
        setChapters((p) => ({ ...p, [subject]: res.chapters ?? [] }));
      } catch {
        setChapters((p) => ({ ...p, [subject]: [] }));
        toast.error(`Couldn't load ${subject} topics.`);
      } finally {
        setLoadingChapters((p) => ({ ...p, [subject]: false }));
      }
    },
    [chapters, loadingChapters],
  );

  useEffect(() => {
    if (expandedSubject) void loadChapters(expandedSubject);
  }, [expandedSubject, loadChapters]);

  const toggleSubject = (s: string) => {
    setPreview(null);
    setB((prev) => {
      const on = prev.subjects.includes(s);
      const subjects = on ? prev.subjects.filter((x) => x !== s) : [...prev.subjects, s];
      const topics = { ...prev.topics };
      const counts = { ...prev.counts };
      if (on) {
        delete topics[s];
        delete counts[s];
      }
      return { ...prev, subjects, topics, counts };
    });
  };

  const toggleTopic = (subject: string, chapter: string) => {
    setPreview(null);
    setB((prev) => {
      const cur = prev.topics[subject] ?? [];
      const next = cur.includes(chapter) ? cur.filter((c) => c !== chapter) : [...cur, chapter];
      return { ...prev, topics: { ...prev.topics, [subject]: next } };
    });
  };

  const countFor = (s: string) => b.counts[s] ?? 10;

  // Build the schedule ISO windows (UTC) from the IST inputs.
  const buildSchedule = () => {
    const startIso = istLocalToUtcIso(b.startLocal);
    if (!startIso) return { error: 'Set a valid start date & time (IST).' } as const;
    if (!Number.isFinite(b.durationMin) || b.durationMin <= 0) return { error: 'Set a valid duration.' } as const;
    const startMs = new Date(startIso).getTime();
    if (startMs <= Date.now()) return { error: 'Start time must be in the future.' } as const;
    const endIso = new Date(startMs + b.durationMin * 60_000).toISOString();
    const regOpenIso = b.regOpenLocal
      ? istLocalToUtcIso(b.regOpenLocal)
      : new Date(startMs - REG_LEAD_DAYS * 86_400_000).toISOString();
    if (!regOpenIso || new Date(regOpenIso).getTime() >= startMs) {
      return { error: 'Registration must open before the start time.' } as const;
    }
    return { regOpen: regOpenIso, regClose: startIso, startAt: startIso, endAt: endIso } as const;
  };

  const validateBasics = () => {
    if (!b.name.trim()) return 'Give the contest a name.';
    if (b.subjects.length === 0) return 'Pick at least one subject.';
    return null;
  };

  // Create (or update) the draft with name/subjects/topics + schedule.
  const saveDraft = async (): Promise<string | null> => {
    const basicsErr = validateBasics();
    if (basicsErr) {
      toast.error(basicsErr);
      return null;
    }
    const sched = buildSchedule();
    if ('error' in sched) {
      toast.error(sched.error);
      return null;
    }
    setBusy('save');
    try {
      let id = b.id;
      if (!id) {
        const created = (await apiCall('/admin/contest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: b.name.trim(), subjects: b.subjects, topics: b.topics }),
        })) as { contest: ContestRecord };
        id = created.contest.id;
      }
      await apiCall(`/admin/contest/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: b.name.trim(), subjects: b.subjects, topics: b.topics, ...sched }),
      });
      set('id', id);
      toast.success('Draft saved.');
      await refresh();
      return id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
      return null;
    } finally {
      setBusy(null);
    }
  };

  // Resolve a preview of the paper (shortfall-checked server-side).
  const previewPaper = async () => {
    const id = b.id ?? (await saveDraft());
    if (!id) return;
    setBusy('preview');
    try {
      const selections = b.subjects.map((s) => ({
        subject: s,
        count: countFor(s),
        topics: (b.topics[s] ?? []).length ? b.topics[s] : undefined,
      }));
      const resolved = (await apiCall(`/admin/contest/${id}/questions/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })) as { questions: unknown[]; count: number };
      setPreview(resolved);
      toast.success(`Resolved ${resolved.count} questions.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed — not enough questions for a topic.');
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!b.id || !preview) return;
    setBusy('publish');
    try {
      await apiCall(`/admin/contest/${b.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: preview.questions }),
      });
      toast.success('Contest published! It will go live at the scheduled time.');
      setB(emptyBuilder());
      setPreview(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed.');
    } finally {
      setBusy(null);
    }
  };

  const editDraft = (c: ContestRecord) => {
    setPreview(null);
    const durationMin = c.startAt && c.endAt
      ? Math.round((new Date(c.endAt).getTime() - new Date(c.startAt).getTime()) / 60_000)
      : 60;
    setB({
      id: c.id,
      name: c.name,
      subjects: c.subjects,
      topics: c.topics ?? {},
      counts: {},
      startLocal: utcIsoToIstLocal(c.startAt),
      durationMin,
      regOpenLocal: utcIsoToIstLocal(c.regOpen),
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancel = async (c: ContestRecord) => {
    setRowBusy(c.id);
    try {
      await apiCall(`/admin/contest/${c.id}/cancel`, { method: 'POST' });
      toast.success('Contest cancelled.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed.');
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
        <Trophy className="w-6 h-6 text-amber-500" /> Weekly Contests
      </h1>

      {/* ── Builder ─────────────────────────────────────────────────────── */}
      <div className="neu-raised rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {b.id ? 'Editing draft' : 'New contest'}
          </div>
          {b.id && (
            <button
              type="button"
              onClick={() => { setB(emptyBuilder()); setPreview(null); }}
              className="text-[11px] font-black uppercase tracking-wider text-primary"
            >
              Start fresh
            </button>
          )}
        </div>

        {/* Name */}
        <Field label="Contest name">
          <input
            value={b.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Origin Weekly #1"
            className="w-full neu-inset rounded-xl px-4 py-3 text-sm font-bold text-foreground bg-transparent outline-none min-h-[44px]"
          />
        </Field>

        {/* Subjects */}
        <Field label="Subjects">
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => {
              const on = b.subjects.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSubject(s)}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider transition-colors min-h-[40px]',
                    on ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Per-subject topics + counts */}
        {b.subjects.length > 0 && (
          <Field label="Topics & question count (per subject)">
            <div className="space-y-2">
              {b.subjects.map((s) => {
                const picked = b.topics[s] ?? [];
                const expanded = expandedSubject === s;
                const list = chapters[s] ?? [];
                return (
                  <div key={s} className="neu-inset rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedSubject(expanded ? null : s)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform', expanded && 'rotate-180')} />
                        <span className="text-sm font-black text-foreground">{s}</span>
                        <span className="text-[10px] font-bold text-muted-foreground truncate">
                          {picked.length ? `${picked.length} topics` : 'all topics'}
                        </span>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Qs</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={countFor(s)}
                          onChange={(e) => { setPreview(null); setB((p) => ({ ...p, counts: { ...p.counts, [s]: Math.max(1, Number(e.target.value) || 1) } })); }}
                          className="w-16 neu-raised rounded-lg px-2 py-1.5 text-sm font-black text-foreground bg-transparent outline-none text-center tabular-nums"
                        />
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        {loadingChapters[s] ? (
                          <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading topics…
                          </div>
                        ) : list.length === 0 ? (
                          <div className="text-[11px] text-muted-foreground py-1">No topics found for {s}.</div>
                        ) : (
                          <>
                            <div className="text-[10px] font-bold text-muted-foreground mb-2">
                              Leave all unchecked to draw from the whole subject.
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                              {list.map((ch) => {
                                const on = picked.includes(ch);
                                return (
                                  <button
                                    key={ch}
                                    type="button"
                                    onClick={() => toggleTopic(s, ch)}
                                    className={cn(
                                      'px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
                                      on ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
                                    )}
                                  >
                                    {ch}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Field>
        )}

        {/* Schedule (IST) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Starts at (IST)">
            <input
              type="datetime-local"
              value={b.startLocal}
              onChange={(e) => { setPreview(null); set('startLocal', e.target.value); }}
              className="w-full neu-inset rounded-xl px-3 py-3 text-sm font-bold text-foreground bg-transparent outline-none min-h-[44px]"
            />
          </Field>
          <Field label="Duration (minutes)">
            <input
              type="number"
              min={1}
              value={b.durationMin}
              onChange={(e) => { setPreview(null); set('durationMin', Math.max(1, Number(e.target.value) || 1)); }}
              className="w-full neu-inset rounded-xl px-3 py-3 text-sm font-bold text-foreground bg-transparent outline-none min-h-[44px] tabular-nums"
            />
          </Field>
          <Field label={`Registration opens (IST) · default ${REG_LEAD_DAYS}d before`}>
            <input
              type="datetime-local"
              value={b.regOpenLocal}
              onChange={(e) => set('regOpenLocal', e.target.value)}
              className="w-full neu-inset rounded-xl px-3 py-3 text-sm font-bold text-foreground bg-transparent outline-none min-h-[44px]"
            />
          </Field>
        </div>

        {/* Live schedule echo in IST */}
        {b.startLocal && (
          <div className="text-[11px] font-bold text-muted-foreground">
            {(() => {
              const s = buildSchedule();
              if ('error' in s) return <span className="text-rose-500">{s.error}</span>;
              return (
                <>
                  Live {formatIST(s.startAt)} → {formatIST(s.endAt)} · registration opens {formatIST(s.regOpen)}
                </>
              );
            })()}
          </div>
        )}

        {/* Preview result */}
        {preview && (
          <div className="neu-inset rounded-xl p-3 text-[12px] font-bold text-foreground">
            Resolved <span className="text-primary font-black">{preview.count}</span> questions across{' '}
            {b.subjects.join(' · ')}. Publishing freezes this paper.
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <NeuButton onClick={saveDraft} disabled={!!busy}>
            <span className="inline-flex items-center gap-2 text-foreground font-black text-[12px] uppercase tracking-wider">
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {b.id ? 'Update draft' : 'Save draft'}
            </span>
          </NeuButton>
          <NeuButton onClick={previewPaper} disabled={!!busy}>
            <span className="inline-flex items-center gap-2 text-foreground font-black text-[12px] uppercase tracking-wider">
              {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Preview paper
            </span>
          </NeuButton>
          <NeuButton onClick={publish} disabled={!!busy || !preview}>
            <span className={cn('inline-flex items-center gap-2 font-black text-[12px] uppercase tracking-wider', preview ? 'text-primary' : 'text-muted-foreground/50')}>
              {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Publish contest
            </span>
          </NeuButton>
        </div>
        {!preview && (
          <p className="text-[10px] font-bold text-muted-foreground">Preview the paper to enable publishing.</p>
        )}
      </div>

      {/* ── Existing contests ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Plus className="w-3 h-3" /> All contests
        </div>
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
                {c.startAt && ` · ${formatIST(c.startAt)}`}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {c.status === 'draft' && (
                <IconBtn onClick={() => editDraft(c)} busy={rowBusy === c.id} icon={<Pencil className="w-3.5 h-3.5" />} label="Edit" primary />
              )}
              {(c.status === 'draft' || c.status === 'scheduled') && (
                <IconBtn onClick={() => cancel(c)} busy={rowBusy === c.id} icon={<Ban className="w-3.5 h-3.5" />} label="Cancel" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
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
        'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors min-h-[40px] disabled:opacity-50',
        primary ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon} {label}
    </button>
  );
}
