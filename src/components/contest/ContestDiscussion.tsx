'use client';

import { useCallback, useEffect, useState } from 'react';

import { mutateJson } from '@/lib/csrf';

interface Comment { id: string; authorName: string; body: string; createdAt: string }

/** Collapsible per-question discussion thread (post-result). */
export function ContestDiscussion({ contestId, position }: { contestId: string; position: number }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contest/discussion?contestId=${encodeURIComponent(contestId)}&position=${position}`, { credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as { comments?: Comment[] };
      setComments(body.comments ?? []);
    } catch {
      setComments([]);
    }
  }, [contestId, position]);

  useEffect(() => { if (open && comments === null) void load(); }, [open, comments, load]);

  const post = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await mutateJson('/api/contest/discussion', { method: 'POST', body: JSON.stringify({ contestId, position, body }) });
      const data = (await res.json().catch(() => ({}))) as { comment?: Comment; detail?: string };
      if (res.ok && data.comment) {
        setComments((prev) => [...(prev ?? []), data.comment!]);
        setDraft('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border/30 pt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-[11px] font-black uppercase tracking-wider text-muted-foreground hover:text-primary">
        {open ? 'Hide discussion' : `Discuss${comments ? ` (${comments.length})` : ''}`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {comments === null ? (
            <p className="text-[12px] text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No comments yet — start the discussion.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="text-[13px]">
                <span className="font-bold text-foreground">{c.authorName}</span>{' '}
                <span className="text-muted-foreground">{c.body}</span>
              </div>
            ))
          )}
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void post(); }}
              placeholder="Add a comment…"
              maxLength={1000}
              className="flex-1 rounded-lg neu-inset px-3 py-1.5 text-sm text-foreground outline-none"
            />
            <button type="button" onClick={() => void post()} disabled={busy || !draft.trim()} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
