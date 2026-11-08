import { Suspense } from 'react';

import { isFeatureEnabled } from '@/lib/feature-flags';
import NotesAdminConsole from '@/components/admin/notes/NotesAdminConsole';

// Admin access is enforced by src/app/admin/layout.tsx (role gate).
// Deliberately NOT behind the `notes` flag — see NotesAdminConsole.
export const dynamic = 'force-dynamic';

export default function AdminNotesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Notes…</div>}>
      <NotesAdminConsole studentLaunch={isFeatureEnabled('notes')} />
    </Suspense>
  );
}
