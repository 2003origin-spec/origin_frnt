import Link from 'next/link';
import { CalendarClock, Lock } from 'lucide-react';

import { formatISTDateTimeDMY } from '@/lib/format-time';
import type { TestWindowErrorCode } from '@/lib/assessments/test-window';

/**
 * Shown at /tests/[id] when a teacher-assigned test's window refuses the paper:
 * before it opens (no questions are sent) or after it closes. Times read in IST.
 */
export default function TestWindowNotice({
  code,
  startsAt,
  endsAt,
}: {
  code: TestWindowErrorCode;
  startsAt: string | null;
  endsAt: string | null;
}) {
  const upcoming = code === 'test_not_started';
  return (
    <main className="min-h-dvh bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {upcoming ? <CalendarClock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
        </div>
        <h1 className="text-lg font-black tracking-tight">
          {upcoming ? 'This test has not started yet' : 'This test has ended'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {upcoming
            ? startsAt
              ? `It opens on ${formatISTDateTimeDMY(startsAt)}. Come back then to start.`
              : 'Your teacher has not opened it yet.'
            : endsAt
              ? `The window closed on ${formatISTDateTimeDMY(endsAt)}. New attempts are no longer accepted.`
              : 'New attempts are no longer accepted.'}
        </p>
        <Link
          href="/tests"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90"
        >
          Back to tests
        </Link>
      </div>
    </main>
  );
}
