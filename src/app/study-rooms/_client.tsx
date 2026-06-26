'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogIn, UsersRound, Clock3, Zap, Trophy, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { DeleteRoomButton } from '@/components/study-rooms/DeleteRoomButton';
import { apiCall } from '@/lib/api';
import { formatStudyRoomDateTime } from '@/lib/study-rooms/date-format';
import { cn } from '@/lib/utils';
import type { RoomSummary } from '@/server/study-rooms';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  lobby:    { label: 'Lobby',     bg: 'bg-primary/10',      text: 'text-primary',                              border: 'border-primary/20',      dot: 'bg-primary' },
  in_test:  { label: 'Live Test', bg: 'bg-amber-500/10',    text: 'text-amber-600 dark:text-amber-400',        border: 'border-amber-500/20',    dot: 'bg-amber-500' },
  finished: { label: 'Finished',  bg: 'bg-emerald-500/10',  text: 'text-emerald-600 dark:text-emerald-400',   border: 'border-emerald-500/20',  dot: 'bg-emerald-500' },
  closed:   { label: 'Closed',    bg: 'bg-muted',           text: 'text-muted-foreground',                    border: 'border-border',          dot: 'bg-muted-foreground/40' },
};

export default function StudyRoomsClient({
  initialRooms,
  currentUserId,
}: {
  initialRooms: RoomSummary[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  const resumeRoom = (room: RoomSummary): void => {
    const path = room.status === 'lobby'
      ? `/study-rooms/${room.id}/lobby`
      : room.status === 'in_test'
        ? `/study-rooms/${room.id}/test`
        : `/study-rooms/${room.id}/leaderboard`;
    router.push(path);
  };

  const createQuickRoom = async (): Promise<void> => {
    setIsCreatingQuick(true);
    try {
      const payload = await apiCall('/study-rooms', {
        method: 'POST',
        body: JSON.stringify({ name: 'Study Room' }),
      });
      router.push(`/study-rooms/${payload.room.id}/lobby`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create room.');
    } finally {
      setIsCreatingQuick(false);
    }
  };

  const deleteRoom = async (roomId: string): Promise<void> => {
    await apiCall(`/study-rooms/${roomId}`, { method: 'DELETE' });
    setRooms((currentRooms) => currentRooms.filter((room) => room.id !== roomId));
  };

  return (
    <main className="min-h-screen neu-surface text-foreground font-sans selection:bg-primary/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="pt-8 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-5"
        >
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-primary">Multiplayer Tests</p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Study <span className="text-primary">Rooms</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
              Create or join a live study room, tackle a timed test together, and compare results on the leaderboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/study-rooms/join"
              className="neu-raised rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 transition-transform hover:-translate-y-0.5"
            >
              <LogIn className="h-4 w-4" /> Join
            </Link>
            <Link
              href="/study-rooms/create"
              className="neu-raised rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" /> Create
            </Link>
            <button
              type="button"
              onClick={createQuickRoom}
              disabled={isCreatingQuick}
              className="bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-black flex items-center gap-2 shadow-[3px_3px_8px_hsl(var(--neu-shadow))] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
            >
              <Zap className="h-4 w-4" />
              {isCreatingQuick ? 'Creating…' : 'Quick Room'}
            </button>
          </div>
        </motion.div>

        {/* Room list */}
        <section className="space-y-3">
          {rooms.length === 0 ? (
            <div className="neu-inset rounded-2xl p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <UsersRound className="h-8 w-8 text-primary/60" />
              </div>
              <p className="font-bold text-foreground">No active rooms yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a quick room or invite friends with a code.</p>
            </div>
          ) : (
            <AnimatePresence>
              {rooms.map((room, index) => {
                const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.closed;
                const StatusIcon = room.status === 'in_test' ? Zap : room.status === 'finished' ? Trophy : UsersRound;
                return (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                    className="neu-raised rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Status icon */}
                      <div className={cn('h-12 w-12 flex-shrink-0 rounded-xl flex items-center justify-center', cfg.bg)}>
                        <StatusIcon className={cn('h-5 w-5', cfg.text)} />
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <h2 className="truncate font-black text-foreground">{room.name}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {/* Status badge */}
                          <span className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                            cfg.bg, cfg.text
                          )}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                            {cfg.label}
                          </span>
                          {/* Timestamp */}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            {formatStudyRoomDateTime(room.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {room.admin_user_id === currentUserId && (
                        <DeleteRoomButton
                          roomName={room.name}
                          label={`Delete ${room.name}`}
                          iconOnly
                          onDelete={() => deleteRoom(room.id)}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => resumeRoom(room)}
                        className="neu-raised neu-pressable rounded-xl px-4 py-2 text-sm font-bold text-primary flex items-center gap-1.5 transition-transform hover:-translate-y-0.5"
                      >
                        Open <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </section>
      </div>
    </main>
  );
}
