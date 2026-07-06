export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getServerUser } from "@/lib/auth-server";
import { findActiveCbtTeacherByUserId } from "@/server/cbt/cbt-teachers-service";
import { listRooms } from "@/server/cbt/cbt-rooms-service";
import { CbtRoomList } from "@/components/cbt/CbtRoomList";

export default async function CbtRoomsPage() {
  if (!isFeatureEnabled("cbtModule")) notFound();
  const user = await getServerUser();
  if (!user || user.role !== "cbt_teacher") redirect("/cbt/login");
  const teacher = await findActiveCbtTeacherByUserId(user.id);
  if (!teacher) redirect("/cbt/login");

  const rooms = await listRooms(teacher.id);
  return <CbtRoomList initialRooms={rooms} />;
}
