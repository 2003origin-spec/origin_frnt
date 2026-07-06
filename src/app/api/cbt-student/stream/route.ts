/**
 * GET /api/cbt-student/stream — student SSE. Bound to the participant token;
 * drops when the participant is kicked or the room closes. Re-verifies the
 * participant (kick / token_version) every ~15s.
 */

import type { NextRequest } from "next/server";

import { readCbtRoomEvents } from "@/server/cbt/cbt-redis";
import { resolveParticipantFromToken } from "@/server/cbt/cbt-rooms-service";
import { CBT_PARTICIPANT_COOKIE } from "@/lib/cbt/participant-token";

import { cbtEnabled, notFoundWhenDisabled, studentJson } from "../_utils";

export const maxDuration = 60;

function encodeSse(eventId: string, eventType: string, payload: unknown): Uint8Array {
  return new TextEncoder().encode(`id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();

  const token = request.cookies.get(CBT_PARTICIPANT_COOKIE)?.value;
  const resolved = await resolveParticipantFromToken(token);
  if (!resolved) return studentJson({ detail: "Not in a room." }, { status: 401 });

  const roomId = resolved.room.id;
  const participantId = resolved.participant.id;
  const initialCursor = request.headers.get("last-event-id") ?? "$";
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let cursor = initialCursor;
      let lastCheck = Date.now();
      controller.enqueue(encoder.encode(": connected\n\n"));
      try {
        while (!signal.aborted) {
          const events = await readCbtRoomEvents(roomId, cursor, { count: 50, blockMs: 20_000, signal });

          if (Date.now() - lastCheck > 15_000) {
            const still = await resolveParticipantFromToken(token);
            if (!still) {
              controller.enqueue(encodeSse(cursor, "kicked", { type: "kicked", participant_id: participantId }));
              break;
            }
            lastCheck = Date.now();
          }

          if (events.length === 0) {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
            continue;
          }
          for (const entry of events) {
            cursor = entry.id;
            const t = entry.event.type;
            // WHITELIST: students only ever receive non-sensitive lifecycle
            // events. presence / participant_joined / participant_finished /
            // test_configured carry other participants' data and are dropped.
            if (t === "test_started" || t === "test_ended" || t === "room_closed") {
              controller.enqueue(encodeSse(entry.id, t, entry.event));
              if (t === "room_closed") return;
            } else if (t === "kicked" && entry.event.participant_id === participantId) {
              controller.enqueue(encodeSse(entry.id, t, entry.event));
              return;
            }
          }
        }
      } catch (error) {
        if (!signal.aborted) controller.error(error);
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
