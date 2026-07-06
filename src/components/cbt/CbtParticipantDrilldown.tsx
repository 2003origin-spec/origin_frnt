"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Drilldown = {
  participant: {
    displayName: string;
    studentCode: string;
    score: number | null;
    maxScore: number | null;
    rank: number | null;
    timeTakenSeconds: number | null;
    autoSubmitted: boolean;
  };
  summary: { correct: number; wrong: number; unattempted: number; needsReview: number };
  questions: {
    position: number;
    questionType: string;
    stem: string;
    subject: string | null;
    marks: number;
    marksAwarded: number;
    isCorrect: boolean;
    needsReview: boolean;
    attempted: boolean;
  }[];
};

function verdict(q: Drilldown["questions"][number]): { label: string; cls: string } {
  if (q.needsReview) return { label: "Review", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" };
  if (!q.attempted) return { label: "Skipped", cls: "bg-muted text-muted-foreground" };
  if (q.isCorrect) return { label: "Correct", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  return { label: "Wrong", cls: "bg-red-500/15 text-red-600 dark:text-red-400" };
}

export function CbtParticipantDrilldown({
  roomId,
  participantId,
  displayName,
}: {
  roomId: string;
  participantId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Drilldown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cbt/rooms/${roomId}/participants/${participantId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Could not load (${res.status}).`);
      setData((await res.json()) as Drilldown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !data) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
        </DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="font-mono text-muted-foreground">{data.participant.studentCode}</span>
              <span>
                Score <b>{data.participant.score ?? "—"}</b> / {data.participant.maxScore ?? "—"}
              </span>
              {data.participant.rank ? <span>Rank #{data.participant.rank}</span> : null}
              {data.participant.autoSubmitted ? <span className="text-amber-600">auto-submitted</span> : null}
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600">{data.summary.correct} correct</span>
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-600">{data.summary.wrong} wrong</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{data.summary.unattempted} skipped</span>
              {data.summary.needsReview > 0 ? (
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-600">{data.summary.needsReview} to review</span>
              ) : null}
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {data.questions.map((q) => {
                const v = verdict(q);
                return (
                  <li key={q.position} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="text-muted-foreground">Q{q.position}.</span> {q.subject ?? ""} · {q.questionType}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-muted-foreground">
                        {q.marksAwarded} / {q.marks}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
