'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { mutateJson } from '@/lib/csrf';

interface Team { id: string; name: string; joinCode: string; memberCount: number }
interface Row { rank: number; teamName: string; totalScore: number; memberCount: number }

export function ContestTeams({ contestId }: { contestId: string }) {
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [board, setBoard] = useState<Row[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contest/teams?contestId=${encodeURIComponent(contestId)}`, { credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as { myTeam: Team | null; leaderboard: Row[] };
      setMyTeam(body.myTeam ?? null);
      setBoard(body.leaderboard ?? []);
    } catch { /* ignore */ }
  }, [contestId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await mutateJson('/api/contest/teams', { method: 'POST', body: JSON.stringify({ contestId, ...payload }) });
      const data = (await res.json().catch(() => ({}))) as { team?: Team; detail?: string };
      if (!res.ok) { toast.error(data.detail ?? 'Failed.'); return; }
      setMyTeam(data.team ?? null);
      await load();
      toast.success('Done!');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        <h1 className="text-xl font-black text-foreground">Teams</h1>

        {myTeam ? (
          <div className="neu-raised rounded-2xl p-4">
            <div className="text-sm font-black text-foreground">{myTeam.name}</div>
            <div className="text-[12px] text-muted-foreground">{myTeam.memberCount} member(s)</div>
            <div className="mt-2 text-[12px] text-muted-foreground">
              Invite code: <span className="font-mono font-bold text-foreground">{myTeam.joinCode}</span>
            </div>
          </div>
        ) : (
          <div className="neu-raised rounded-2xl p-4 space-y-3">
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New team name" className="flex-1 rounded-lg neu-inset px-3 py-2 text-sm text-foreground outline-none" />
              <button type="button" disabled={busy || !name.trim()} onClick={() => act({ action: 'create', name })} className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Create</button>
            </div>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Join code" className="flex-1 rounded-lg neu-inset px-3 py-2 text-sm text-foreground outline-none font-mono" />
              <button type="button" disabled={busy || !code.trim()} onClick={() => act({ action: 'join', joinCode: code })} className="rounded-lg neu-raised px-3 py-2 text-sm font-bold text-foreground disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Join</button>
            </div>
          </div>
        )}

        <div className="neu-raised rounded-2xl divide-y divide-border/20">
          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team leaderboard</div>
          {board.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">No teams yet.</div>
          ) : (
            board.map((r) => (
              <div key={r.rank} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-8 text-center text-sm font-black tabular-nums ${r.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>{r.rank}</span>
                  <span className="text-[13px] font-bold text-foreground">{r.teamName} <span className="text-muted-foreground font-normal">· {r.memberCount}</span></span>
                </div>
                <span className="text-sm font-black text-primary tabular-nums">{r.totalScore}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
