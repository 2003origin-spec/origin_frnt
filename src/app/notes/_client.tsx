'use client';

import { Suspense } from 'react';

import OriLoadingScreen from '@/components/ui/OriLoadingScreen';
import NotesApp from '@/sections/notes/NotesApp';

// NotesApp reads the folder/note from the URL query (useSearchParams), which
// needs its own Suspense boundary.
export default function NotesClient({ myNotesEnabled, sharingEnabled }: { myNotesEnabled: boolean; sharingEnabled: boolean }) {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <NotesApp myNotesEnabled={myNotesEnabled} sharingEnabled={sharingEnabled} />
    </Suspense>
  );
}
