export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { getRoomWithParticipants } from "@/server/cbt/cbt-rooms-service";
import type { CbtParticipantSummary } from "@/lib/cbt/events";
import { CbtRoomConsole } from "@/components/cbt/CbtRoomConsole";

export default async function CbtRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const { roomId } = await params;
  const room = await getRoomWithParticipants(teacher.id, roomId);
  if (!room) notFound();

  const initialParticipants: CbtParticipantSummary[] = room.participants.map((p) => ({
    participant_id: p.id,
    display_name: p.displayName,
    student_code: p.studentCode,
    status: p.status,
    answered_count: p.answeredCount,
    last_seen_at: p.lastSeenAt,
  }));

  const { participants: _participants, ...roomMeta } = room;
  // The premium report-card surface needs BOTH the platform kill switch and
  // this teacher's admin-granted entitlement.
  const reportCardsEnabled = isFeatureEnabled("cbtReportCards") && teacher.reportCardsEnabled;
  return (
    <CbtRoomConsole
      room={roomMeta}
      initialParticipants={initialParticipants}
      reportCardsEnabled={reportCardsEnabled}
    />
  );
}
