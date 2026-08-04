import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getPublicReportRoomBySlug } from "@/server/cbt/cbt-report-service";
import { CbtReportExperience } from "@/components/cbt/report/CbtReportExperience";

/**
 * Public participant report card. Reachable at the edge via the existing
 * `/cbt/r` public prefix (no route-policy change needed); the actual gate is
 * the room's publish switch + the teacher's premium add-on, both re-checked in
 * the service on every request.
 *
 * noindex + no-referrer for the same reason as the room page: the slug is the
 * unguessable half of the credential and must not leak into search indexes or
 * Referer headers.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CbtReportPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isFeatureEnabled("cbtModule") || !isFeatureEnabled("cbtReportCards")) notFound();

  const { slug } = await params;
  // Renders nothing more than the institute lockup and the room name — the
  // report itself needs the student's own CBT ID.
  const room = await getPublicReportRoomBySlug(slug);
  if (!room) notFound();

  return (
    <CbtReportExperience
      slug={slug}
      roomName={room.roomName}
      instituteName={room.instituteName}
      instituteLogo={room.instituteLogo}
    />
  );
}
