'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Crown, Shield, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { formatStudyRoomTime } from '@/lib/study-rooms/date-format';
import type { ParticipantSummary } from '@/lib/study-rooms/events';

export function ParticipantList({
  participants,
  currentUserId,
  isAdmin,
  onKick,
  onTransferAdmin,
}: {
  participants: ParticipantSummary[];
  currentUserId: string;
  isAdmin: boolean;
  onKick: (userId: string) => Promise<void>;
  onTransferAdmin: (userId: string) => Promise<void>;
}) {
  const activeParticipants = participants.filter((participant) => !participant.left_at && !participant.kicked);
  const [collapsed, setCollapsed] = useState(false);

  const run = async (operation: () => Promise<void>, success: string): Promise<void> => {
    try {
      await operation();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  return (
    <section className="neu-raised rounded-2xl p-5">
      {/* Header — tap to minimise so the chat keeps its space on mobile */}
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="mb-4 flex w-full items-center justify-between"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Participants</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
            {activeParticipants.length}/100
          </span>
          {collapsed
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* List — capped height with its own scroll so joins never grow the page */}
      <div className={cn('space-y-2.5 overflow-y-auto pr-1 max-h-[38vh] lg:max-h-[320px]', collapsed && 'hidden')}>
        {activeParticipants.map((participant) => {
          const isSelf = participant.user_id === currentUserId;
          const participantIsAdmin = participant.role === 'admin';
          const initials = participant.display_name.slice(0, 2).toUpperCase();
          return (
            <div
              key={participant.user_id}
              className={cn(
                'neu-inset rounded-xl p-3 flex items-center gap-3',
                isSelf && 'ring-1 ring-primary/20'
              )}
            >
              {/* Avatar */}
              <div className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-black',
                participantIsAdmin ? 'bg-amber-500/20 text-amber-600' : 'bg-primary/10 text-primary'
              )}>
                {initials}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-bold">{participant.display_name}</p>
                  {isSelf && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                      You
                    </span>
                  )}
                  {participantIsAdmin && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600">
                      <Crown className="h-2.5 w-2.5" /> Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Joined {formatStudyRoomTime(participant.joined_at)}
                </p>
              </div>

              {/* Admin actions */}
              {isAdmin && !isSelf && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Transfer admin"
                    onClick={() => run(() => onTransferAdmin(participant.user_id), 'Admin transferred.')}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Kick participant"
                    onClick={() => run(() => onKick(participant.user_id), 'Participant removed.')}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
