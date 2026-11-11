'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { trackEvent } from '@/lib/analytics';

/** Sign-up / log-in link on the logged-out college finder page that also sends a GA click (no personal data). */
export default function TrackedAuthLink({ href, action, className, children }: { href: string; action: 'sign_up' | 'log_in'; className: string; children: ReactNode }) {
  return (
    <Link href={href} onClick={() => trackEvent('auth_cta_click', { action, source: 'college_teaser' })} className={className}>
      {children}
    </Link>
  );
}
