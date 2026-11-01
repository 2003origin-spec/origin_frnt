'use client';

import { ChecksPanel } from '@/components/admin/notes/ChecksPanel';

export default function NotesPhoneCheck() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-12 pt-4">
      <div>
        <h1 className="font-display text-2xl font-black tracking-tight">Notes phone check</h1>
        <p className="text-sm text-muted-foreground">
          Run these on the phone, inside the Origin app. Then tap &ldquo;Copy results&rdquo; and send them to the team.
        </p>
      </div>
      <ChecksPanel />
    </div>
  );
}
