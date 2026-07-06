import { z } from "zod";

/**
 * CBT room realtime event union (zod). Mirrors the study-rooms events pattern.
 * The `type` field is used as the Redis stream field type; the full event is
 * JSON in `payload`.
 */

export const cbtParticipantStatusSchema = z.enum(["in_lobby", "giving_test", "submitted", "offline"]);
export type CbtParticipantStatus = z.infer<typeof cbtParticipantStatusSchema>;

export const cbtParticipantSummarySchema = z.object({
  participant_id: z.string(),
  display_name: z.string(),
  student_code: z.string(),
  status: cbtParticipantStatusSchema,
  answered_count: z.number().int().nonnegative(),
  last_seen_at: z.string().nullable().optional(),
});
export type CbtParticipantSummary = z.infer<typeof cbtParticipantSummarySchema>;

export const cbtRoomEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("presence"),
    participants: z.array(cbtParticipantSummarySchema),
    count: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("participant_joined"), participant: cbtParticipantSummarySchema }),
  z.object({ type: z.literal("test_configured"), test_id: z.string(), title: z.string() }),
  z.object({
    type: z.literal("test_started"),
    started_at: z.string(),
    duration_seconds: z.number().int().nonnegative(),
    server_emit_ts: z.number(),
  }),
  z.object({ type: z.literal("participant_finished"), participant_id: z.string(), student_code: z.string() }),
  z.object({ type: z.literal("test_ended") }),
  z.object({ type: z.literal("room_closed") }),
  z.object({ type: z.literal("kicked"), participant_id: z.string() }),
]);

export type CbtRoomEvent = z.infer<typeof cbtRoomEventSchema>;
