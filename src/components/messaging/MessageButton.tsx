'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageCircle, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  announceMessagesChanged,
  fetchInbox,
  fetchUsage,
  saveDraft,
  startConversation,
} from '@/features/messaging/client';
import { composerState, firstName, isCapReached, MESSAGE_MAX_CHARS } from '@/features/messaging/messaging-ui';
import type { MessagingUsage } from '@/features/messaging/types';
import { cn } from '@/lib/utils';

import { DailyLimitCard } from './parts';

/**
 * "Message" on a public profile. An existing conversation opens straight away;
 * otherwise a small dialog writes the first message (the request). If the server
 * still answers 409 `exists`, the draft is carried into that conversation.
 */
export default function MessageButton({
  userId,
  name,
  className,
}: {
  userId: string;
  name: string;
  className?: string;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [usage, setUsage] = useState<MessagingUsage | null>(null);
  const [sending, setSending] = useState(false);
  const [limitDetail, setLimitDetail] = useState<string | null>(null);
  const shortName = firstName(name);

  const openConversation = (id: string) => router.push(`/messages/${encodeURIComponent(id)}`);

  async function onClick() {
    if (checking) return;
    setChecking(true);
    // Look for a conversation with this student in either box first.
    const [inbox, requests, u] = await Promise.all([fetchInbox('inbox'), fetchInbox('requests'), fetchUsage()]);
    setChecking(false);
    const found = [inbox, requests]
      .flatMap((r) => (r.ok ? r.data.conversations ?? [] : []))
      .find((c) => c.other.id === userId);
    if (found) {
      openConversation(found.id);
      return;
    }
    if (!inbox.ok && inbox.status === 404) {
      toast.error(inbox.error.detail ?? 'Messages aren’t available right now.');
      return;
    }
    setUsage(u.ok ? u.data.usage : inbox.ok ? inbox.data.usage : null);
    setLimitDetail(null);
    setOpen(true);
  }

  async function onSend() {
    const state = composerState(text, usage);
    if (!state.canSend || sending) return;
    setSending(true);
    const res = await startConversation({ userId, text: text.trim() });
    setSending(false);
    if (res.ok) {
      announceMessagesChanged();
      setOpen(false);
      setText('');
      toast.success(`Request sent to ${shortName}.`);
      openConversation(res.data.conversation.id);
      return;
    }
    const { code, detail, conversationId, usage: u } = res.error;
    if (code === 'exists' && conversationId) {
      saveDraft(conversationId, text);
      setOpen(false);
      openConversation(conversationId);
      return;
    }
    if (code === 'daily_limit') {
      if (u) setUsage(u);
      if (!u || isCapReached(u)) setLimitDetail(detail ?? null);
      else toast.error(detail ?? 'That message is too long for what you have left today.');
      return;
    }
    toast.error(detail ?? 'Couldn’t send. Try again.');
    if (code === 'blocked' || code === 'not_student' || code === 'self' || code === 'suspended') setOpen(false);
  }

  const composer = composerState(text, usage);
  const capped = (usage && isCapReached(usage)) || limitDetail !== null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => void onClick()}
        disabled={checking}
        className={cn('gap-1.5 font-bold', className)}
      >
        {checking ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        Message
      </Button>

      <Dialog open={open} onOpenChange={(o) => !sending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message {shortName}</DialogTitle>
            <DialogDescription>
              Your first message is a request. {shortName} can accept it, and until then you can&apos;t send more.
            </DialogDescription>
          </DialogHeader>
          {capped && usage ? (
            <DailyLimitCard usage={usage} detail={limitDetail} />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onSend();
              }}
              className="space-y-1"
            >
              <label htmlFor="first-message" className="sr-only">
                Your message
              </label>
              <Textarea
                id="first-message"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Say hi to ${shortName}`}
                rows={4}
                autoFocus
                aria-describedby="first-message-hint"
                className="max-h-60 text-base md:text-sm"
              />
              <div id="first-message-hint" className="flex items-center justify-between gap-2 px-1 text-[11px]" aria-live="polite">
                <span className={cn(composer.warn ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                  {composer.hint}
                </span>
                <span className={cn('shrink-0 tabular-nums', composer.tooLong ? 'font-bold text-destructive' : 'text-muted-foreground')}>
                  {composer.length}/{MESSAGE_MAX_CHARS}
                </span>
              </div>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              {capped ? 'Close' : 'Cancel'}
            </Button>
            {!capped ? (
              <Button onClick={() => void onSend()} disabled={!composer.canSend || sending} className="font-bold">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
                Send request
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
