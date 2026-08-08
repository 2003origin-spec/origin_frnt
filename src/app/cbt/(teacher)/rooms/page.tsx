export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { getCbtQuotaState } from "@/server/cbt/cbt-quota-service";
import { listRooms } from "@/server/cbt/cbt-rooms-service";
import { CbtRoomList } from "@/components/cbt/CbtRoomList";
import type { CbtQuotaClientState } from "@/components/cbt/quota-client";

export default async function CbtRoomsPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const [rooms, quota] = await Promise.all([
    listRooms(teacher.id),
    loadQuota(teacher.id),
  ]);
  return <CbtRoomList initialRooms={rooms} quota={quota} />;
}

/** Best-effort: a quota read failure must not take down the room list. */
async function loadQuota(teacherId: string): Promise<CbtQuotaClientState | null> {
  if (!isFeatureEnabled("cbtParticipationQuota")) return null;
  try {
    return await getCbtQuotaState(teacherId);
  } catch (error) {
    console.error("[cbt] rooms quota load failed", error instanceof Error ? error.message : error);
    return null;
  }
}
