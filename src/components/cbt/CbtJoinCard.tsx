"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CbtReclaimCandidate } from "@/lib/cbt/reclaim";

/**
 * Anonymous student entry — join, or get an interrupted attempt back.
 *
 * Losing a session used to mean losing the paper: the only path in created a
 * brand-new participant with a fresh ID and an empty draft, while the real
 * attempt sat unfinished and was later reported "absent" with no score. There
 * are now three ways back, in order of how little the student has to remember:
 *
 *   1. this device remembers their Student ID → one tap;
 *   2. they type the Student ID they wrote down;
 *   3. they type their name and confirm the attempt the server offers.
 *
 * (3) only ever offers attempts that are unfinished AND idle, so a live session
 * can't be taken over, and rooms set to `id_only` never offer it at all.
 */

type JoinResponse = {
  detail?: string;
  code?: string;
  studentCode?: string;
  participantId?: string;
  candidates?: CbtReclaimCandidate[];
};

function offlineFor(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "not seen yet";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 1000));
  if (seconds < 90) return "last seen just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `last seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `last seen ${hours} h ago`;
}

export function CbtJoinCard({
  slug,
  roomName,
  rememberedStudentCode,
  onJoined,
}: {
  slug: string;
  roomName: string;
  rememberedStudentCode?: string | null;
  onJoined: (identity: { studentCode: string; participantId?: string; displayName?: string }) => void;
}) {
  const [mode, setMode] = useState<"join" | "resume">("join");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CbtReclaimCandidate[] | null>(null);
  const [pending, startTransition] = useTransition();

  // A remembered ID means this browser has been here before — default to the
  // path that gets their answers back rather than the one that starts over.
  useEffect(() => {
    if (rememberedStudentCode) {
      setStudentId(rememberedStudentCode);
      setMode("resume");
    }
  }, [rememberedStudentCode]);

  function post(body: Record<string, unknown>, onOk: (data: JoinResponse) => void) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/cbt-student/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug, code: code.trim(), ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as JoinResponse;
      if (res.status === 409 && data.code === "reclaim_available" && data.candidates?.length) {
        setCandidates(data.candidates);
        return;
      }
      if (!res.ok || !data.studentCode) {
        setError(data.detail ?? `Could not join (${res.status}).`);
        return;
      }
      onOk(data);
    });
  }

  function join() {
    if (!code.trim() || !name.trim()) {
      setError("Enter your name and the room code.");
      return;
    }
    post({ displayName: name.trim() }, (data) =>
      onJoined({ studentCode: data.studentCode!, participantId: data.participantId, displayName: name.trim() }),
    );
  }

  function reclaim(participantId: string) {
    post({ displayName: name.trim(), reclaimParticipantId: participantId }, (data) => {
      setCandidates(null);
      onJoined({ studentCode: data.studentCode!, participantId: data.participantId, displayName: name.trim() });
    });
  }

  function startFresh() {
    post({ displayName: name.trim(), forceNew: true }, (data) => {
      setCandidates(null);
      onJoined({ studentCode: data.studentCode!, participantId: data.participantId, displayName: name.trim() });
    });
  }

  function resume() {
    if (!code.trim() || !studentId.trim()) {
      setError("Enter your Student ID and the room code.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/cbt-student/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug, roomCode: code.trim(), studentCode: studentId.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as JoinResponse;
      if (!res.ok) {
        setError(
          res.status === 404
            ? "No attempt found for that Student ID in this room. Check the ID, or join as a new student."
            : (data.detail ?? `Could not resume (${res.status}).`),
        );
        return;
      }
      onJoined({ studentCode: data.studentCode ?? studentId.trim(), participantId: data.participantId });
    });
  }

  // ── Reclaim confirmation ──────────────────────────────────────────────────
  if (candidates) {
    return (
      <div className="neu-raised w-full max-w-sm space-y-4 rounded-3xl p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-bold text-foreground">You&apos;ve already started</h1>
          <p className="text-sm text-muted-foreground">
            {candidates.length === 1
              ? "An unfinished test is saved under your name. Resume it to keep every answer you had."
              : "More than one unfinished test is saved under your name. Pick yours."}
          </p>
        </div>

        <ul className="space-y-2">
          {candidates.map((c) => (
            <li key={c.participantId} className="neu-inset rounded-2xl p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold tracking-wider text-foreground">{c.studentCode}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.answeredCount} answered · {offlineFor(c.lastSeenAt)}
                  </p>
                </div>
                <Button size="sm" disabled={pending} onClick={() => reclaim(c.participantId)}>
                  Resume
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={startFresh}
          className="w-full rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          That&apos;s not me — start a new test
        </button>
      </div>
    );
  }

  // ── Join / resume ─────────────────────────────────────────────────────────
  return (
    <div className="neu-raised w-full max-w-sm space-y-4 rounded-3xl p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{roomName || "Join test"}</h1>
        <p className="text-sm text-muted-foreground">Enter the code your teacher shared.</p>
      </div>

      <div className="neu-inset grid grid-cols-2 gap-1 rounded-2xl p-1">
        {(["join", "resume"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all ${
              mode === m ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "join" ? "Join" : "Resume"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {mode === "join" ? (
          <div className="space-y-1">
            <Label htmlFor="cbt-name">Your name</Label>
            <Input
              id="cbt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="cbt-student-id">Your Student ID</Label>
            <Input
              id="cbt-student-id"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.toUpperCase())}
              placeholder="CBT-XXXXXX"
              autoCapitalize="characters"
              className="text-center font-mono text-lg font-semibold tracking-[0.2em]"
            />
            <p className="text-[11px] text-muted-foreground">
              {rememberedStudentCode
                ? "Remembered on this device. Resuming restores every answer you had saved."
                : "The ID shown when you first joined. Resuming restores every answer you had saved."}
            </p>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="cbt-code">Room code</Label>
          <Input
            id="cbt-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            autoCapitalize="characters"
            className="text-center text-lg font-semibold tracking-[0.3em]"
            onKeyDown={(e) => e.key === "Enter" && (mode === "join" ? join() : resume())}
          />
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          className="w-full shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
          onClick={mode === "join" ? join : resume}
          disabled={pending}
        >
          {pending ? "Please wait…" : mode === "join" ? "Join" : "Resume my test"}
        </Button>

        {mode === "join" ? (
          <p className="text-center text-[11px] text-muted-foreground">
            Already started and got disconnected? Use <span className="font-bold">Resume</span>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
