"use client";

import { CbtRoomProvider, useCbtRoom } from "@/context/CbtRoomContext";
import { CbtTestInterface } from "@/sections/cbt/CbtTestInterface";

import { CbtJoinCard } from "./CbtJoinCard";

function StudentIdBadge({ studentCode }: { studentCode: string }) {
  return (
    <div className="space-y-1 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Your ID</p>
      <p className="font-mono text-3xl font-bold tracking-[0.2em]">{studentCode}</p>
      <p className="text-xs text-muted-foreground">Write this down — you&apos;ll need it to rejoin on another device.</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="neu-raised w-full max-w-sm space-y-6 rounded-3xl p-6 text-center">{children}</div>;
}

function Inner() {
  const { phase } = useCbtRoom();

  // The player owns the full viewport (fullscreen, its own header/timer).
  if (phase === "in_test") {
    return <CbtTestInterface />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center neu-surface p-6">
      <PhaseCard />
    </main>
  );
}

function PhaseCard() {
  const { phase, studentCode, slug, roomName, markJoined } = useCbtRoom();

  if (phase === "checking") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (phase === "join") {
    return <CbtJoinCard slug={slug} roomName={roomName} onJoined={markJoined} />;
  }

  if (phase === "lobby") {
    return (
      <Centered>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">You&apos;re in{roomName ? `: ${roomName}` : ""}</h1>
          <p className="text-sm text-muted-foreground">Waiting for your teacher to start the test…</p>
        </div>
        {studentCode ? <StudentIdBadge studentCode={studentCode} /> : null}
      </Centered>
    );
  }

  if (phase === "submitted") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Test submitted</h1>
        <p className="text-sm text-muted-foreground">Thanks! You can close this tab.</p>
      </Centered>
    );
  }

  if (phase === "closed") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Room closed</h1>
        <p className="text-sm text-muted-foreground">This session has ended.</p>
      </Centered>
    );
  }

  return (
    <Centered>
      <h1 className="text-xl font-semibold">Removed from room</h1>
      <p className="text-sm text-muted-foreground">You were removed by the teacher.</p>
    </Centered>
  );
}

export function CbtStudentExperience({
  slug,
  roomId,
  roomName,
}: {
  slug: string;
  roomId: string;
  roomName: string;
}) {
  return (
    <CbtRoomProvider slug={slug} roomId={roomId} roomName={roomName}>
      <Inner />
    </CbtRoomProvider>
  );
}
