'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { mutateJson } from '@/lib/csrf';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

/** Author a single MCQ directly into the contest pool (no file import). */
export function ContestManualQuestion() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [chapters, setChapters] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState('medium');
  const [practice, setPractice] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!subject) { setChapters([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/admin/contest/chapters?subject=${encodeURIComponent(subject)}`);
        const body = (await res.json().catch(() => ({}))) as { chapters?: string[] };
        setChapters(body.chapters ?? []);
      } catch { setChapters([]); }
    })();
  }, [subject]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await mutateJson('/api/admin/contest/manual-question', {
        method: 'POST',
        body: JSON.stringify({ text, options: options.filter((o) => o.trim()), correctOption: correct, subject, chapter, difficulty, practiceEligible: practice }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) { toast.error(data.detail ?? 'Could not save.'); return; }
      toast.success('Question added to the contest pool.');
      setText(''); setOptions(['', '', '', '']); setCorrect(0); setChapter('');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        + Add a question manually
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Add a question manually</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Close</button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Question text (LaTeX ok)" rows={2} className="w-full rounded-lg neu-inset px-3 py-2 text-sm text-foreground outline-none" />
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" name="manual-correct" checked={correct === i} onChange={() => setCorrect(i)} />
          <input value={o} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1 rounded-lg neu-inset px-3 py-1.5 text-sm text-foreground outline-none" />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <select value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(''); }} className="rounded-lg border border-border/50 bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="">Subject…</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={chapter} onChange={(e) => setChapter(e.target.value)} disabled={!subject} className="rounded-lg border border-border/50 bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="">{subject ? 'Chapter…' : 'Pick a subject'}</option>
          {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-lg border border-border/50 bg-background px-2 py-1.5 text-sm text-foreground">
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} /> Send to practice
        </label>
      </div>
      <button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {busy ? 'Saving…' : 'Add to pool'}
      </button>
    </div>
  );
}
