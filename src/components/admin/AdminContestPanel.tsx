'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus, Trophy, Ban, Rocket, Loader2, ChevronDown, Eye, Save, Pencil, Trash2, RefreshCw, Clock, BarChart3, ShieldAlert, Copy, Repeat, FileUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NeuButton } from '@/components/ui/neu';
import { LatexRenderer } from '@/components/ui/LatexRenderer';
import { apiCall } from '@/lib/api';
import { formatIST, istLocalToUtcIso, utcIsoToIstLocal } from '@/lib/contest/ist';
import type { ContestRecord } from '@/server/contest/contest-admin-service';
import type { ContestAnalytics } from '@/server/contest/contest-analytics-service';
import type { FlaggedAttempt } from '@/server/contest/contest-review-service';
import type { ContestSchedule } from '@/server/contest/contest-schedule-service';

/** One resolved question as returned by the /questions/resolve preview. The
 *  snapshot carries the renderable stem/options (+ the answer key, which the
 *  admin is allowed to see for review). */
interface ResolvedQuestion {
  questionId: string;
  subject?: string | null;
  snapshot: {
    text?: string;
    options?: string[] | null;
    image?: string | null;
    optionImages?: (string | null)[] | null;
    correctOption?: number | null;
    correctOptions?: number[] | null;
    explanation?: string;
    chapter?: string;
    difficulty?: string;
  };
}

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
  types: Record<string, string[]>; // per-subject question types (default ['mcq'])
  accessMode: 'open' | 'code' | 'premium';
  registrationCap: number | null;
  startLocal: string; // datetime-local, IST wall time
  durationMin: number;
  regOpenLocal: string; // datetime-local, IST wall time
}

/** Question types a contest paper can draw (gated by contestQuestionTypes). */
const CONTEST_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'msq', label: 'MSQ (multi)' },
  { value: 'numerical', label: 'Numerical' },
];

const emptyBuilder = (): BuilderState => ({
  id: null,
  name: '',
  subjects: ['Physics', 'Chemistry', 'Mathematics'],
  topics: {},
  counts: {},
  types: {},
  accessMode: 'open',
  registrationCap: null,
  startLocal: '',
  durationMin: 60,
  regOpenLocal: '',
});

export function AdminContestPanel({ initial, questionTypesEnabled = false }: { initial: ContestRecord[]; questionTypesEnabled?: boolean }) {
  const [contests, setContests] = useState<ContestRecord[]>(initial);
  const [b, setB] = useState<BuilderState>(emptyBuilder());
  const [chapters, setChapters] = useState<Record<string, string[]>>({});
  const [loadingChapters, setLoadingChapters] = useState<Record<string, boolean>>({});
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ count: number; questions: ResolvedQuestion[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // action label while running
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [cadenceDays, setCadenceDays] = useState(7);
  const [schedules, setSchedules] = useState<ContestSchedule[]>([]);

  const set = <K extends keyof BuilderState>(k: K, v: BuilderState[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  const loadSchedules = useCallback(async () => {
    try {
      const res = (await apiCall('/admin/contest/schedules')) as { schedules: ContestSchedule[] };
      setSchedules(res.schedules ?? []);
    } catch { /* non-fatal */ }
  }, []);
  useEffect(() => { void loadSchedules(); }, [loadSchedules]);

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
  // Per-subject question types; default MCQ-only (historical behaviour). Only
  // surfaced when the contestQuestionTypes flag is on.
  const typesFor = (s: string): string[] => {
    const t = b.types[s];
    return t && t.length ? t : ['mcq'];
  };
  const toggleType = (subject: string, type: string) => {
    setPreview(null);
    setB((p) => {
      const cur = new Set(p.types[subject] ?? ['mcq']);
      if (cur.has(type)) cur.delete(type);
      else cur.add(type);
      if (cur.size === 0) cur.add('mcq'); // never empty
      return { ...p, types: { ...p.types, [subject]: [...cur] } };
    });
  };

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
        body: JSON.stringify({
          name: b.name.trim(), subjects: b.subjects, topics: b.topics, ...sched,
          accessMode: b.accessMode,
          registrationCap: b.registrationCap && b.registrationCap > 0 ? b.registrationCap : null,
        }),
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
        types: questionTypesEnabled ? typesFor(s) : undefined,
      }));
      const resolved = (await apiCall(`/admin/contest/${id}/questions/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })) as { questions: ResolvedQuestion[]; count: number };
      setPreview(resolved);
      toast.success(`Resolved ${resolved.count} questions.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed — not enough questions for a topic.');
    } finally {
      setBusy(null);
    }
  };

  // Remove a question from the preview paper (publishing freezes the remainder).
  const deleteQuestion = (index: number) => {
    setPreview((prev) =>
      prev ? { questions: prev.questions.filter((_, i) => i !== index), count: prev.questions.length - 1 } : prev,
    );
  };

  // Swap one question for a fresh one on the same subject/topic (never a dup).
  const [replacing, setReplacing] = useState<number | null>(null);
  const replaceQuestion = async (index: number) => {
    if (!b.id || !preview) return;
    const q = preview.questions[index];
    const subject = q.subject ?? '';
    if (!subject) return;
    setReplacing(index);
    try {
      const excludeIds = preview.questions.map((x) => x.questionId);
      const res = (await apiCall(`/admin/contest/${b.id}/questions/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topics: b.topics[subject] ?? undefined, excludeIds }),
      })) as { question: ResolvedQuestion };
      setPreview((prev) => {
        if (!prev) return prev;
        const questions = [...prev.questions];
        questions[index] = res.question;
        return { ...prev, questions };
      });
      toast.success('Question swapped.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No replacement available.');
    } finally {
      setReplacing(null);
    }
  };

  const publish = async () => {
    if (!b.id || !preview || preview.questions.length === 0) return;
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

  // ── Direct-attach: hand-pick imported (file-generated) questions ───────────
  const [importPickerOpen, setImportPickerOpen] = useState(false);
  const [importBank, setImportBank] = useState<ResolvedQuestion[] | null>(null);
  const [importSel, setImportSel] = useState<Set<string>>(() => new Set());
  const [importLoading, setImportLoading] = useState(false);

  const openImportPicker = async () => {
    setImportPickerOpen((v) => !v);
    if (importBank || importLoading) return;
    setImportLoading(true);
    try {
      const data = (await apiCall('/admin/contest/import-questions')) as { questions: ResolvedQuestion[] };
      setImportBank(data.questions ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load imported questions.');
      setImportBank([]);
    } finally {
      setImportLoading(false);
    }
  };

  const toggleImportSel = (id: string) =>
    setImportSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Append the chosen imported questions to the preview paper (dedup by id).
  // Works even before a resolve — the admin can build a paper from imports alone.
  const addSelectedImports = () => {
    if (!importBank || importSel.size === 0) return;
    const chosen = importBank.filter((q) => importSel.has(q.questionId));
    setPreview((prev) => {
      const existing = prev?.questions ?? [];
      const existingIds = new Set(existing.map((q) => q.questionId));
      const merged = [...existing, ...chosen.filter((q) => !existingIds.has(q.questionId))];
      return { count: merged.length, questions: merged };
    });
    setImportSel(new Set());
    toast.success(`Added ${chosen.length} imported question(s) to the paper.`);
  };

  // Turn the current builder config into a RECURRING schedule (auto-publishes
  // every `cadenceDays`, first occurrence = the builder's start time).
  const createRecurring = async () => {
    const basicsErr = validateBasics();
    if (basicsErr) return toast.error(basicsErr);
    const firstStart = istLocalToUtcIso(b.startLocal);
    if (!firstStart) return toast.error('Set a valid first start date & time (IST).');
    if (new Date(firstStart).getTime() <= Date.now()) return toast.error('First start must be in the future.');
    if (!Number.isFinite(b.durationMin) || b.durationMin <= 0) return toast.error('Set a valid duration.');
    setBusy('recurring');
    try {
      await apiCall('/admin/contest/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: b.name.trim(),
          subjects: b.subjects,
          topics: b.topics,
          selections: b.subjects.map((s) => ({ subject: s, count: countFor(s), topics: (b.topics[s] ?? []).length ? b.topics[s] : undefined, types: questionTypesEnabled ? typesFor(s) : undefined })),
          durationMinutes: b.durationMin,
          cadenceDays,
          firstStartAt: firstStart,
        }),
      });
      toast.success(`Recurring schedule created — a new "${b.name.trim()}" every ${cadenceDays} days.`);
      await loadSchedules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the schedule.');
    } finally {
      setBusy(null);
    }
  };

  const toggleSchedule = async (sc: ContestSchedule) => {
    setRowBusy(sc.id);
    try {
      await apiCall(`/admin/contest/schedules/${sc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !sc.active }) });
      await loadSchedules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed.');
    } finally { setRowBusy(null); }
  };
  const deleteSchedule = async (sc: ContestSchedule) => {
    if (!window.confirm(`Delete the recurring schedule "${sc.name}"?`)) return;
    setRowBusy(sc.id);
    try {
      await apiCall(`/admin/contest/schedules/${sc.id}`, { method: 'DELETE' });
      await loadSchedules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed.');
    } finally { setRowBusy(null); }
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
      types: {},
      accessMode: c.accessMode ?? 'open',
      registrationCap: c.registrationCap ?? null,
      startLocal: utcIsoToIstLocal(c.startAt),
      durationMin,
      regOpenLocal: utcIsoToIstLocal(c.regOpen),
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancel = async (c: ContestRecord) => {
    if (!window.confirm(`Cancel "${c.name}"? Registrations are released and it won't run.`)) return;
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

  // Incident control: extend a live contest's deadline for everyone.
  const [extendOpen, setExtendOpen] = useState<string | null>(null);
  const extend = async (c: ContestRecord, minutes: number) => {
    setRowBusy(c.id);
    try {
      await apiCall(`/admin/contest/${c.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMinutes: minutes }),
      });
      toast.success(`Extended by ${minutes} min — everyone's clock moved.`);
      setExtendOpen(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Extend failed.');
    } finally {
      setRowBusy(null);
    }
  };

  const isLiveNow = (c: ContestRecord) => {
    if (c.status !== 'scheduled' || !c.startAt || !c.endAt) return false;
    const now = Date.now();
    return new Date(c.startAt).getTime() <= now && now < new Date(c.endAt).getTime();
  };

  // Anti-cheat review: list flagged attempts + clear/uphold (the API recomputes
  // ranking/ORBIT on a post-publish decision).
  const [reviewOpen, setReviewOpen] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<FlaggedAttempt[] | null>(null);
  const openReview = async (c: ContestRecord) => {
    if (reviewOpen === c.id) { setReviewOpen(null); return; }
    setReviewOpen(c.id);
    setFlagged(null);
    try {
      const res = (await apiCall(`/admin/contest/${c.id}/review`)) as { flagged: FlaggedAttempt[] };
      setFlagged(res.flagged ?? []);
    } catch {
      setFlagged([]);
      toast.error('Could not load flagged attempts.');
    }
  };
  const resolveFlag = async (contestId: string, userId: string, action: 'clear' | 'uphold') => {
    setRowBusy(contestId);
    try {
      await apiCall(`/admin/contest/${contestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      toast.success(action === 'clear' ? 'Cleared — attempt re-enters ranking.' : 'Upheld — attempt disqualified.');
      setFlagged((prev) => (prev ? prev.filter((f) => f.userId !== userId) : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setRowBusy(null);
    }
  };
  // Clone: duplicate a contest's config into a fresh draft (fast weekly re-run).
  const clone = async (c: ContestRecord) => {
    setRowBusy(c.id);
    try {
      await apiCall(`/admin/contest/${c.id}/clone`, { method: 'POST' });
      toast.success(`Cloned "${c.name}" — set a new schedule on the draft.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Clone failed.');
    } finally {
      setRowBusy(null);
    }
  };

  // Review is meaningful once a contest has run (ended / processing / published).
  const canReview = (c: ContestRecord) =>
    c.status === 'result_processing' || c.status === 'result_published' || c.status === 'archived' ||
    (c.status === 'scheduled' && !!c.endAt && new Date(c.endAt).getTime() <= Date.now());

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" /> Weekly Contests
        </h1>
        <Link
          href="/admin/contest/import"
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <FileUp className="w-4 h-4" /> Import questions
        </Link>
      </div>

      {/* ── Metrics (funnel + retention) ────────────────────────────────── */}
      <ContestMetrics />

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

        {/* Access & eligibility */}
        <Field label="Access & registration">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {([
                { v: 'open', l: 'Open to all' },
                { v: 'code', l: 'Access code' },
                { v: 'premium', l: 'Premium only' },
              ] as const).map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => set('accessMode', m.v)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider transition-colors min-h-[40px]',
                    b.accessMode === m.v ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
                  )}
                >
                  {m.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-muted-foreground">Seat cap (blank = unlimited)</label>
              <input
                type="number"
                min={1}
                value={b.registrationCap ?? ''}
                onChange={(e) => set('registrationCap', e.target.value ? Math.max(1, Number(e.target.value)) : null)}
                placeholder="∞"
                className="w-24 neu-raised rounded-lg px-2 py-1.5 text-sm font-black text-foreground bg-transparent outline-none text-center tabular-nums"
              />
              <span className="text-[10px] text-muted-foreground">overflow → waitlist</span>
            </div>
            {b.accessMode === 'code' && b.id && (
              <AccessCodesManager contestId={b.id} />
            )}
            {b.accessMode === 'code' && !b.id && (
              <p className="text-[11px] text-muted-foreground">Save the draft first, then generate access codes here.</p>
            )}
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

                    {expanded && questionTypesEnabled && (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <div className="text-[10px] font-bold text-muted-foreground mb-2">
                          Question types (the count is split across the selected types)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {CONTEST_TYPE_OPTIONS.map((t) => {
                            const on = typesFor(s).includes(t.value);
                            return (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => toggleType(s, t.value)}
                                className={cn(
                                  'px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
                                  on ? 'bg-primary text-white' : 'neu-raised text-muted-foreground',
                                )}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

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

        {/* Preview result — the actual resolved questions, reviewable before publish */}
        {preview && (
          <div className="space-y-3">
            <div className="neu-inset rounded-xl p-3 text-[12px] font-bold text-foreground">
              Resolved <span className="text-primary font-black">{preview.count}</span> questions across{' '}
              {b.subjects.join(' · ')}. Review below — publishing freezes this paper.
            </div>
            <div className="max-h-[32rem] overflow-y-auto space-y-3 pr-1">
              {preview.questions.map((q, qi) => (
                <QuestionPreview
                  key={q.questionId ?? qi}
                  q={q}
                  index={qi}
                  busy={replacing === qi}
                  onDelete={() => deleteQuestion(qi)}
                  onReplace={() => void replaceQuestion(qi)}
                />
              ))}
              {preview.questions.length === 0 && (
                <div className="text-[12px] font-bold text-rose-500">
                  You removed every question — add subjects/counts and preview again before publishing.
                </div>
              )}
            </div>
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
          <NeuButton onClick={publish} disabled={!!busy || !preview || preview.questions.length === 0}>
            <span className={cn('inline-flex items-center gap-2 font-black text-[12px] uppercase tracking-wider', preview ? 'text-primary' : 'text-muted-foreground/50')}>
              {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Publish contest
            </span>
          </NeuButton>
        </div>
        {!preview && (
          <p className="text-[10px] font-bold text-muted-foreground">Preview the paper to enable publishing.</p>
        )}

        {/* Direct-attach: hand-pick imported (file-generated) questions into the paper */}
        <div className="pt-3 border-t border-border/40 space-y-2">
          <button
            type="button"
            onClick={openImportPicker}
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            <FileUp className="w-4 h-4" /> {importPickerOpen ? 'Hide' : 'Add'} imported questions
          </button>
          {importPickerOpen && (
            <div className="neu-inset rounded-xl p-3 space-y-2">
              {importLoading ? (
                <p className="text-[12px] text-muted-foreground">Loading…</p>
              ) : !importBank || importBank.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  No imported questions yet.{' '}
                  <Link href="/admin/contest/import" className="text-primary underline">Import from a file</Link>.
                </p>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {importBank.map((q) => (
                      <label key={q.questionId} className="flex items-start gap-2 text-[12px] text-foreground">
                        <input
                          type="checkbox"
                          checked={importSel.has(q.questionId)}
                          onChange={() => toggleImportSel(q.questionId)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="text-muted-foreground">
                            [{q.subject ?? '—'}{q.snapshot.chapter ? ` · ${q.snapshot.chapter}` : ''}]
                          </span>{' '}
                          {(q.snapshot.text ?? '').slice(0, 120) || '(no text)'}
                        </span>
                      </label>
                    ))}
                  </div>
                  <NeuButton onClick={addSelectedImports} disabled={importSel.size === 0}>
                    <span className="inline-flex items-center gap-2 text-foreground font-black text-[12px] uppercase tracking-wider">
                      <Plus className="w-4 h-4" /> Add {importSel.size || ''} to paper
                    </span>
                  </NeuButton>
                </>
              )}
            </div>
          )}
        </div>

        {/* Auto-schedule: turn this config into a recurring contest */}
        <div className="pt-3 border-t border-border/40 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Or automate</span>
          <label className="text-[11px] font-bold text-muted-foreground">every</label>
          <input
            type="number"
            min={1}
            max={90}
            value={cadenceDays}
            onChange={(e) => setCadenceDays(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 neu-inset rounded-lg px-2 py-1.5 text-sm font-black text-foreground bg-transparent outline-none text-center tabular-nums"
          />
          <label className="text-[11px] font-bold text-muted-foreground">days</label>
          <NeuButton onClick={createRecurring} disabled={!!busy}>
            <span className="inline-flex items-center gap-2 text-primary font-black text-[12px] uppercase tracking-wider">
              {busy === 'recurring' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
              Make recurring
            </span>
          </NeuButton>
        </div>
      </div>

      {/* ── Recurring schedules ─────────────────────────────────────────── */}
      {schedules.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Repeat className="w-3 h-3" /> Recurring schedules
          </div>
          {schedules.map((sc) => (
            <div key={sc.id} className="neu-raised rounded-2xl p-4 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-foreground truncate">{sc.name}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider', sc.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500')}>
                    {sc.active ? 'active' : 'paused'}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-muted-foreground">
                  every {sc.cadenceDays}d · {sc.runCount} run{sc.runCount === 1 ? '' : 's'} · next {formatIST(sc.nextStartAt)}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <IconBtn onClick={() => toggleSchedule(sc)} busy={rowBusy === sc.id} icon={sc.active ? <Ban className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />} label={sc.active ? 'Pause' : 'Resume'} />
                <IconBtn onClick={() => deleteSchedule(sc)} busy={rowBusy === sc.id} icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" />
              </div>
            </div>
          ))}
        </div>
      )}

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
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex gap-2">
                {c.status === 'draft' && (
                  <IconBtn onClick={() => editDraft(c)} busy={rowBusy === c.id} icon={<Pencil className="w-3.5 h-3.5" />} label="Edit" primary />
                )}
                {isLiveNow(c) && (
                  <IconBtn
                    onClick={() => setExtendOpen((v) => (v === c.id ? null : c.id))}
                    busy={rowBusy === c.id}
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Extend"
                  />
                )}
                {canReview(c) && (
                  <IconBtn onClick={() => openReview(c)} busy={false} icon={<ShieldAlert className="w-3.5 h-3.5" />} label="Review" />
                )}
                {(c.status === 'result_processing' || c.status === 'result_published') && (
                  <Link
                    href={`/admin/contest/${c.id}/analytics`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider neu-raised text-muted-foreground hover:text-primary"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Analytics
                  </Link>
                )}
                <IconBtn onClick={() => clone(c)} busy={rowBusy === c.id} icon={<Copy className="w-3.5 h-3.5" />} label="Clone" />
                {(c.status === 'draft' || c.status === 'scheduled') && (
                  <IconBtn onClick={() => cancel(c)} busy={rowBusy === c.id} icon={<Ban className="w-3.5 h-3.5" />} label="Cancel" />
                )}
              </div>

              {/* Anti-cheat review panel */}
              {reviewOpen === c.id && (
                <div className="w-full neu-inset rounded-xl p-3 mt-1">
                  <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Flagged attempts</div>
                  {flagged === null ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs py-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
                  ) : flagged.length === 0 ? (
                    <div className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">No flags — clean contest ✓</div>
                  ) : (
                    <div className="space-y-2">
                      {flagged.map((f) => (
                        <div key={f.userId} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[12px] font-bold text-foreground truncate">Player {f.userId.slice(-6)}</div>
                            <div className="text-[10px] font-bold text-muted-foreground">
                              {f.violationCount} violations · {f.reviewStatus}{f.score != null ? ` · score ${f.score}` : ''}
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button type="button" onClick={() => resolveFlag(c.id, f.userId, 'clear')} disabled={rowBusy === c.id}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 disabled:opacity-50">Clear</button>
                            <button type="button" onClick={() => resolveFlag(c.id, f.userId, 'uphold')} disabled={rowBusy === c.id}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 disabled:opacity-50">Uphold</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {extendOpen === c.id && isLiveNow(c) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">+min</span>
                  {[5, 10, 15, 30].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => void extend(c, m)}
                      disabled={rowBusy === c.id}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-black neu-raised text-primary disabled:opacity-50"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Collapsible funnel + week-over-week retention metrics (loaded on demand). */
function ContestMetrics() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ContestAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setOpen((v) => !v);
    if (data || loading) return;
    setLoading(true);
    try {
      setData((await apiCall('/admin/contest/analytics')) as ContestAnalytics);
    } catch {
      toast.error('Could not load metrics.');
    } finally {
      setLoading(false);
    }
  };

  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  return (
    <div className="neu-raised rounded-2xl p-4 sm:p-5">
      <button type="button" onClick={load} className="flex items-center gap-2 w-full text-left">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Metrics · funnel &amp; retention</span>
        {data?.totals.avgReturnRate != null && (
          <span className="text-[10px] font-bold text-muted-foreground">avg return {pct(data.totals.avgReturnRate)}</span>
        )}
        <ChevronDown className={cn('w-4 h-4 ml-auto text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          )}
          {data && data.contests.length === 0 && (
            <div className="text-[12px] text-muted-foreground">No published contests yet — metrics appear after the first results.</div>
          )}
          {data && data.contests.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-left">
                    <th className="py-1.5 pr-3">Contest</th>
                    <th className="py-1.5 px-2 text-right">Reg</th>
                    <th className="py-1.5 px-2 text-right">Played</th>
                    <th className="py-1.5 px-2 text-right">Sub</th>
                    <th className="py-1.5 pl-2 text-right">Return→next</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contests.map((c) => (
                    <tr key={c.contestId} className="border-t border-border/30">
                      <td className="py-2 pr-3 font-bold text-foreground truncate max-w-[10rem]">{c.name}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{c.registered.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{c.played.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{c.submitted.toLocaleString()}</td>
                      <td className="py-2 pl-2 text-right tabular-nums font-black text-primary">{pct(c.returnRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders one resolved question (stem + options + images) with the correct
 *  option marked and the solution, plus delete/replace controls — an admin-only
 *  review + curation of exactly what will be frozen. */
function QuestionPreview({
  q,
  index,
  busy,
  onDelete,
  onReplace,
}: {
  q: ResolvedQuestion;
  index: number;
  busy: boolean;
  onDelete: () => void;
  onReplace: () => void;
}) {
  const [showSolution, setShowSolution] = useState(false);
  const s = q.snapshot ?? {};
  const options = Array.isArray(s.options) ? s.options : [];
  const isCorrect = (oi: number) =>
    (Array.isArray(s.correctOptions) && s.correctOptions.length
      ? s.correctOptions.includes(oi)
      : s.correctOption === oi);
  return (
    <div className={cn('neu-raised rounded-xl p-4', busy && 'opacity-60')}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Q{index + 1}</span>
        {q.subject && <span className="text-[10px] font-bold text-muted-foreground">{q.subject}</span>}
        {s.chapter && <span className="text-[10px] font-bold text-muted-foreground/70 truncate">· {s.chapter}</span>}
        {s.difficulty && (
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70 ml-auto">{s.difficulty}</span>
        )}
        {/* Curation controls */}
        <div className={cn('flex items-center gap-1.5', !s.difficulty && 'ml-auto')}>
          <button
            type="button"
            onClick={onReplace}
            disabled={busy}
            title="Swap for a different question"
            className="p-1.5 rounded-lg neu-raised text-muted-foreground hover:text-primary disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            title="Remove this question"
            className="p-1.5 rounded-lg neu-raised text-muted-foreground hover:text-rose-500 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="text-[14px] font-bold text-foreground leading-relaxed mb-2">
        <LatexRenderer content={String(s.text ?? '')} />
      </div>
      {s.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.image} alt="" className="mb-3 max-h-52 w-auto max-w-full rounded-lg object-contain neu-inset p-1.5" />
      )}
      <div className="space-y-1.5">
        {options.map((opt, oi) => (
          <div
            key={oi}
            className={cn(
              'flex items-start gap-2 px-3 py-2 rounded-lg text-[13px]',
              isCorrect(oi) ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : 'neu-inset',
            )}
          >
            <span
              className={cn(
                'w-5 h-5 shrink-0 rounded flex items-center justify-center text-[11px] font-black',
                isCorrect(oi) ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
              )}
            >
              {String.fromCharCode(65 + oi)}
            </span>
            <span className="text-foreground flex-1 min-w-0">
              <LatexRenderer content={String(opt)} />
              {s.optionImages?.[oi] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.optionImages[oi] as string} alt="" className="mt-1.5 max-h-24 w-auto max-w-full rounded object-contain" />
              )}
            </span>
          </div>
        ))}
      </div>
      {/* Solution / explanation */}
      {s.explanation && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowSolution((v) => !v)}
            className="text-[11px] font-black uppercase tracking-wider text-primary"
          >
            {showSolution ? 'Hide solution' : 'Show solution'}
          </button>
          {showSolution && (
            <div className="mt-1.5 neu-inset rounded-lg p-3 text-[13px] font-medium text-muted-foreground leading-relaxed">
              <LatexRenderer content={String(s.explanation)} />
            </div>
          )}
        </div>
      )}
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

/** Generate + list single-use access codes for a code-gated contest draft. */
function AccessCodesManager({ contestId }: { contestId: string }) {
  const [codes, setCodes] = useState<{ code: string; redeemedBy: string | null }[]>([]);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = (await apiCall(`/admin/contest/${contestId}/access-codes`)) as { codes: { code: string; redeemedBy: string | null }[] };
      setCodes(res.codes ?? []);
    } catch { /* non-fatal */ }
  }, [contestId]);
  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      await apiCall(`/admin/contest/${contestId}/access-codes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count }),
      });
      await load();
      toast.success(`Generated ${count} codes.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate codes.');
    } finally {
      setBusy(false);
    }
  };

  const unused = codes.filter((c) => !c.redeemedBy);
  return (
    <div className="neu-inset rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number" min={1} max={500} value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
          className="w-20 neu-raised rounded-lg px-2 py-1.5 text-sm font-black text-foreground bg-transparent outline-none text-center tabular-nums"
        />
        <NeuButton onClick={generate} disabled={busy}>
          <span className="text-foreground font-black text-[11px] uppercase tracking-wider">{busy ? 'Generating…' : 'Generate codes'}</span>
        </NeuButton>
        <span className="text-[10px] text-muted-foreground">{codes.length} total · {unused.length} unused</span>
        {codes.length > 0 && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(unused.map((c) => c.code).join('\n'))}
            className="text-[10px] font-bold text-primary hover:underline"
          >
            Copy unused
          </button>
        )}
      </div>
      {codes.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
          {codes.map((c) => (
            <span key={c.code} className={cn('rounded px-1.5 py-0.5 text-[11px] font-mono', c.redeemedBy ? 'bg-muted text-muted-foreground line-through' : 'bg-primary/10 text-foreground')}>
              {c.code}
            </span>
          ))}
        </div>
      )}
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
