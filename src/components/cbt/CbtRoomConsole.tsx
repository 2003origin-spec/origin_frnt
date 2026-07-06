"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { csrfHeaders } from "@/lib/csrf";
import type { CbtParticipantSummary } from "@/lib/cbt/events";
import type { CbtRoom } from "@/lib/cbt/room-model";

import { useCbtRoomStream } from "./useCbtRoomStream";
import { CbtLiveRoomDashboard } from "./CbtLiveRoomDashboard";

export function CbtRoomConsole({
  room,
  initialParticipants,
}: {
  room: CbtRoom;
  initialParticipants: CbtParticipantSummary[];
}) {
  const router = useRouter();
  const { participants, connected, lifecycle } = useCbtRoomStream(room.id, initialParticipants);
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyTests, setReadyTests] = useState<{ id: string; title: string }[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>(room.testId ?? "");
  const [assignedTestId, setAssignedTestId] = useState<string | null>(room.testId);

  useEffect(() => {
    if (room.status !== "lobby") return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/cbt/tests", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as { tests?: { id: string; title: string; status: string }[] };
      if (!cancelled) setReadyTests((data.tests ?? []).filter((t) => t.status === "ready"));
    })();
    return () => {
      cancelled = true;
    };
  }, [room.status]);

  function assignTest() {
    if (!selectedTestId) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/cbt/rooms/${room.id}/configure-test`, {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ testId: selectedTestId }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        setError(data.detail ?? "Could not assign the test.");
        return;
      }
      setAssignedTestId(selectedTestId);
    });
  }

  function startTest() {
    if (!confirm("Start the test now? Students will begin in 3 seconds.")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/cbt/rooms/${room.id}/start`, {
        method: "POST",
        headers: csrfHeaders(),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        setError(data.detail ?? "Could not start the test.");
        return;
      }
      router.refresh();
    });
  }

  const joinUrl = useMemo(
    () => `${typeof window !== "undefined" ? window.location.origin : ""}/cbt/r/${room.publicSlug}`,
    [room.publicSlug],
  );

  const online = participants.filter((p) => p.status !== "offline").length;
  const closed = room.status === "closed";

  // Reflect server-side status flips (auto test-end, close) without a manual reload.
  useEffect(() => {
    if (lifecycle && (lifecycle.type === "test_ended" || lifecycle.type === "room_closed")) {
      router.refresh();
    }
  }, [lifecycle, router]);

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/cbt/rooms/${room.id}/code`, {
        method: "POST",
        headers: csrfHeaders(),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string; detail?: string };
      if (!res.ok || !data.code) {
        setError(data.detail ?? "Could not regenerate the code.");
        return;
      }
      setCode(data.code);
    });
  }

  function kick(participantId: string) {
    startTransition(async () => {
      await fetch(`/api/cbt/rooms/${room.id}/kick`, {
        method: "POST",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ participantId }),
      });
    });
  }

  function closeRoom() {
    if (!confirm("Close this room? Students will be disconnected.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/cbt/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ action: "close" }),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{room.name}</h1>
          <p className="text-sm text-muted-foreground">
            {closed ? "Closed" : room.status === "in_test" ? "Test in progress" : "Lobby"} · {online} online ·{" "}
            {participants.length} joined
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            title={connected ? "Live" : "Reconnecting…"}
          />
          {!closed ? (
            <Button variant="destructive" size="sm" onClick={closeRoom} disabled={pending}>
              Close room
            </Button>
          ) : null}
        </div>
      </div>

      {!closed ? (
        <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Student link</p>
            <Input readOnly value={joinUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Room code</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-center text-lg font-bold tracking-[0.3em]">
                {code ?? "••••••"}
              </div>
              <Button variant="outline" size="sm" onClick={regenerate} disabled={pending}>
                {code ? "New code" : "Reveal"}
              </Button>
            </div>
          </div>
          {error ? <p className="text-xs text-destructive sm:col-span-2">{error}</p> : null}
        </div>
      ) : null}

      {room.status === "lobby" ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
          <div className="flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Test</p>
            <select
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
            >
              <option value="">Select a ready test…</option>
              {readyTests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" onClick={assignTest} disabled={pending || !selectedTestId}>
            {assignedTestId === selectedTestId && selectedTestId ? "Assigned" : "Assign"}
          </Button>
          <Button onClick={startTest} disabled={pending || !assignedTestId}>
            Start test
          </Button>
        </div>
      ) : room.status === "in_test" ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          Test in progress. Students are answering now.
        </div>
      ) : null}

      <CbtLiveRoomDashboard
        roomId={room.id}
        roomStatus={room.status}
        participants={participants}
        onKick={kick}
        closed={closed}
      />
    </div>
  );
}
