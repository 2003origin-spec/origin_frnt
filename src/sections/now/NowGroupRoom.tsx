'use client';

/**
 * Group session room (decision B95). The host (solver) speaks and can share
 * a screen; listeners (students) hear, raise a hand (a data message), and
 * speak only when the host gives them the mic — the server changes their
 * LiveKit permission, one student at a time. Audio only for students,
 * recorded like calls. The host ends it; the sweep ends it at its planned end.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ParticipantEvent,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { Circle, Clock, Hand, Loader2, Mic, MicOff, MonitorUp, MonitorX, PhoneOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiCall } from '@/lib/api';

import type { Group } from './NowGroups';

type Ticket = { url: string; token: string; role: 'host' | 'listener'; recorded: boolean; endsAt: string };

const HAND_TOPIC = 'hand';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function useCountdown(endsAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);
  return endsAt ? Math.max(0, new Date(endsAt).getTime() - now) : null;
}

function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** listener-<seatId> → seatId. */
const seatOf = (identity: string) => (identity.startsWith('listener-') ? identity.slice('listener-'.length) : null);

export default function NowGroupRoom({ groupId }: { groupId: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [connected, setConnected] = useState(false);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [handUp, setHandUp] = useState(false);
  const [hands, setHands] = useState<{ seatId: string; name: string }[]>([]);
  const [listeners, setListeners] = useState<{ seatId: string; name: string }[]>([]);
  const [micSeat, setMicSeat] = useState<string | null>(null);
  const [screen, setScreen] = useState<RemoteTrack | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const remaining = useCountdown(connected ? (ticket?.endsAt ?? null) : null);
  const isHost = ticket?.role === 'host';

  useEffect(() => {
    let cancelled = false;
    apiCall(`/now/groups/${encodeURIComponent(groupId)}`)
      .then((res) => !cancelled && setGroup((res as { group: Group }).group))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const leave = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect().catch(() => undefined);
    audioRef.current?.replaceChildren();
    setConnected(false);
    setScreen(null);
  }, []);
  useEffect(() => () => void leave(), [leave]);

  useEffect(() => {
    const el = screenRef.current;
    if (!el || !screen) return;
    screen.attach(el);
    return () => {
      screen.detach(el);
    };
  }, [screen]);

  const refreshListeners = (room: Room) =>
    setListeners(
      [...room.remoteParticipants.values()]
        .map((p) => ({ seatId: seatOf(p.identity), name: p.name ?? 'Student' }))
        .filter((p): p is { seatId: string; name: string } => p.seatId !== null),
    );

  const join = useCallback(async () => {
    setBusy('join');
    setError(null);
    try {
      const { ticket: issued } = (await apiCall(`/now/groups/${encodeURIComponent(groupId)}/token`, { method: 'POST' })) as { ticket: Ticket };
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.dataset.participant = participant.identity;
          audioRef.current?.appendChild(el);
        } else if (track.source === Track.Source.ScreenShare && participant.identity.startsWith('host-')) {
          setScreen(track);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
        if (track.source === Track.Source.ScreenShare) setScreen(null);
      });
      room.on(RoomEvent.ParticipantConnected, () => refreshListeners(room));
      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        refreshListeners(room);
        const seat = seatOf(p.identity);
        if (seat) setHands((h) => h.filter((x) => x.seatId !== seat));
      });
      // Host: raised hands arrive as data from listeners.
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
        if (topic !== HAND_TOPIC || !participant) return;
        const seat = seatOf(participant.identity);
        if (!seat) return;
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload)) as { up?: boolean };
          setHands((h) => (msg.up ? [...h.filter((x) => x.seatId !== seat), { seatId: seat, name: participant.name ?? 'Student' }] : h.filter((x) => x.seatId !== seat)));
        } catch {
          // Ignore anything else.
        }
      });
      // Listener: the host gave or took the mic.
      room.localParticipant.on(ParticipantEvent.ParticipantPermissionsChanged, () => {
        const allowed = Boolean(room.localParticipant.permissions?.canPublish);
        setCanSpeak(allowed);
        if (allowed) {
          setHandUp(false);
          void room.localParticipant.setMicrophoneEnabled(true).then(() => setMuted(false)).catch(() => undefined);
        } else {
          setMuted(true);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setEnded(true);
      });
      await room.connect(issued.url, issued.token);
      roomRef.current = room;
      await room.startAudio().catch(() => undefined);
      if (issued.role === 'host') {
        await room.localParticipant.setMicrophoneEnabled(true);
        setMuted(false);
      } else {
        setMuted(true);
      }
      refreshListeners(room);
      setTicket(issued);
      setConnected(true);
    } catch (err) {
      setError(errorMessage(err));
      await leave();
    } finally {
      setBusy(null);
    }
  }, [groupId, leave]);

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(muted).catch((err) => setError(errorMessage(err)));
    setMuted(!muted);
  };
  const toggleShare = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(!sharing, { audio: false });
      setSharing(!sharing);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const raiseHand = async (up: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant
      .publishData(new TextEncoder().encode(JSON.stringify({ up })), { reliable: true, topic: HAND_TOPIC })
      .catch(() => undefined);
    setHandUp(up);
  };
  const giveMic = async (seatId: string | null) => {
    setBusy('mic');
    setError(null);
    try {
      await apiCall(`/now/groups/${encodeURIComponent(groupId)}/mic`, { method: 'POST', body: JSON.stringify({ seatId }) });
      setMicSeat(seatId);
      if (seatId) setHands((h) => h.filter((x) => x.seatId !== seatId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const end = async () => {
    setBusy('end');
    try {
      await apiCall(`/now/groups/${encodeURIComponent(groupId)}/end`, { method: 'POST' });
      await leave();
      setEnded(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const canShare = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) &&
      !(typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches),
    [],
  );

  if (!group) {
    return error ? (
      <p className="p-6 text-sm text-muted-foreground">{error}</p>
    ) : (
      <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Group session · <span className="capitalize">{group.subject}</span> · {group.chapter}</p>
          <h1 className="text-lg font-semibold">{group.title}</h1>
          <p className="text-xs text-muted-foreground">with {group.solverName}</p>
        </div>
        <div className="flex items-center gap-3">
          {ticket?.recorded && connected && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600">
              <Circle className="h-2.5 w-2.5 fill-current" aria-hidden /> Recording
            </span>
          )}
          {remaining !== null && (
            <span className={`flex items-center gap-1 rounded-full px-2 py-1 font-mono text-sm ${remaining <= 60_000 ? 'bg-amber-500/15 text-amber-700' : 'bg-muted'}`} aria-label="Time left">
              <Clock className="h-4 w-4" aria-hidden /> {clock(remaining)}
            </span>
          )}
        </div>
      </header>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {ended ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 py-6 text-sm">
            <p className="font-medium">The session has ended.</p>
            <Link href={isHost ? '/now/solver' : '/now/groups'} className="text-primary underline">
              {isHost ? 'Back to your dashboard' : 'Back to group sessions (rate it there)'}
            </Link>
          </CardContent>
        </Card>
      ) : !connected ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-sm">
            <p>
              Audio only; students listen and raise a hand to speak. The session is recorded for safety
              {group.canJoin ? '.' : '. The room opens 10 minutes before the start.'}
            </p>
            <Button onClick={join} disabled={busy === 'join' || !group.canJoin}>
              {busy === 'join' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Join the session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {screen && (
            <Card>
              <CardContent className="p-2">
                <video ref={screenRef} className="w-full rounded" autoPlay playsInline muted aria-label={`${group.solverName}'s shared screen`} />
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {(isHost || canSpeak) && (
              <Button variant="outline" onClick={toggleMute}>
                {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />} {muted ? 'Unmute' : 'Mute'}
              </Button>
            )}
            {isHost && canShare && (
              <Button variant="outline" onClick={toggleShare}>
                {sharing ? <MonitorX className="mr-2 h-4 w-4" /> : <MonitorUp className="mr-2 h-4 w-4" />} {sharing ? 'Stop sharing' : 'Share screen'}
              </Button>
            )}
            {!isHost && !canSpeak && (
              <Button variant={handUp ? 'default' : 'outline'} onClick={() => raiseHand(!handUp)}>
                <Hand className="mr-2 h-4 w-4" /> {handUp ? 'Lower hand' : 'Raise hand'}
              </Button>
            )}
            {!isHost && canSpeak && <span className="text-sm text-emerald-700">You have the mic.</span>}
            {isHost ? (
              <Button variant="destructive" onClick={end} disabled={busy === 'end'}>
                <PhoneOff className="mr-2 h-4 w-4" /> End for everyone
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => void leave().then(() => setEnded(true))}>
                <PhoneOff className="mr-2 h-4 w-4" /> Leave
              </Button>
            )}
          </div>
          {isHost && (
            <Card>
              <CardContent className="flex flex-col gap-2 py-4 text-sm">
                <p className="font-medium">Raised hands</p>
                {hands.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nobody yet.</p>
                ) : (
                  hands.map((h) => (
                    <div key={h.seatId} className="flex items-center justify-between gap-2">
                      <span>{h.name}</span>
                      <Button size="sm" variant="outline" disabled={busy === 'mic'} onClick={() => giveMic(h.seatId)}>Give the mic</Button>
                    </div>
                  ))
                )}
                {micSeat && (
                  <div className="flex items-center justify-between gap-2 border-t pt-2">
                    <span>{listeners.find((l) => l.seatId === micSeat)?.name ?? 'A student'} has the mic</span>
                    <Button size="sm" variant="ghost" disabled={busy === 'mic'} onClick={() => giveMic(null)}>Take it back</Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{listeners.length} student{listeners.length === 1 ? '' : 's'} listening. One student speaks at a time.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
      <div ref={audioRef} className="hidden" aria-hidden />
    </div>
  );
}
