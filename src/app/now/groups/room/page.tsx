'use client';

/** /now/groups/room?id=… — the live group session room (B95). Query-string route like /now/room (decision B53). */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import NowGroupRoom from '@/sections/now/NowGroupRoom';

function Room() {
  const id = useSearchParams().get('id');
  return id ? <NowGroupRoom groupId={id} /> : <p className="p-6 text-sm text-muted-foreground">No session chosen.</p>;
}

export default function NowGroupRoomPage() {
  return (
    <Suspense fallback={null}>
      <Room />
    </Suspense>
  );
}
