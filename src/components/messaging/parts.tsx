'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { resetText, usageLine } from '@/features/messaging/messaging-ui';
import type { MessagingPerson, MessagingUsage } from '@/features/messaging/types';
import { cn } from '@/lib/utils';

export function PersonAvatar({ person, className }: { person: MessagingPerson; className?: string }) {
  return (
    <Avatar className={cn('size-11 shrink-0 border border-border', className)}>
      {person.avatar ? <AvatarImage src={person.avatar} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
        {(person.name.trim().charAt(0) || '?').toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

/** "7 of 10 messages left today" with a Premium hint for free students. */
export function UsageLine({ usage, className }: { usage: MessagingUsage; className?: string }) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      <span className="font-semibold text-foreground tabular-nums">{usageLine(usage)}</span>
      {!usage.premium ? (
        <>
          {' · '}
          <Link href="/premium" className="font-semibold text-primary hover:underline">
            Premium gets more
          </Link>
        </>
      ) : null}
    </p>
  );
}

/** Shown in place of the composer once today's messages are used up. */
export function DailyLimitCard({ usage, detail }: { usage: MessagingUsage; detail?: string | null }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3" role="status">
      <p className="text-sm font-bold text-foreground">
        {detail || `You've used today's ${usage.limit} messages. More at midnight.`}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{resetText(usage.resetsAt)}</p>
      {!usage.premium ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">Premium students can send more messages each day.</p>
          <Button asChild size="sm" variant="outline" className="gap-1.5 font-bold">
            <Link href="/premium">
              <Crown className="size-3.5" /> See Premium
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
