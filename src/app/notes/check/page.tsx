import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import OriLoadingScreen from '@/components/ui/OriLoadingScreen';

import NotesPhoneCheck from './_client';

// Phase 0 phone check (V1/NOTES_PLAN.md §12): the admin Checks tab without the
// admin menu, which leaves no room on a phone. Admins only; deliberately not
// behind the `notes` flag, so it can run before launch.
export const dynamic = 'force-dynamic';

export default function NotesCheckPage() {
  return (
    <Suspense fallback={<OriLoadingScreen />}>
      <NotesCheckGate />
    </Suspense>
  );
}

async function NotesCheckGate() {
  const user = await getServerUser();
  if (!user) redirect('/auth?role=admin');
  if (user.role !== 'admin') redirect('/notes');
  return <NotesPhoneCheck />;
}
