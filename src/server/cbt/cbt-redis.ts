/**
 * CBT room realtime stream helpers. Thin caller over the generic redis-streams
 * namespace with `cbt:room:` key prefixes (separate keyspace from study rooms).
 */

import { createRedisStreamNamespace } from "@/server/redis-streams";
import type { CbtRoomEvent } from "@/lib/cbt/events";

const ns = createRedisStreamNamespace<CbtRoomEvent>({
  label: "cbt",
  codeKey: (code) => `cbt:room:code:${code}`,
  activeCodeKey: (roomId) => `cbt:room:active-code:${roomId}`,
  streamKey: (roomId) => `cbt:room:${roomId}:stream`,
});

export function appendCbtRoomEvent(roomId: string, event: CbtRoomEvent): Promise<string | null> {
  return ns.appendStreamEvent(roomId, event);
}

export function readCbtRoomEvents(
  roomId: string,
  cursor: string,
  options: { count?: number; blockMs?: number; signal?: AbortSignal } = {},
): Promise<{ id: string; event: CbtRoomEvent }[]> {
  return ns.readStreamEvents(roomId, cursor, options);
}

export function deleteCbtRoomStream(roomId: string): Promise<void> {
  return ns.deleteStream(roomId);
}
