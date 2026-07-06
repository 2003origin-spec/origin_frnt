"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type CbtStudentPhase =
  | "checking"
  | "join"
  | "lobby"
  | "in_test"
  | "submitted"
  | "closed"
  | "kicked";

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
  refresh: () => Promise<void>;
};

const CbtRoomContext = createContext<CbtRoomContextValue | null>(null);

export function useCbtRoom(): CbtRoomContextValue {
  const ctx = useContext(CbtRoomContext);
  if (!ctx) throw new Error("useCbtRoom must be used within CbtRoomProvider");
  return ctx;
}

function phaseFromState(state: StateResponse): CbtStudentPhase {
  if (state.room.status === "closed") return "closed";
  if (state.participant.finishedAt) return "submitted";
  if (state.room.status === "in_test") return "in_test";
  return "lobby";
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
      setPhase(phaseFromState(data));
    } catch {
      if (!joinedRef.current) setPhase("join");
    }
  }, [roomId]);

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
      setPhase("in_test");
    });
    es.addEventListener("test_ended", () => !disposed && setPhase("submitted"));
    es.addEventListener("room_closed", () => {
      if (!disposed) setPhase("closed");
      es.close();
    });
    es.addEventListener("kicked", () => {
      if (!disposed) setPhase("kicked");
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
    refresh,
  };

  return <CbtRoomContext.Provider value={value}>{children}</CbtRoomContext.Provider>;
}
