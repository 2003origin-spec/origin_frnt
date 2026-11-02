import { notFound, redirect } from 'next/navigation';

import MessageThread from '@/components/messaging/MessageThread';
import { getServerUser } from '@/lib/auth-server';
import { isFeatureEnabled } from '@/lib/feature-flags';

// Student messaging — one conversation (`/messages/<id>`, also the link in the
// message notifications). Dark unless `studentMessaging` + `studentSocial`.
export const dynamic = 'force-dynamic';

export default async function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('studentMessaging') || !isFeatureEnabled('studentSocial')) notFound();
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/messages/${id}`)}`);
  if (user.role !== 'student') redirect('/');
  return <MessageThread key={id} conversationId={id} />;
}
