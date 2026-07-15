'use server';

import { getServerUser } from '@/lib/auth-server';
import { recordScreenPresence } from '@/server/presence';

/**
 * Heartbeat for the global "active screens" counter. Called periodically by the
 * app shell while the tab is open + visible. The screen id is a per-tab id so
 * the count reflects screens (not distinct users). Silent no-op when signed out.
 */
export async function heartbeatPresenceAction(screenId: string): Promise<void> {
  const user = await getServerUser().catch(() => null);
  if (!user) return;
  const id = String(screenId ?? '').slice(0, 64);
  if (!id) return;
  await recordScreenPresence(`${user.id}:${id}`);
}
