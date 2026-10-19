'use client';

/**
 * /now/room?request=<id> — the Origin NOW live room for the student and the
 * assigned solver (build step 6). Authenticated (/now app prefix); the API
 * refuses anyone else. Query parameter instead of a dynamic segment, same as
 * /now/consent, to keep to the repo's existing route shapes.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import NowLiveRoom from '@/sections/now/NowLiveRoom';

function RoomFromQuery() {
  const requestId = useSearchParams().get('request') ?? '';
  if (!requestId) {
    return <p className="p-6 text-sm text-muted-foreground">This link is missing its request.</p>;
  }
  return <NowLiveRoom requestId={requestId} />;
}

export default function NowRoomPage() {
  return (
    <Suspense fallback={null}>
      <RoomFromQuery />
    </Suspense>
  );
}
