"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mutateJson } from "@/lib/csrf";
import type { CbtParticipantSummary } from "@/lib/cbt/events";
import { finalizeRemark, type CbtFinalizeReason } from "@/lib/cbt/finalize-reason";

import { CbtParticipantDrilldown } from "./CbtParticipantDrilldown";

type LeaderboardRow = {
  participantId: string;
  displayName: string;
  studentCode: string;
  status: CbtParticipantSummary["status"];
  answeredCount: number;
  score: number | null;
  maxScore: number | null;
  rank: number | null;
  timeTakenSeconds: number | null;
  finishedAt: string | null;
  autoSubmitted: boolean;
  finalizeReason?: CbtFinalizeReason | null;
  offlineForSeconds?: number | null;
  rejoinCount?: number;
  violationCount?: number;
};

type Leaderboard = { roomStatus: string; totalQuestions: number; maxScore: number; participants: LeaderboardRow[] };

const STATUS_LABEL: Record<CbtParticipantSummary["status"], string> = {
  in_lobby: "In lobby",
  giving_test: "Giving test",
  submitted: "Submitted",
  offline: "Offline",
};
const STATUS_CLASS: Record<CbtParticipantSummary["status"], string> = {
  in_lobby: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  giving_test: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  submitted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  offline: "bg-muted text-muted-foreground",
};

function formatTime(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "offline 12m" — how long since this student's last heartbeat. */
function formatOfflineFor(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  if (seconds < 60) return "offline <1m";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `offline ${minutes}m`;
  return `offline ${Math.floor(minutes / 60)}h`;
}

/**
 * Live teacher dashboard: authoritative leaderboard (polled) merged with live
 * presence (status + answered_count) pushed from the room stream. Progress
 * (answered/total) is powered by autosave — an upgrade over Origin study rooms.
 */
export function CbtLiveRoomDashboard({
  roomId,
  roomStatus,
  participants,
  onKick,
  closed,
}: {
  roomId: string;
  roomStatus: string;
  participants: CbtParticipantSummary[];
  onKick: (participantId: string) => void;
  closed: boolean;
}) {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchBoard() {
      const res = await fetch(`/api/cbt/rooms/${roomId}/leaderboard`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as Leaderboard;
      if (!cancelled) setBoard(data);
    }
    void fetchBoard();
    // Poll while the room is live; stop once closed.
    const timer = closed ? undefined : setInterval(fetchBoard, 6000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [roomId, closed, refreshTick]);

  /**
   * Grade a student who is not coming back, without waiting for the clock or
   * closing the room. Their answers are already on the server — this just marks
   * the attempt finished so it scores instead of sitting open.
   */
  async function finalizeParticipant(row: LeaderboardRow) {
    if (
      !window.confirm(
        `Submit ${row.displayName}'s test now?\n\nTheir ${row.answeredCount} saved answer(s) will be graded. This cannot be undone.`,
      )
    ) {
      return;
    }
    setActionError(null);
    setBusy(true);
    try {
      const res = await mutateJson(`/api/cbt/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "finalize_participant", participantId: row.participantId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setActionError(data.detail ?? `Could not submit (${res.status}).`);
        return;
      }
      setRefreshTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  async function finalizeRoom() {
    if (
      !window.confirm(
        "Submit every unfinished test now?\n\nEach student is graded on the answers already saved on the server. This cannot be undone.",
      )
    ) {
      return;
    }
    setActionError(null);
    setBusy(true);
    try {
      const res = await mutateJson(`/api/cbt/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "finalize" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setActionError(data.detail ?? `Could not finalize (${res.status}).`);
        return;
      }
      setRefreshTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  // Live presence (status + answered_count) overrides the polled snapshot.
  const liveById = useMemo(() => {
    const map = new Map<string, CbtParticipantSummary>();
    for (const p of participants) map.set(p.participant_id, p);
    return map;
  }, [participants]);

  const rows = useMemo(() => {
    const base: LeaderboardRow[] = board?.participants ?? [];
    // If the leaderboard hasn't loaded yet, fall back to live presence rows.
    const source: LeaderboardRow[] =
      base.length > 0
        ? base
        : participants.map((p) => ({
            participantId: p.participant_id,
            displayName: p.display_name,
            studentCode: p.student_code,
            status: p.status,
            answeredCount: p.answered_count,
            score: null,
            maxScore: null,
            rank: null,
            timeTakenSeconds: null,
            finishedAt: null,
            autoSubmitted: false,
          }));
    const merged = source.map((r) => {
      const live = liveById.get(r.participantId);
      return live && r.status !== "submitted"
        ? { ...r, status: live.status, answeredCount: live.answered_count }
        : r;
    });
    const q = query.trim().toLowerCase();
    return q
      ? merged.filter((r) => r.displayName.toLowerCase().includes(q) || r.studentCode.toLowerCase().includes(q))
      : merged;
  }, [board, participants, liveById, query]);

  const total = board?.totalQuestions ?? 0;
  const showScores = roomStatus === "in_test" || roomStatus === "finished" || closed;

  return (
    <div className="neu-raised overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <span className="text-sm font-medium">Participants ({rows.length})</span>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or ID…"
            className="h-8 max-w-48"
          />
          {roomStatus === "in_test" && !closed ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={busy} onClick={finalizeRoom}>
              Submit all now
            </Button>
          ) : null}
          {showScores ? (
            <a
              href={`/api/cbt/rooms/${roomId}/export?detail=1`}
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
            >
              Export .xlsx
            </a>
          ) : null}
        </div>
      </div>
      {actionError ? (
        <p className="border-b border-border/40 px-4 py-2 text-xs text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No one has joined yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Progress</th>
                {showScores ? <th className="px-3 py-2 text-right font-medium">Score</th> : null}
                {showScores ? <th className="px-3 py-2 text-right font-medium">Time</th> : null}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.participantId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.rank ?? "—"}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.displayName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{r.studentCode}</p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {/* How long they've been gone — the teacher's cue that a
                          machine died rather than a student thinking hard. */}
                      {!r.finishedAt && r.status === "offline" && r.offlineForSeconds != null ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          {formatOfflineFor(r.offlineForSeconds)}
                        </span>
                      ) : null}
                      {r.rejoinCount ? (
                        <span
                          title="This student recovered their session"
                          className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400"
                        >
                          rejoined ×{r.rejoinCount}
                        </span>
                      ) : null}
                      {r.finalizeReason && r.finalizeReason !== "manual" ? (
                        <span
                          title={finalizeRemark(r.finalizeReason, r.finishedAt)}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
                        >
                          {r.finalizeReason.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {r.answeredCount}
                    {total ? `/${total}` : ""}
                  </td>
                  {showScores ? (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.score != null ? `${r.score}/${r.maxScore ?? board?.maxScore ?? "—"}` : "—"}
                    </td>
                  ) : null}
                  {showScores ? (
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatTime(r.timeTakenSeconds)}</td>
                  ) : null}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.finishedAt ? (
                        <CbtParticipantDrilldown roomId={roomId} participantId={r.participantId} displayName={r.displayName} />
                      ) : null}
                      {!r.finishedAt && roomStatus === "in_test" && !closed ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void finalizeParticipant(r)}
                          title="Grade the answers already saved on the server"
                        >
                          Submit now
                        </Button>
                      ) : null}
                      {!closed ? (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onKick(r.participantId)}>
                          Kick
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
