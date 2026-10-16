'use client';

/**
 * Origin NOW entry on the student home (/dashboard). Renders nothing unless
 * the flag is on and this account is in the pilot (or is a solver), so the
 * card is invisible to everyone else (plan doc "Pilot shape").
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, Headphones } from 'lucide-react';

type Me = {
  access: { canRequest: boolean; inCohort: boolean; blockedReason: string | null; helper: { verificationStatus: string } | null };
  wallet: { balance: { available: number; pending: number } } | null;
};

export function NowDashboardCard() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/now/me', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => (res.ok ? ((await res.json()) as Me) : null))
      .then((data) => !cancelled && setMe(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (!me || (!me.access.inCohort && !me.access.helper)) return null;
  const balance = me.wallet?.balance.available ?? 0;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Headphones className="h-4 w-4 text-primary" aria-hidden /> Live help <span className="text-xs font-normal text-muted-foreground">pilot</span>
        </p>
        <span className="flex items-center gap-1 text-sm">
          <Coins className="h-4 w-4 text-amber-600" aria-hidden /> {balance.toLocaleString('en-IN')}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {me.access.blockedReason === 'suspended'
          ? 'Live help is paused on this account after a report review.'
          : 'Stuck after trying a question? Ask a teacher live from the question page.'}
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        {me.access.inCohort && (
          <Link href="/now/doubts" className="rounded-md border px-3 py-1 hover:bg-muted">My doubts</Link>
        )}
        <Link href="/now/store" className="rounded-md border px-3 py-1 hover:bg-muted">Store</Link>
        {me.access.helper && (
          <Link href="/now/solver" className="rounded-md border px-3 py-1 hover:bg-muted">Solver dashboard</Link>
        )}
      </div>
    </div>
  );
}
