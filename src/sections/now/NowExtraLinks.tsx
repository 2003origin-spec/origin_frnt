'use client';

/** Links to the extra parts a student can use, only when switched on (Ask later B94, group sessions B95). */

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { apiCall } from '@/lib/api';

type Features = { askLater: boolean; groups: boolean };

export function NowExtraLinks() {
  const [features, setFeatures] = useState<Features | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiCall('/now/me')
      .then((res) => !cancelled && setFeatures((res as { features: Features | null }).features))
      .catch(() => !cancelled && setFeatures(null));
    return () => {
      cancelled = true;
    };
  }, []);
  if (!features || (!features.askLater && !features.groups)) return null;
  return (
    <nav className="flex flex-wrap gap-2" aria-label="More help">
      {features.askLater && (
        <Link href="/now/later" className="rounded-md border px-3 py-1 text-sm hover:bg-muted">Asked for later</Link>
      )}
      {features.groups && (
        <Link href="/now/groups" className="rounded-md border px-3 py-1 text-sm hover:bg-muted">Group sessions</Link>
      )}
    </nav>
  );
}
