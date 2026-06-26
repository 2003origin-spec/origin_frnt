'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { InviteCodeCard } from '@/components/study-rooms/InviteCodeCard';
import { LobbyChat } from '@/components/study-rooms/LobbyChat';
import { ParticipantList } from '@/components/study-rooms/ParticipantList';
import { TestConfigDrawer } from '@/components/study-rooms/TestConfigDrawer';
import { DeleteRoomButton } from '@/components/study-rooms/DeleteRoomButton';
import { StudyRoomProvider, useStudyRoom, type StudyRoomStatePayload } from '@/context/StudyRoomContext';

function LobbyContent({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const room = useStudyRoom();
  const refreshRoom = room.refresh;
  const roomId = room.room.id;
  const roomStatus = room.room.status;

  useEffect(() => {
    if (roomStatus === 'in_test') {
      router.push(`/study-rooms/${roomId}/test`);
    }
    if (roomStatus === 'finished') {
      router.push(`/study-rooms/${roomId}/leaderboard`);
    }
    if (roomStatus === 'closed') {
      toast.info('Room closed.');
      router.push('/study-rooms');
    }
  }, [roomId, roomStatus, router]);

  useEffect(() => {
    if (roomStatus !== 'lobby') return;
    const timer = window.setInterval(() => {
      void refreshRoom().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refreshRoom, roomStatus]);

  const start = async (): Promise<void> => {
    try {
      await room.startTest();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start test.');
    }
  };

  const statusLabel = roomStatus.replace('_', ' ');

  return (
    <main className="min-h-screen neu-surface px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <button
              type="button"
              onClick={() => router.push('/study-rooms')}
              className="mb-3 flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Rooms
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight">{room.room.name}</h1>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                {statusLabel}
              </span>
              <span className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                room.isConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}>
                {room.isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {room.isConnected ? 'Live' : 'Reconnecting'}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {room.is_admin && (
              <>
                <TestConfigDrawer disabled={room.room.status !== 'lobby'} onConfigure={room.configureTest} />
                <DeleteRoomButton roomName={room.room.name} onDelete={room.deleteRoom} />
                <button
                  type="button"
                  disabled={!room.room.custom_test_id || room.room.status !== 'lobby'}
                  onClick={start}
                  className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-bold shadow-[3px_3px_8px_hsl(var(--neu-shadow))] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  <Play className="h-4 w-4" />
                  Start Test
                </button>
              </>
            )}
            <button
              type="button"
              onClick={room.leaveRoom}
              className="neu-raised rounded-xl px-4 py-2.5 text-sm font-bold hover:-translate-y-0.5 transition-all"
            >
              Leave
            </button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr_360px]">
          <div className="space-y-5">
            <InviteCodeCard inviteCode={room.current_code} isAdmin={room.is_admin} onRegenerate={room.regenerateCode} />
            <ParticipantList
              participants={room.participants}
              currentUserId={currentUserId}
              isAdmin={room.is_admin}
              onKick={room.kickParticipant}
              onTransferAdmin={room.transferAdmin}
            />
          </div>

          <LobbyChat
            messages={room.messages}
            locked={room.room.status !== 'lobby'}
            currentUserId={currentUserId}
            onSend={room.sendChat}
            pendingMessages={room.pending}
            typingUsers={room.typingUsers}
            onTyping={room.sendTyping}
          />

          <section className="neu-raised rounded-2xl p-5">
            <h2 className="mb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Test Status</h2>
            {room.room.custom_test_id ? (
              <div className="neu-inset rounded-xl p-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                Test ready. The admin can start when participants are prepared.
              </div>
            ) : (
              <div className="neu-inset rounded-xl p-4 text-sm font-bold text-muted-foreground">
                Waiting for the admin to configure a custom test.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function LobbyClient({
  roomId,
  currentUserId,
  initialState,
}: {
  roomId: string;
  currentUserId: string;
  initialState: StudyRoomStatePayload;
}) {
  return (
    <StudyRoomProvider roomId={roomId} currentUserId={currentUserId} initialState={initialState}>
      <LobbyContent currentUserId={currentUserId} />
    </StudyRoomProvider>
  );
}
