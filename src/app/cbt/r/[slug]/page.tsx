import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getPublicRoomBySlug } from '@/server/cbt/cbt-rooms-service';
import { CbtStudentExperience } from '@/components/cbt/CbtStudentExperience';

/**
 * Student room entry. Public at the edge — the only student-facing entry point,
 * reachable solely via the teacher-shared room link + room code. noindex +
 * nofollow keeps the unguessable slug out of search indexes.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  // Keep the unguessable slug out of Referer headers to any embedded/linked asset.
  referrer: 'no-referrer',
};

export default async function CbtStudentRoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isFeatureEnabled('cbtModule')) notFound();

  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);
  if (!room) notFound();

  if (room.status === 'closed') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Room closed</h1>
        <p className="text-sm text-muted-foreground">This session has ended.</p>
      </main>
    );
  }

  return <CbtStudentExperience slug={slug} roomId={room.id} roomName={room.name} />;
}
