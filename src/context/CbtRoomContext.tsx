"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { type CbtStudentPhase, nextPhase, phaseFromState } from "@/lib/cbt/student-phase";

export type { CbtStudentPhase };

type CbtRoomView = {
  id: string;
  name: string;
  status: string;
  startedAt: string | null;
  durationSeconds: number | null;
  hasTest: boolean;
};

type StateResponse = {
  room: CbtRoomView;
  participant: {
    id: string;
    displayName: string;
    studentCode: string;
    status: string;
    finishedAt: string | null;
    enteredTestAt: string | null;
  };
};

export type CbtRoomContextValue = {
  phase: CbtStudentPhase;
  studentCode: string | null;
  displayName: string | null;
  room: CbtRoomView | null;
  slug: string;
  roomId: string;
  roomName: string;
  markJoined: (studentCode: string) => void;
  markSubmitted: () => void;
  refresh: () => Promise<void>;
};

const CbtRoomContext = createContext<CbtRoomContextValue | null>(null);

export function useCbtRoom(): CbtRoomContextValue {
  const ctx = useContext(CbtRoomContext);
  if (!ctx) throw new Error("useCbtRoom must be used within CbtRoomProvider");
  return ctx;
}

export function CbtRoomProvider({
  slug,
  roomId,
  roomName,
  children,
}: {
  slug: string;
  roomId: string;
  roomName: string;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<CbtStudentPhase>("checking");
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [room, setRoom] = useState<CbtRoomView | null>(null);
  const joinedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cbt-student/state", { credentials: "include" });
      if (!res.ok) {
        if (!joinedRef.current) setPhase("join");
        return;
      }
      const data = (await res.json()) as StateResponse;
      if (data.room.id !== roomId) {
        // Cookie belongs to a different room — this student hasn't joined here.
        if (!joinedRef.current) setPhase("join");
        return;
      }
      joinedRef.current = true;
      setRoom(data.room);
      setStudentCode(data.participant.studentCode);
      setDisplayName(data.participant.displayName);
      // nextPhase keeps terminal phases sticky: a finished attempt can never be
      // pulled back into the test by a later refresh.
      setPhase((prev) => nextPhase(prev, phaseFromState(data)));
    } catch {
      if (!joinedRef.current) setPhase("join");
    }
  }, [roomId]);

  // Once submitted, stay submitted. Called by the player right after it posts
  // the submission so the context unmounts the player immediately (belt-and-
  // suspenders with the server's finished_at gate + the refresh() below).
  const markSubmitted = useCallback(() => {
    setPhase((prev) => nextPhase(prev, "submitted"));
  }, []);

  const markJoined = useCallback(
    (code: string) => {
      joinedRef.current = true;
      setStudentCode(code);
      setPhase("lobby");
      void refresh();
    },
    [refresh],
  );

  // Initial state probe (do we already hold a valid cookie for this room?).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-check authoritative state when the page is restored from the browser
  // back-forward cache (bfcache) or the tab is refocused. A browser Back can
  // restore a frozen mid-test snapshot without re-running effects; without this
  // a submitted student would see the old player and appear to re-attempt.
  // refresh() re-derives the (sticky) terminal "submitted" phase and unmounts
  // the player.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Realtime + heartbeat, active only once joined.
  useEffect(() => {
    if (!joinedRef.current) return;
    if (phase === "closed" || phase === "kicked" || phase === "submitted") return;

    let disposed = false;
    const heartbeat = setInterval(() => {
      void fetch("/api/cbt-student/heartbeat", { method: "POST", credentials: "include" });
    }, 15_000);
    void fetch("/api/cbt-student/heartbeat", { method: "POST", credentials: "include" });

    const es = new EventSource("/api/cbt-student/stream", { withCredentials: true });
    es.addEventListener("test_started", (e) => {
      if (disposed) return;
      try {
        const d = JSON.parse((e as MessageEvent).data) as { started_at?: string; duration_seconds?: number };
        setRoom((prev) =>
          prev
            ? { ...prev, status: "in_test", startedAt: d.started_at ?? prev.startedAt, durationSeconds: d.duration_seconds ?? prev.durationSeconds }
            : prev,
        );
      } catch {
        // ignore malformed
      }
      setPhase((prev) => nextPhase(prev, "in_test"));
    });
    es.addEventListener("test_ended", () => !disposed && setPhase((prev) => nextPhase(prev, "submitted")));
    es.addEventListener("room_closed", () => {
      if (!disposed) setPhase((prev) => nextPhase(prev, "closed"));
      es.close();
    });
    es.addEventListener("kicked", () => {
      if (!disposed) setPhase((prev) => nextPhase(prev, "kicked"));
      es.close();
    });

    return () => {
      disposed = true;
      clearInterval(heartbeat);
      es.close();
    };
  }, [phase]);

  const value: CbtRoomContextValue = {
    phase,
    studentCode,
    displayName,
    room,
    slug,
    roomId,
    roomName,
    markJoined,
    markSubmitted,
    refresh,
  };

  return <CbtRoomContext.Provider value={value}>{children}</CbtRoomContext.Provider>;
}
