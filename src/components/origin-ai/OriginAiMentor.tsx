'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, Send, Sparkles, TriangleAlert } from 'lucide-react';

import {
  buildOriginAiPageContext,
  getOriginAiSession,
  sendOriginAiMessage,
} from '@/features/origin-ai/client';
import { cn } from '@/lib/utils';
import type { OriginAiSnapshot } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface OriginAiMentorProps {
  compact?: boolean;
  onClose?: () => void;
}

function formatRelativeTimestamp(date: Date): string {
  const diffSeconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function PolicyBadge({ snapshot }: { snapshot: OriginAiSnapshot }) {
  const tone =
    snapshot.pagePolicy.mode === 'answer_blocked'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : snapshot.pagePolicy.mode === 'hint_only'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';

  return (
    <div className={cn('rounded-2xl border px-3 py-2 text-xs leading-5', tone)}>
      <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.2em]">
        <TriangleAlert className="h-3.5 w-3.5" />
        {snapshot.pagePolicy.title}
      </div>
      <p className="mt-1 opacity-90">{snapshot.pagePolicy.reason}</p>
    </div>
  );
}

function ReminderCards({ snapshot, compact = false }: { snapshot: OriginAiSnapshot; compact?: boolean }) {
  if (snapshot.reminders.length === 0) {
    return null;
  }

  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2')}>
      {snapshot.reminders.slice(0, compact ? 2 : 4).map((reminder) => (
        <div
          key={reminder.id}
          className={cn(
            'rounded-2xl border border-white/10 bg-white/[0.04] p-3',
            reminder.priority === 'high'
              ? 'shadow-[0_0_0_1px_rgba(251,191,36,0.12)]'
              : reminder.priority === 'medium'
                ? 'shadow-[0_0_0_1px_rgba(96,165,250,0.12)]'
                : 'shadow-[0_0_0_1px_rgba(52,211,153,0.10)]',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                {reminder.kind}
              </div>
              <div className="mt-1 text-sm font-semibold text-white">{reminder.title}</div>
            </div>
            <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
              {reminder.priority}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{reminder.message}</p>
        </div>
      ))}
    </div>
  );
}

function MessageList({ snapshot }: { snapshot: OriginAiSnapshot }) {
  return (
    <div className="space-y-4">
      {snapshot.session.messages.map((message) => {
        const isAssistant = message.role === 'assistant';
        return (
          <div
            key={message.id}
            className={cn('flex', isAssistant ? 'justify-start' : 'justify-end')}
          >
            <div
              className={cn(
                'max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-7 shadow-lg',
                isAssistant
                  ? 'rounded-tl-md border border-white/10 bg-white/[0.05] text-slate-100'
                  : 'rounded-tr-md bg-blue-600 text-white',
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div
                className={cn(
                  'mt-2 text-[10px] uppercase tracking-[0.2em]',
                  isAssistant ? 'text-slate-400' : 'text-blue-100/80',
                )}
              >
                {isAssistant ? 'Origin AI' : 'You'} · {formatRelativeTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OriginAiMentor({ compact = false, onClose }: OriginAiMentorProps) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = React.useState<OriginAiSnapshot | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);

  const pageContext = React.useMemo(() => buildOriginAiPageContext(pathname || '/dashboard'), [pathname]);

  const loadSnapshot = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getOriginAiSession(pageContext);
      setSnapshot(data);
    } catch (error) {
      console.error('Failed to load Origin AI session', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load Origin AI');
    } finally {
      setIsLoading(false);
    }
  }, [pageContext]);

  React.useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [snapshot, isSending]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setMessage('');
    setIsSending(true);

    try {
      const reply = await sendOriginAiMessage(trimmed, pageContext);
      setSnapshot(reply);
    } catch (error) {
      console.error('Failed to send Origin AI message', error);
      toast.error(error instanceof Error ? error.message : 'Origin AI could not reply');
      setMessage(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const shellClassName = compact
    ? 'flex h-full flex-col rounded-[28px] border border-white/10 bg-[#07111f] text-white shadow-2xl'
    : 'flex h-full min-h-[calc(100vh-7rem)] flex-col rounded-[32px] border border-white/10 bg-[#07111f] text-white shadow-[0_25px_80px_rgba(2,6,23,0.45)]';

  return (
    <div className={shellClassName}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-blue-200">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Origin AI</h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                live
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Friendly mentor with page awareness, memory, and just enough sarcasm to be useful.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!compact && (
            <Button
              type="button"
              variant="outline"
              onClick={loadSnapshot}
              className="border-white/15 bg-white/[0.03] text-slate-200 hover:bg-white/10"
            >
              Refresh
            </Button>
          )}
          {compact && onClose ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Close
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn('grid flex-1 gap-0', compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.4fr_0.9fr]')}>
        <div className="flex min-h-0 flex-col">
          <div className="space-y-3 border-b border-white/10 px-5 py-4">
            {snapshot ? <PolicyBadge snapshot={snapshot} /> : null}
            {snapshot ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full bg-white/5 px-2.5 py-1">
                  Page: {snapshot.pageContext.pageKind.replace(/_/g, ' ')}
                </span>
                {snapshot.memory.lastWeakTopics.length > 0 ? (
                  <span className="rounded-full bg-white/5 px-2.5 py-1">
                    Weak topics: {snapshot.memory.lastWeakTopics.slice(0, 2).join(', ')}
                  </span>
                ) : null}
                {snapshot.memory.pendingDppCount > 0 ? (
                  <span className="rounded-full bg-white/5 px-2.5 py-1">
                    Pending DPPs: {snapshot.memory.pendingDppCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <ScrollArea className="min-h-0 flex-1 px-5 py-5">
            {isLoading ? (
              <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Origin AI...
              </div>
            ) : snapshot ? (
              <MessageList snapshot={snapshot} />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-slate-400">
                Origin AI could not load.
              </div>
            )}
            <AnimatePresence>
              {isSending ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="mt-4 flex justify-start"
                >
                  <div className="rounded-3xl rounded-tl-md border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div ref={scrollAnchorRef} />
          </ScrollArea>

          <div className="border-t border-white/10 px-5 py-4">
            <div className="flex gap-3">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                rows={compact ? 2 : 3}
                placeholder={
                  snapshot?.pagePolicy.mode === 'answer_blocked'
                    ? 'Ask for strategy, not answers...'
                    : snapshot?.pagePolicy.mode === 'hint_only'
                      ? 'Ask for a hint or a concept nudge...'
                      : 'Ask Origin AI anything about your studies...'
                }
                className="min-h-[56px] flex-1 resize-none rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/40 focus:bg-white/[0.05]"
              />
              <Button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || !message.trim()}
                className="h-auto rounded-3xl bg-blue-600 px-4 py-3 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Origin AI knows your recent performance, pending DPPs, and the page you are on.
              </p>
              {compact ? (
                <Link
                  href="/doubt-solver"
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Open mentor desk
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {!compact && snapshot ? (
          <aside className="border-t border-white/10 px-5 py-5 xl:border-t-0 xl:border-l">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-300">
                  Mentor Memory
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {snapshot.memory.preferredName}, here’s what I’m tracking.
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{snapshot.memory.identitySummary}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>Current streak: {snapshot.memory.currentStreak} day(s)</div>
                  <div>Pending DPPs: {snapshot.memory.pendingDppCount}</div>
                  <div>Pending assignments: {snapshot.memory.pendingAssignmentCount}</div>
                  {snapshot.memory.lastTestSummary ? (
                    <p className="rounded-2xl bg-white/[0.03] px-3 py-2 text-slate-300">
                      Last test summary: {snapshot.memory.lastTestSummary}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Live Reminders
                </div>
                <ReminderCards snapshot={snapshot} />
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
