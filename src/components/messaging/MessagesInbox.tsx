'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreVertical, UserX } from 'lucide-react';

import { EmptyState, ErrorState, PageHeader, PageShell } from '@/components/layout/shells';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchInbox, MESSAGES_CHANGED_EVENT } from '@/features/messaging/client';
import { previewText, rowStatus, rowTime } from '@/features/messaging/messaging-ui';
import type { Conversation, InboxBox, InboxResponse } from '@/features/messaging/types';
import { cn } from '@/lib/utils';

import BlockedStudentsDialog from './BlockedStudentsDialog';
import { PersonAvatar, UsageLine } from './parts';

const REFRESH_MS = 30_000;

export default function MessagesInbox({ initialBox }: { initialBox: InboxBox }) {
  const router = useRouter();
  const [box, setBox] = useState<InboxBox>(initialBox);
  const [data, setData] = useState<InboxResponse | null>(null);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const boxRef = useRef(box);
  // A link to /messages?box=requests (e.g. from a notification) while this page
  // is already open changes the prop, not the mount: follow it.
  const [seenInitial, setSeenInitial] = useState(initialBox);
  if (seenInitial !== initialBox) {
    setSeenInitial(initialBox);
    setBox(initialBox);
  }

  const load = useCallback(async (which: InboxBox) => {
    const res = await fetchInbox(which);
    if (boxRef.current !== which) return; // the tab changed while this was in flight
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError({ status: res.status, detail: res.error.detail ?? 'That didn’t load.' });
    }
  }, []);

  useEffect(() => {
    boxRef.current = box;
    const t = window.setTimeout(() => void load(box), 0);
    return () => window.clearTimeout(t);
  }, [box, load]);

  // Light refresh while the page is open and visible.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void load(boxRef.current);
    };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener(MESSAGES_CHANGED_EVENT, tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, tick);
    };
  }, [load]);

  function selectBox(next: InboxBox) {
    if (next === box) return;
    setData((d) => (d ? { ...d, conversations: [] } : d));
    setBox(next);
    router.replace(next === 'requests' ? '/messages?box=requests' : '/messages', { scroll: false });
  }

  const requestCount = data?.requestCount ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Messages"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-lg" aria-label="Messages options">
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setBlockedOpen(true)}>
                <UserX className="size-4" /> Blocked students
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div role="tablist" aria-label="Messages" className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1">
        {(['inbox', 'requests'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={box === key}
            onClick={() => selectBox(key)}
            className={cn(
              'flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors',
              box === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {key === 'inbox' ? 'Inbox' : 'Requests'}
            {key === 'requests' && requestCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">
                {requestCount > 99 ? '99+' : requestCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {data?.usage ? <UsageLine usage={data.usage} className="mb-3 px-1" /> : null}

      {error && !data ? (
        error.status === 404 ? (
          <EmptyState
            title="Messages aren’t available right now"
            description={error.detail}
            action={{ label: 'Go home', href: '/dashboard' }}
            fill
          />
        ) : (
          <ErrorState description={error.detail} action={{ label: 'Try again', onClick: () => void load(box) }} />
        )
      ) : !data ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
          ))}
        </div>
      ) : data.conversations.length === 0 ? (
        box === 'inbox' ? (
          <EmptyState
            title="No messages yet"
            description="Open a student's profile and tap Message to start a conversation."
            action={{ label: 'Find students', href: '/social' }}
          />
        ) : (
          <EmptyState
            title="No message requests"
            description="When someone new messages you, it shows up here first."
            action={{ label: 'Back to inbox', onClick: () => selectBox('inbox') }}
          />
        )
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {data.conversations.map((c) => (
            <ConversationRow key={c.id} c={c} />
          ))}
        </ul>
      )}

      <BlockedStudentsDialog open={blockedOpen} onOpenChange={setBlockedOpen} onChanged={() => void load(box)} />
    </PageShell>
  );
}

function ConversationRow({ c }: { c: Conversation }) {
  const unread = c.unread > 0;
  const status = rowStatus(c);
  const at = c.lastMessage?.at ?? c.updatedAt;
  return (
    <li>
      <Link
        href={`/messages/${encodeURIComponent(c.id)}`}
        className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
      >
        <PersonAvatar person={c.other} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={cn('min-w-0 flex-1 truncate text-sm', unread ? 'font-black' : 'font-bold')}>{c.other.name}</p>
            <span className={cn('shrink-0 text-[11px] tabular-nums', unread ? 'font-bold text-primary' : 'text-muted-foreground')}>
              {rowTime(at)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className={cn('min-w-0 flex-1 truncate text-xs', unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {previewText(c)}
            </p>
            {status ? (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {status}
              </span>
            ) : null}
            {unread ? (
              <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label={`${c.unread} unread`} />
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
