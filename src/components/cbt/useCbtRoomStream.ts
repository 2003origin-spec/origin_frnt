"use client";

import { useEffect, useRef, useState } from "react";

import type { CbtParticipantSummary } from "@/lib/cbt/events";

type LifecycleEvent = { type: string; at: number };

/**
 * Teacher-side room realtime: EventSource to the room stream with a polling
 * fallback (both cloned from the study-rooms pattern). Presence events replace
 * the participant list; a 5s poll to /participants covers SSE gaps on Vercel.
 */
export function useCbtRoomStream(roomId: string, initial: CbtParticipantSummary[]) {
  const [participants, setParticipants] = useState<CbtParticipantSummary[]>(initial);
  const [connected, setConnected] = useState(false);
  const [lifecycle, setLifecycle] = useState<LifecycleEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let disposed = false;

    async function poll() {
      try {
        const res = await fetch(`/api/cbt/rooms/${roomId}/participants`, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { participants: CbtParticipantSummary[] };
        if (!disposed && Array.isArray(data.participants)) setParticipants(data.participants);
      } catch {
        // ignore — SSE is primary
      }
    }

    const pollTimer = setInterval(poll, 5000);

    const es = new EventSource(`/api/cbt/rooms/${roomId}/stream`, { withCredentials: true });
    esRef.current = es;
    es.onopen = () => !disposed && setConnected(true);
    es.onerror = () => !disposed && setConnected(false); // EventSource auto-reconnects
    es.addEventListener("presence", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { participants: CbtParticipantSummary[] };
        if (!disposed) setParticipants(data.participants);
      } catch {
        // ignore malformed
      }
    });
    for (const type of ["test_started", "participant_finished", "test_ended", "room_closed"]) {
      es.addEventListener(type, () => {
        if (!disposed) {
          setLifecycle({ type, at: Date.now() });
          if (type !== "room_closed") void poll();
        }
      });
    }

    return () => {
      disposed = true;
      clearInterval(pollTimer);
      es.close();
      esRef.current = null;
    };
  }, [roomId]);

  return { participants, connected, lifecycle };
}
