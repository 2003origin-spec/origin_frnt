'use client';

/**
 * "Manage subjects" — per-student, per-subject admin_comp control. Lets an
 * admin grant/revoke Premium Pro comp one subject at a time (e.g. add
 * chemistry/biology for a student who already has physics free via a
 * teacher_code grant), instead of only the all-4-subjects bundle the rest of
 * /admin/premium-access offers. Subjects owned via a real subscription or a
 * teacher_code grant are shown as protected/informational — this control only
 * ever writes or revokes source='admin_comp' rows, same as the bundle toggle.
 */

import { useEffect, useState } from 'react';
import { X, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { apiJson } from '@/lib/teacher-client';

type Subject = 'physics' | 'chemistry' | 'mathematics' | 'biology';

const SUBJECT_LABEL: Record<Subject, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};
const ALL_SUBJECTS: Subject[] = ['physics', 'chemistry', 'mathematics', 'biology'];

type SubjectAccessRow = {
  subject: Subject;
  paid: boolean;
  teacherWorkspaceId: string | null;
  comp: boolean;
  compExpiresAt: string | null;
};

export type AdminSubjectAccessModalProps = {
  userId: string;
  studentLabel: string;
  onClose: () => void;
  onChanged: () => void;
};

function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function AdminSubjectAccessModal({ userId, studentLabel, onClose, onChanged }: AdminSubjectAccessModalProps) {
  const [rows, setRows] = useState<SubjectAccessRow[] | null>(null);
  const [desiredComp, setDesiredComp] = useState<Record<Subject, boolean>>({
    physics: false,
    chemistry: false,
    mathematics: false,
    biology: false,
  });
  const [autoRevertAt, setAutoRevertAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiJson<{ subjects: SubjectAccessRow[] }>(`/api/admin/premium-access/subjects?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
    }).then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        setError(r.detail || 'Failed to load subject access.');
        setLoading(false);
        return;
      }
      setRows(r.data.subjects);
      setDesiredComp(
        Object.fromEntries(r.data.subjects.map((row) => [row.subject, row.comp])) as Record<Subject, boolean>,
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const rowFor = (subject: Subject) => rows?.find((r) => r.subject === subject) ?? null;

  async function handleSave() {
    setSaving(true);
    try {
      // Locked (paid/teacher) subjects keep whatever comp state they already
      // had — the admin never sees a checkbox for them, so their entry in
      // desiredComp is untouched from the initial fetch and the diff is a
      // no-op for those on the server.
      const subjects = ALL_SUBJECTS.filter((s) => desiredComp[s]);
      const r = await apiJson<{ granted: Subject[]; revoked: Subject[] }>('/api/admin/premium-access/subjects', {
        method: 'POST',
        json: { userId, subjects, expiresAt: toIso(autoRevertAt) },
      });
      if (!r.ok) return toast.error(r.detail || 'Failed to update subject access.');
      const { granted, revoked } = r.data;
      if (granted.length === 0 && revoked.length === 0) {
        toast.success('No changes.');
      } else {
        const parts: string[] = [];
        if (granted.length) parts.push(`granted ${granted.map((s) => SUBJECT_LABEL[s]).join(', ')}`);
        if (revoked.length) parts.push(`revoked ${revoked.map((s) => SUBJECT_LABEL[s]).join(', ')}`);
        toast.success(`Updated ${studentLabel}: ${parts.join('; ')}.`);
      }
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-foreground">Manage subjects</h2>
            <p className="text-xs text-muted-foreground">{studentLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {ALL_SUBJECTS.map((subject) => {
                const row = rowFor(subject);
                const locked = row?.paid || Boolean(row?.teacherWorkspaceId);
                return (
                  <label
                    key={subject}
                    className={`flex items-center justify-between rounded-xl border border-border px-3 py-2.5 ${
                      locked ? 'opacity-70' : 'cursor-pointer hover:bg-accent/50'
                    }`}
                  >
                    <span className="text-sm font-bold text-foreground">{SUBJECT_LABEL[subject]}</span>
                    {row?.paid ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-bold">
                        <Lock className="w-3.5 h-3.5" /> Paid — protected
                      </span>
                    ) : row?.teacherWorkspaceId ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" /> Teacher grant
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={desiredComp[subject]}
                        onChange={(e) =>
                          setDesiredComp((prev) => ({ ...prev, [subject]: e.target.checked }))
                        }
                        className="w-4 h-4"
                      />
                    )}
                  </label>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl border border-border bg-card px-3 py-2 mb-4">
              Auto-revert (optional)
              <input
                type="datetime-local"
                value={autoRevertAt}
                onChange={(e) => setAutoRevertAt(e.target.value)}
                className="bg-transparent outline-none text-foreground"
                title="Newly-granted subjects auto-revert at this time"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-bold text-muted-foreground hover:bg-accent">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
