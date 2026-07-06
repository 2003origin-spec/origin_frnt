/** GET /api/cbt/rooms/[roomId]/stream — teacher SSE (ownership rechecked ~15s). */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { getRoomForTeacher } from "@/server/cbt/cbt-rooms-service";
import { readCbtRoomEvents } from "@/server/cbt/cbt-redis";

export const maxDuration = 60;

function encodeSse(eventId: string, eventType: string, payload: unknown): Uint8Array {
  return new TextEncoder().encode(`id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { roomId } = await context.params;
    const room = await getRoomForTeacher(ctx.cbtTeacherId, roomId);
    if (!room) return teacherJson({ detail: "Room not found." }, { status: 404 });

    const initialCursor = request.headers.get("last-event-id") ?? "$";
    const signal = request.signal;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let cursor = initialCursor;
        let lastOwnershipCheck = Date.now();
        controller.enqueue(encoder.encode(": connected\n\n"));
        try {
          while (!signal.aborted) {
            const events = await readCbtRoomEvents(roomId, cursor, { count: 50, blockMs: 20_000, signal });

            if (Date.now() - lastOwnershipCheck > 15_000) {
              const still = await getRoomForTeacher(ctx.cbtTeacherId, roomId);
              if (!still) break;
              lastOwnershipCheck = Date.now();
            }

            if (events.length === 0) {
              controller.enqueue(encoder.encode(": keepalive\n\n"));
              continue;
            }
            for (const entry of events) {
              controller.enqueue(encodeSse(entry.id, entry.event.type, entry.event));
              cursor = entry.id;
              if (entry.event.type === "room_closed") return;
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
  } catch (error) {
    return handleTeacherError(error);
  }
}
