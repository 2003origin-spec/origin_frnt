/**
 * Client-safe CBT room + participant model (types only).
 */

import type { CbtParticipantStatus } from "./events";

export type CbtRoomStatus = "lobby" | "in_test" | "finished" | "closed";

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
  answeredCount: number;
  score: number | null;
  maxScore: number | null;
  rank: number | null;
  timeTakenSeconds: number | null;
};

export type CbtRoomWithParticipants = CbtRoom & {
  participants: CbtParticipant[];
};
