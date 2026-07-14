"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { CbtRoomProvider, useCbtRoom } from "@/context/CbtRoomContext";
import { CbtTestInterface } from "@/sections/cbt/CbtTestInterface";

import { CbtJoinCard } from "./CbtJoinCard";

/** Origin landing page — where the thank-you screen redirects after the test. */
const ORIGIN_LANDING_URL = "/";
const REDIRECT_SECONDS = 10;

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
    return <ThankYouScreen />;
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

/** Origin brand mark — the official Origin logo. */
function OriBrandMark({ className = "h-14 w-14" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/Origin-New-Logo.jpeg" alt="Origin" className={`${className} rounded-xl object-contain`} />
  );
}

/**
 * Post-submission thank-you screen: Origin brand mark × the institute logo (when
 * the institute has set one), a thank-you line, a "click here to continue" link,
 * and a 10-second countdown that redirects to the Origin landing page.
 */
function ThankYouScreen() {
  const { instituteName, instituteLogo } = useCbtRoom();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const goHome = () => {
      window.location.href = ORIGIN_LANDING_URL;
    };
    const interval = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(interval);
          goHome();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center overflow-y-auto neu-surface p-6 text-center">
      <div className="neu-raised w-full max-w-md space-y-6 rounded-3xl p-8">
        {/* Origin × Institute logo lockup */}
        <div className="flex items-center justify-center gap-4">
          <OriBrandMark />
          {instituteLogo ? (
            <>
              <span className="text-2xl font-black text-muted-foreground">×</span>
              <Image
                src={instituteLogo}
                alt={instituteName ?? "Institute"}
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 rounded-xl object-contain"
              />
            </>
          ) : instituteName ? (
            <>
              <span className="text-2xl font-black text-muted-foreground">×</span>
              <span className="max-w-[10rem] truncate text-lg font-black text-foreground">{instituteName}</span>
            </>
          ) : null}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-foreground">Thanks for using Origin</h1>
          <p className="text-sm text-muted-foreground">Your test has been submitted successfully.</p>
        </div>

        <a
          href={ORIGIN_LANDING_URL}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-primary py-3.5 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          Click here to continue
        </a>

        <p className="text-xs text-muted-foreground">
          Redirecting to Origin in <span className="font-bold text-foreground tabular-nums">{secondsLeft}</span>{" "}
          second{secondsLeft === 1 ? "" : "s"}…
        </p>
      </div>
    </main>
  );
}

export function CbtStudentExperience({
  slug,
  roomId,
  roomName,
  instituteName = null,
  instituteLogo = null,
}: {
  slug: string;
  roomId: string;
  roomName: string;
  instituteName?: string | null;
  instituteLogo?: string | null;
}) {
  return (
    <CbtRoomProvider
      slug={slug}
      roomId={roomId}
      roomName={roomName}
      instituteName={instituteName}
      instituteLogo={instituteLogo}
    >
      <Inner />
    </CbtRoomProvider>
  );
}
