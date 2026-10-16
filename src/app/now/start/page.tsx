'use client';

/**
 * /now/start — before a student's first live help: date of birth, and for an
 * under-18 a guardian consent request (plan doc "Guardian consent"). The
 * guardian confirms on the public /now/consent page from the email link.
 */

import Link from 'next/link';
import { useState } from 'react';

import { GuardianConsentForm } from '@/components/now/GuardianConsentForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NowStartPage() {
  const [ready, setReady] = useState(false);
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Before your first live session</CardTitle>
          <CardDescription>
            Live help is a short audio call about one question. Calls are recorded for safety and deleted after 30 days, and your contact details are never shared.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <GuardianConsentForm purpose="student" onReady={() => setReady(true)} />
          {ready && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/ogcode" className="rounded-md bg-primary px-3 py-1 text-primary-foreground">Go to questions</Link>
              <Link href="/now/wallet" className="rounded-md border px-3 py-1">My coins</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
