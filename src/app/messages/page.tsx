import { notFound, redirect } from 'next/navigation';

import MessagesInbox from '@/components/messaging/MessagesInbox';
import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { parseBox } from '@/features/messaging/messaging-ui';

// Student messaging — inbox and requests (`/messages`, `/messages?box=requests`).
// Dark unless `studentMessaging` (and `studentSocial`) are on; students only.
export const dynamic = 'force-dynamic';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string | string[] }>;
}) {
  if (!isFeatureEnabled('studentMessaging') || !isFeatureEnabled('studentSocial')) notFound();
  const { box } = await searchParams;
  const initialBox = parseBox(box);
  const user = await getServerUser();
  if (!user) redirect(initialBox === 'requests' ? '/auth?next=%2Fmessages%3Fbox%3Drequests' : '/auth?next=/messages');
  if (user.role !== 'student') redirect('/');
  return <MessagesInbox initialBox={initialBox} />;
}
