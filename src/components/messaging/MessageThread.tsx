'use client';

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban, Check, Flag, Loader2, MoreVertical, SendHorizontal, ShieldOff, X } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState, ErrorState } from '@/components/layout/shells';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  announceMessagesChanged,
  fetchThread,
  markRead,
  respond,
  sendMessage,
  takeDraft,
  unblock,
} from '@/features/messaging/client';
import {
  composerState,
  dayLabel,
  firstName,
  isCapReached,
  isNewDay,
  MESSAGE_MAX_CHARS,
  mergeMessages,
  threadBanner,
} from '@/features/messaging/messaging-ui';
import type { ChatMessage, Conversation, MessagingUsage } from '@/features/messaging/types';
import { formatISTTime } from '@/lib/format-time';
import { cn } from '@/lib/utils';

import { DailyLimitCard, PersonAvatar, UsageLine } from './parts';
import ReportDialog from './ReportDialog';

const POLL_MS = 10_000;
const PAGE = 30;

type LoadError = { status: number; detail: string };

export default function MessageThread({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [usage, setUsage] = useState<MessagingUsage | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [suspended, setSuspended] = useState<string | null>(null);
  const [limitDetail, setLimitDetail] = useState<string | null>(null);
  const [acting, setActing] = useState<null | 'accept' | 'decline' | 'block' | 'unblock'>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  /** Scroll intent for the next layout pass: stick to the bottom, or keep place after prepending. */
  const scrollIntent = useRef<{ kind: 'bottom' } | { kind: 'keep'; height: number; top: number } | null>(null);
  const readSent = useRef(false);

  const isNearBottom = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const sendRead = useCallback(async () => {
    const res = await markRead(conversationId);
    if (res.ok) announceMessagesChanged();
  }, [conversationId]);

  /** Fetch the newest page and merge it in (first load and every poll). */
  const refresh = useCallback(
    async (first: boolean) => {
      const res = await fetchThread(conversationId, { limit: PAGE });
      if (!res.ok) {
        if (first || res.status === 404) setLoadError({ status: res.status, detail: res.error.detail ?? 'That didn’t load.' });
        return;
      }
      const { conversation: c, messages: page, hasMore: more, usage: u } = res.data;
      const stick = first || isNearBottom();
      setConversation(c);
      setUsage(u);
      if (!isCapReached(u)) setLimitDetail(null); // a new IST day (or Premium) frees the composer again
      setLoadError(null);
      setMessages((prev) => {
        const merged = mergeMessages(prev, page ?? []);
        if (stick && merged.length !== prev.length) scrollIntent.current = { kind: 'bottom' };
        return merged;
      });
      if (first) {
        setHasMore(Boolean(more));
        scrollIntent.current = { kind: 'bottom' };
      }
      // Mark read once on open, then whenever new unread messages arrive.
      if (!readSent.current || c.unread > 0) {
        readSent.current = true;
        void sendRead();
      }
    },
    [conversationId, sendRead],
  );

  // First load, plus a draft carried over from the profile's Message dialog.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const carried = takeDraft(conversationId);
      if (carried) setDraft(carried);
      void refresh(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [conversationId, refresh]);

  // Poll every ~10 s while the tab is visible; refresh at once when it returns.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(false);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const intent = scrollIntent.current;
    if (!el || !intent) return;
    scrollIntent.current = null;
    if (intent.kind === 'bottom') el.scrollTop = el.scrollHeight;
    else el.scrollTop = intent.top + (el.scrollHeight - intent.height);
  }, [messages]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const res = await fetchThread(conversationId, { before: oldest.at, limit: PAGE });
    setLoadingOlder(false);
    if (!res.ok) {
      toast.error(res.error.detail ?? 'Couldn’t load older messages.');
      return;
    }
    const el = scrollRef.current;
    if (el) scrollIntent.current = { kind: 'keep', height: el.scrollHeight, top: el.scrollTop };
    setMessages((prev) => mergeMessages(res.data.messages ?? [], prev));
    setHasMore(Boolean(res.data.hasMore));
  }

  async function onSend() {
    if (!conversation || !usage || sending) return;
    const state = composerState(draft, usage);
    if (!state.canSend) return;
    setSending(true);
    const res = await sendMessage(conversationId, draft.trim());
    setSending(false);
    if (res.ok) {
      setDraft('');
      setUsage(res.data.usage);
      scrollIntent.current = { kind: 'bottom' };
      setMessages((prev) => mergeMessages(prev, [res.data.message]));
      // Replying to a request accepts it, so pick up the new status.
      if (conversation.status !== 'accepted') void refresh(false);
      announceMessagesChanged();
      textRef.current?.focus();
      return;
    }
    const { code, detail, usage: u } = res.error;
    if (code === 'daily_limit') {
      if (u) setUsage(u);
      // Out of messages entirely → the card; otherwise the message is just too long for what is left.
      if (!u || isCapReached(u)) setLimitDetail(detail ?? null);
      else toast.error(detail ?? 'That message is too long for what you have left today.');
      return;
    }
    if (code === 'suspended') {
      setSuspended(detail ?? 'Messaging is paused on your account.');
      return;
    }
    toast.error(detail ?? 'Couldn’t send. Try again.');
    if (code === 'blocked' || code === 'declined' || code === 'request_pending' || res.status === 404) void refresh(false);
  }

  async function onRespond(action: 'accept' | 'decline' | 'block') {
    setActing(action);
    const res = await respond(conversationId, action);
    setActing(null);
    setConfirmBlock(false);
    if (!res.ok) {
      toast.error(res.error.detail ?? 'That didn’t work. Try again.');
      return;
    }
    const next = res.data.conversation;
    setConversation(action === 'block' ? { ...next, status: 'blocked', blockedByMe: true } : next);
    announceMessagesChanged();
    if (action === 'accept') toast.success(`You can now message ${firstName(next.other.name)}.`);
    if (action === 'decline') toast.success('Request declined.');
    if (action === 'block') toast.success(`Blocked ${firstName(next.other.name)}.`);
  }

  async function onUnblock() {
    if (!conversation) return;
    setActing('unblock');
    const res = await unblock(conversation.other.id);
    setActing(null);
    if (!res.ok) {
      toast.error(res.error.detail ?? 'Couldn’t unblock. Try again.');
      return;
    }
    toast.success(`Unblocked ${firstName(conversation.other.name)}.`);
    announceMessagesChanged();
    void refresh(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadError && !conversation) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        {loadError.status === 404 ? (
          <EmptyState
            title="This conversation isn’t available"
            description="It may have been removed, or messages are turned off right now."
            action={{ label: 'Back to messages', href: '/messages' }}
            fill
          />
        ) : (
          <ErrorState description={loadError.detail} action={{ label: 'Try again', onClick: () => void refresh(true) }} />
        )}
      </div>
    );
  }

  if (!conversation || !usage) {
    return (
      <div className="flex h-full min-h-[60dvh] items-center justify-center" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const other = conversation.other;
  const name = firstName(other.name);
  const banner = threadBanner(conversation);
  const composer = composerState(draft, usage);
  const capReached = isCapReached(usage) || limitDetail !== null;
  const backHref = banner.kind === 'request_received' ? '/messages?box=requests' : '/messages';

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-background/90 px-2 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Back to messages"
          onClick={() => router.push(backHref)}
        >
          <ArrowLeft className="size-5" />
        </Button>
        {other.username ? (
          <Link href={`/u/${encodeURIComponent(other.username)}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 hover:bg-accent/40">
            <PersonAvatar person={other} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{other.name}</p>
              <p className="truncate text-xs text-muted-foreground">@{other.username}</p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 py-1">
            <PersonAvatar person={other} className="size-10" />
            <p className="truncate text-sm font-black">{other.name}</p>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-lg" aria-label="Conversation options">
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setReportOpen(true)}>
              <Flag className="size-4" /> Report
            </DropdownMenuItem>
            {banner.showUnblock ? (
              <DropdownMenuItem onSelect={() => void onUnblock()}>
                <ShieldOff className="size-4" /> Unblock
              </DropdownMenuItem>
            ) : conversation.status !== 'blocked' ? (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmBlock(true)}>
                <Ban className="size-4" /> Block
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 custom-scrollbar">
        {hasMore ? (
          <div className="mb-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void loadOlder()} disabled={loadingOlder}>
              {loadingOlder ? <Loader2 className="size-4 animate-spin" /> : null}
              Load older messages
            </Button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {messages.map((m, i) => (
              <Fragment key={m.id}>
                {isNewDay(i === 0 ? null : messages[i - 1].at, m.at) ? (
                  <li className="my-2 flex justify-center" aria-hidden>
                    <span className="rounded-full bg-surface-2 px-3 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {dayLabel(m.at)}
                    </span>
                  </li>
                ) : null}
                <li className={cn('flex', m.fromMe ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-xs',
                      m.fromMe
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md border border-border bg-card text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p
                      className={cn(
                        'mt-0.5 text-right text-[10px] tabular-nums',
                        m.fromMe ? 'text-primary-foreground/75' : 'text-muted-foreground',
                      )}
                    >
                      {formatISTTime(m.at).toLowerCase()}
                    </p>
                  </div>
                </li>
              </Fragment>
            ))}
          </ol>
        )}
      </div>

      {/* Banner + actions + composer */}
      <div className="shrink-0 space-y-2 border-t border-border bg-background px-3 py-3">
        {banner.text ? (
          <p
            className={cn(
              'rounded-xl px-3 py-2 text-sm font-semibold',
              banner.kind === 'request_received' || banner.kind === 'request_sent'
                ? 'bg-primary/10 text-foreground'
                : 'bg-muted text-muted-foreground',
            )}
            role="status"
          >
            {banner.text}
          </p>
        ) : null}

        {banner.showRequestActions ? (
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => void onRespond('accept')} disabled={acting !== null} className="font-bold">
              {acting === 'accept' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Accept
            </Button>
            <Button variant="outline" onClick={() => void onRespond('decline')} disabled={acting !== null} className="font-bold">
              {acting === 'decline' ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Decline
            </Button>
            <Button variant="outline" onClick={() => setConfirmBlock(true)} disabled={acting !== null} className="font-bold text-destructive">
              <Ban className="size-4" />
              Block
            </Button>
          </div>
        ) : null}

        {banner.showAcceptOnly ? (
          <Button onClick={() => void onRespond('accept')} disabled={acting !== null} className="w-full font-bold">
            {acting === 'accept' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Accept request
          </Button>
        ) : null}

        {banner.showUnblock ? (
          <Button variant="outline" onClick={() => void onUnblock()} disabled={acting !== null} className="w-full font-bold">
            {acting === 'unblock' ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
            Unblock {name}
          </Button>
        ) : null}

        {banner.canCompose ? (
          suspended ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3" role="status">
              <p className="text-sm font-bold text-foreground">{suspended}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">You can still read your messages.</p>
            </div>
          ) : capReached ? (
            <DailyLimitCard usage={usage} detail={limitDetail} />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onSend();
              }}
              className="space-y-1"
            >
              <div className="flex items-end gap-2">
                <label htmlFor="message-composer" className="sr-only">
                  Message {name}
                </label>
                <textarea
                  id="message-composer"
                  ref={textRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                  rows={1}
                  placeholder={`Message ${name}`}
                  aria-describedby="message-composer-hint"
                  className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-transparent px-4 py-2.5 text-base outline-none md:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                />
                <Button
                  type="submit"
                  size="icon-lg"
                  className="size-11 rounded-full"
                  disabled={!composer.canSend || sending}
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
                </Button>
              </div>
              <div id="message-composer-hint" className="flex items-center justify-between gap-2 px-1 text-[11px]" aria-live="polite">
                {!usage.premium && composer.empty ? (
                  // Empty box: the usage line (with the Premium hint) is the hint, shown once.
                  <UsageLine usage={usage} className="text-[11px]" />
                ) : (
                  <span className={cn(composer.warn ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                    {composer.hint}
                  </span>
                )}
                <span className={cn('shrink-0 tabular-nums', composer.tooLong ? 'font-bold text-destructive' : 'text-muted-foreground')}>
                  {composer.length}/{MESSAGE_MAX_CHARS}
                </span>
              </div>
            </form>
          )
        ) : null}
      </div>

      <AlertDialog open={confirmBlock} onOpenChange={(o) => acting === null && setConfirmBlock(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Neither of you will be able to send messages, and this conversation is hidden from your inbox. {name}{' '}
              isn&apos;t told. You can unblock later from Messages → Blocked students.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onRespond('block');
              }}
              disabled={acting !== null}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {acting === 'block' ? <Loader2 className="size-4 animate-spin" /> : null}
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} conversationId={conversationId} name={name} />
    </div>
  );
}
