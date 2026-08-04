"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mutateJson } from "@/lib/csrf";
import type { CbtParticipantSummary } from "@/lib/cbt/events";
import type { CbtRoom } from "@/lib/cbt/room-model";

import { useCbtRoomStream } from "./useCbtRoomStream";
import { CbtLiveRoomDashboard } from "./CbtLiveRoomDashboard";

export function CbtRoomConsole({
  room,
  initialParticipants,
  reportCardsEnabled = false,
}: {
  room: CbtRoom;
  initialParticipants: CbtParticipantSummary[];
  /** Premium add-on state for this teacher (admin-controlled). */
  reportCardsEnabled?: boolean;
}) {
  const router = useRouter();
  const { participants, connected, lifecycle } = useCbtRoomStream(room.id, initialParticipants);
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyTests, setReadyTests] = useState<{ id: string; title: string }[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>(room.testId ?? "");
  const [assignedTestId, setAssignedTestId] = useState<string | null>(room.testId);
  const [reportShared, setReportShared] = useState(room.reportShareEnabled);
  const [linkCopied, setLinkCopied] = useState(false);

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
      const res = await mutateJson(`/api/cbt/rooms/${room.id}/configure-test`, {
        method: "POST",
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
      const res = await mutateJson(`/api/cbt/rooms/${room.id}/start`, {
        method: "POST",
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
  const reportUrl = useMemo(
    () => `${typeof window !== "undefined" ? window.location.origin : ""}/cbt/r/${room.publicSlug}/report`,
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
      const res = await mutateJson(`/api/cbt/rooms/${room.id}/code`, {
        method: "POST",
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
      await mutateJson(`/api/cbt/rooms/${room.id}/kick`, {
        method: "POST",
        body: JSON.stringify({ participantId }),
      });
    });
  }

  /**
   * Publish (or unpublish) this room's participant report cards. Only offered
   * once the test has ended — the report shows correct answers, so sharing it
   * while an attempt is still open would hand out the paper.
   */
  function toggleReportShare(next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await mutateJson(`/api/cbt/rooms/${room.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "report_share", reportShareEnabled: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      if (!res.ok) {
        setError(data.detail ?? "Could not update report sharing.");
        return;
      }
      setReportShared(next);
    });
  }

  function closeRoom() {
    if (!confirm("Close this room? Students will be disconnected.")) return;
    startTransition(async () => {
      const res = await mutateJson(`/api/cbt/rooms/${room.id}`, {
        method: "PATCH",
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
            <Button variant="destructive" size="sm" className="shadow-lg shadow-red-600/20 transition-transform hover:-translate-y-0.5" onClick={closeRoom} disabled={pending}>
              Close room
            </Button>
          ) : null}
        </div>
      </div>

      {!closed ? (
        <div className="neu-raised grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Student link</p>
            <Input readOnly value={joinUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Room code</p>
            <div className="flex items-center gap-2">
              <div className="neu-inset flex-1 rounded-xl px-3 py-2 text-center text-lg font-bold tracking-[0.3em]">
                {code ?? "••••••"}
              </div>
              <Button variant="outline" size="sm" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" onClick={regenerate} disabled={pending}>
                {code ? "New code" : "Reveal"}
              </Button>
            </div>
          </div>
          {error ? <p className="text-xs text-destructive sm:col-span-2">{error}</p> : null}
        </div>
      ) : null}

      {room.status === "lobby" ? (
        <div className="neu-raised flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Test</p>
            <select
              className="neu-inset w-full rounded-xl bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30"
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
          <Button variant="outline" className="neu-raised border-0 shadow-none transition-transform hover:-translate-y-0.5" onClick={assignTest} disabled={pending || !selectedTestId}>
            {assignedTestId === selectedTestId && selectedTestId ? "Assigned" : "Assign"}
          </Button>
          <Button className="shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5" onClick={startTest} disabled={pending || !assignedTestId}>
            Start test
          </Button>
        </div>
      ) : room.status === "in_test" ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          Test in progress. Students are answering now.
        </div>
      ) : null}

      {/* Premium: shareable participant report cards. Offered only once the
          test has ended, because the report reveals the answer key. */}
      {reportCardsEnabled && (room.status === "finished" || closed) ? (
        <section className="neu-raised space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                Student report cards
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Premium
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Share one link with the whole room. Each student opens it, enters the CBT ID they got
                during the test, and sees their own full analysis.
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={reportShared}
                disabled={pending}
                onChange={(e) => toggleReportShare(e.target.checked)}
              />
              {reportShared ? "Published" : "Not published"}
            </label>
          </div>

          {reportShared ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={reportUrl} onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="outline"
                size="sm"
                className="neu-raised shrink-0 border-0 shadow-none transition-transform hover:-translate-y-0.5"
                onClick={() => {
                  void navigator.clipboard?.writeText(reportUrl).then(
                    () => {
                      setLinkCopied(true);
                      window.setTimeout(() => setLinkCopied(false), 2000);
                    },
                    () => setError("Could not copy — select the link and copy it manually."),
                  );
                }}
              >
                {linkCopied ? "Copied" : "Copy link"}
              </Button>
            </div>
          ) : null}
        </section>
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
