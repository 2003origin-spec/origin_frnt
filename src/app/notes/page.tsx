import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';

import NotesClient from './_client';

// Origin Notes — student page (V1/NOTES_PLAN.md §3). Dark until TEACHER_LAUNCH_NOTES.
export const dynamic = 'force-dynamic';

export default function NotesPage() {
  if (!isFeatureEnabled('notes')) notFound();
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <NotesGate />
    </Suspense>
  );
}

async function NotesGate() {
  const user = await getServerUser();
  if (!user) redirect('/auth?next=/notes');
  if (user.role === 'admin') redirect('/admin/notes');
  if (user.role !== 'student') redirect('/');
  // My Notes has its own switch, so the library can launch first.
  const myNotesEnabled = isFeatureEnabled('notesUploads');
  // Sharing needs My Notes and Social too (the admin switch is checked by the API).
  const sharingEnabled = myNotesEnabled && isFeatureEnabled('studentSocial') && isFeatureEnabled('notesSharing');
  return <NotesClient myNotesEnabled={myNotesEnabled} sharingEnabled={sharingEnabled} />;
}
