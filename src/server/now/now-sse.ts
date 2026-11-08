/**
 * Server-sent events for Origin NOW, the study-room stream pattern:
 * a snapshot first (so nothing published between the client's fetch and its
 * subscribe is lost), then the Redis stream from `Last-Event-ID` or "now".
 * Each connection closes itself before the function's 60 s limit; EventSource
 * reconnects with `Last-Event-ID` and misses nothing.
 */

import { streamStartCursor } from "@/server/redis-streams";

import { readNowEvents } from "./now-realtime";

const CONNECTION_BUDGET_MS = 50_000;

function encodeSse(eventId: string | null, eventType: string, payload: unknown): Uint8Array {
  const idLine = eventId ? `id: ${eventId}\n` : "";
  return new TextEncoder().encode(`${idLine}event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export function nowEventStream(
  request: Request,
  input: {
    streamId: string;
    snapshot: () => Promise<unknown>;
    /** Re-checked every ~15 s; returning false ends the stream (e.g. access revoked). */
    stillAllowed?: () => Promise<boolean>;
    /** Event types after which the stream closes for good. */
    closeOn?: readonly string[];
  },
): Response {
  const signal = request.signal;
  // Never "$": with "$" a blocking read only sees entries added while it is
  // blocked, so anything published between two reads is lost (and the dev
  // fallback never returns anything). A concrete id taken BEFORE the snapshot,
  // with the shared clock-skew margin (STREAM_START_SKEW_MS), misses nothing; a
  // repeat only costs the client one extra refetch.
  const initialCursor = streamStartCursor(request.headers.get("last-event-id"));
  const encoder = new TextEncoder();

  // Set when the client goes away (cancel) — Next does not always abort
  // `request.signal` promptly, and enqueueing after that throws.
  let gone = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: Uint8Array): boolean => {
        if (gone || signal.aborted) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          gone = true;
          return false;
        }
      };
      const startedAt = Date.now();
      let cursor = initialCursor;
      let lastCheck = Date.now();
      try {
        send(encoder.encode("retry: 2000\n: connected\n\n"));
        send(encodeSse(null, "snapshot", await input.snapshot()));
        while (!gone && !signal.aborted && Date.now() - startedAt < CONNECTION_BUDGET_MS) {
          const events = await readNowEvents(input.streamId, cursor, { count: 50, blockMs: 15_000, signal });
          if (input.stillAllowed && Date.now() - lastCheck > 15_000) {
            lastCheck = Date.now();
            if (!(await input.stillAllowed())) {
              send(encodeSse(null, "access_lost", { type: "access_lost" }));
              return;
            }
          }
          if (events.length === 0) {
            if (!send(encoder.encode(": keepalive\n\n"))) return;
            continue;
          }
          for (const entry of events) {
            if (!send(encodeSse(entry.id, entry.event.type, entry.event))) return;
            cursor = entry.id;
            if (input.closeOn?.includes(entry.event.type)) return;
          }
        }
      } catch (error) {
        if (gone || signal.aborted) return;
        send(encodeSse(null, "error", { type: "error", message: "stream_failed" }));
        console.warn("[origin-now] stream failed", input.streamId, error instanceof Error ? error.message : error);
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }
    },
    cancel() {
      gone = true;
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
