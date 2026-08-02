"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { type CbtStudentPhase, nextPhase, phaseFromState } from "@/lib/cbt/student-phase";
import { loadLocalIdentity, saveLocalIdentity } from "@/lib/cbt/local-attempt";
import { subscribeAppResume } from "@/native/app-resume";

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
  serverNow?: string;
};

export type CbtRoomContextValue = {
  phase: CbtStudentPhase;
  studentCode: string | null;
  displayName: string | null;
  /** Student ID remembered on this device — offered on the join screen. */
  rememberedStudentCode: string | null;
  room: CbtRoomView | null;
  slug: string;
  roomId: string;
  roomName: string;
  instituteName: string | null;
  instituteLogo: string | null;
  markJoined: (identity: { studentCode: string; participantId?: string; displayName?: string }) => void;
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
  instituteName = null,
  instituteLogo = null,
  children,
}: {
  slug: string;
  roomId: string;
  roomName: string;
  instituteName?: string | null;
  instituteLogo?: string | null;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<CbtStudentPhase>("checking");
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [rememberedStudentCode, setRememberedStudentCode] = useState<string | null>(null);
  const [room, setRoom] = useState<CbtRoomView | null>(null);
  const joinedRef = useRef(false);

  // What this device remembers about a previous session here. The participant
  // cookie is HttpOnly, so when it is gone this is the only thing standing
  // between the student and a blank second attempt.
  useEffect(() => {
    const remembered = loadLocalIdentity(slug);
    if (remembered) setRememberedStudentCode(remembered.studentCode);
  }, [slug]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cbt-student/state", { credentials: "include" });
      if (!res.ok) {
        // 401 while already in the test means the session was invalidated —
        // kicked, or this attempt was resumed on another device. Either way the
        // student must re-identify rather than keep typing into a dead session.
        if (res.status === 401 && joinedRef.current) {
          joinedRef.current = false;
          setPhase((prev) => nextPhase(prev, "join"));
          return;
        }
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
      saveLocalIdentity(slug, {
        studentCode: data.participant.studentCode,
        participantId: data.participant.id,
        displayName: data.participant.displayName,
      });
      setRememberedStudentCode(data.participant.studentCode);
      // nextPhase keeps terminal phases sticky: a finished attempt can never be
      // pulled back into the test by a later refresh.
      setPhase((prev) => nextPhase(prev, phaseFromState(data)));
    } catch {
      if (!joinedRef.current) setPhase("join");
    }
  }, [roomId, slug]);

  // Once submitted, stay submitted. Called by the player right after it posts
  // the submission so the context unmounts the player immediately (belt-and-
  // suspenders with the server's finished_at gate + the refresh() below).
  const markSubmitted = useCallback(() => {
    setPhase((prev) => nextPhase(prev, "submitted"));
  }, []);

  const markJoined = useCallback(
    (identity: { studentCode: string; participantId?: string; displayName?: string }) => {
      joinedRef.current = true;
      setStudentCode(identity.studentCode);
      setRememberedStudentCode(identity.studentCode);
      saveLocalIdentity(slug, {
        studentCode: identity.studentCode,
        participantId: identity.participantId ?? "",
        displayName: identity.displayName ?? "",
      });
      // A reclaimed attempt may already be mid-test; refresh() below resolves
      // the authoritative phase either way, and lobby is the safe placeholder.
      setPhase("lobby");
      void refresh();
    },
    [refresh, slug],
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
    // Coming back from a network outage: re-sync immediately rather than
    // waiting for the next heartbeat, so a student who reconnects with seconds
    // left still sees the right state.
    const onOnline = () => void refresh();
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  // Android shell: Doze can kill the SSE connection past EventSource's own
  // retry; bumping the epoch on app resume recreates it. The existing
  // visibilitychange refresh above re-syncs state; this restores the live
  // stream (plan ledger #39).
  const [streamEpoch, setStreamEpoch] = useState(0);
  useEffect(() => subscribeAppResume(() => setStreamEpoch((epoch) => epoch + 1)), []);

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
  }, [phase, streamEpoch]);

  const value: CbtRoomContextValue = {
    phase,
    studentCode,
    displayName,
    rememberedStudentCode,
    room,
    slug,
    roomId,
    roomName,
    instituteName,
    instituteLogo,
    markJoined,
    markSubmitted,
    refresh,
  };

  return <CbtRoomContext.Provider value={value}>{children}</CbtRoomContext.Provider>;
}
