/**
 * Client-safe CBT room + participant model (types only).
 */

import type { CbtParticipantStatus } from "./events";
import type { CbtFinalizeReason } from "./finalize-reason";

export type CbtRoomStatus = "lobby" | "in_test" | "finished" | "closed";

/**
 * How a student who lost their session may get their attempt back.
 *  • `name_or_id` (default) — the student ID, or their name with an explicit
 *    confirmation prompt when the matching attempt is currently offline.
 *  • `id_only` — the student ID only; no name matching.
 */
export type CbtRejoinPolicy = "name_or_id" | "id_only";

export type CbtRoom = {
  id: string;
  teacherId: string;
  name: string;
  publicSlug: string;
  status: CbtRoomStatus;
  testId: string | null;
  startedAt: string | null;
  durationSeconds: number | null;
  endedAt: string | null;
  capacity: number;
  rejoinPolicy: CbtRejoinPolicy;
  /**
   * Has the teacher published this room's participant report cards? The public
   * report link resolves only when this is true AND the teacher's admin-level
   * report-card add-on is enabled.
   */
  reportShareEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CbtParticipant = {
  id: string;
  roomId: string;
  displayName: string;
  studentCode: string;
  status: CbtParticipantStatus;
  joinedAt: string;
  enteredTestAt: string | null;
  lastSeenAt: string | null;
  finishedAt: string | null;
  autoSubmitted: boolean;
  /** Why the attempt ended; null while it is still running. */
  finalizeReason: CbtFinalizeReason | null;
  /** How many times this student recovered their session (cookie/ID/name). */
  rejoinCount: number;
  lastRejoinAt: string | null;
  /** Integrity strikes recorded at submit time. */
  violationCount: number;
  answeredCount: number;
  score: number | null;
  maxScore: number | null;
  rank: number | null;
  timeTakenSeconds: number | null;
};

export type CbtRoomWithParticipants = CbtRoom & {
  participants: CbtParticipant[];
};
