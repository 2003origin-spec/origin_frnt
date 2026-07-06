/**
 * Study-rooms Redis code-token + stream helpers. Thin caller over the generic
 * `redis-streams` namespace factory — the `room:` key shape and public API are
 * unchanged (guarded by tests/study-rooms).
 */

import { createRedisStreamNamespace } from "@/server/redis-streams";
import type { RoomEvent } from "@/lib/study-rooms/events";

const ns = createRedisStreamNamespace<RoomEvent>({
  label: "study-rooms",
  codeKey: (code) => `room:code:${code}`,
  activeCodeKey: (roomId) => `room:active-code:${roomId}`,
  streamKey: (roomId) => `room:${roomId}:stream`,
});

export function setRoomCodeToken(code: string, jwt: string, roomId: string, ttlSeconds: number): Promise<boolean> {
  return ns.setCodeToken(code, jwt, roomId, ttlSeconds);
}

export function getRoomCodeToken(code: string): Promise<string | null> {
  return ns.getCodeToken(code);
}

export function deleteRoomCode(code: string, roomId?: string): Promise<void> {
  return ns.deleteCode(code, roomId);
}

export function deleteActiveRoomCode(roomId: string): Promise<void> {
  return ns.deleteActiveCode(roomId);
}

export function getActiveRoomCode(roomId: string): Promise<{ code: string; ttlSeconds: number } | null> {
  return ns.getActiveCode(roomId);
}

export function deleteRoomStream(roomId: string): Promise<void> {
  return ns.deleteStream(roomId);
}

export function appendRoomStreamEvent(roomId: string, event: RoomEvent): Promise<string | null> {
  return ns.appendStreamEvent(roomId, event);
}

export function readRoomStreamEvents(
  roomId: string,
  cursor: string,
  options: { count?: number; blockMs?: number; signal?: AbortSignal } = {},
): Promise<{ id: string; event: RoomEvent }[]> {
  return ns.readStreamEvents(roomId, cursor, options);
}
