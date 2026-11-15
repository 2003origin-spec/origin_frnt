'use client';

/**
 * "Pause music for your test?" — shown INSIDE the running test (so it is
 * visible in fullscreen), never in front of the Start button and never before
 * the test has started (V1/STUDY_MUSIC_PLAN.md §5). Not a modal: the test keeps
 * running underneath. "Pause (recommended)" has focus; after 10 seconds with no
 * answer it is applied by itself, and the countdown is written out as text.
 */

import { useEffect, useId, useRef } from 'react';
import { Music } from 'lucide-react';

import { promptCountdownText } from '@/lib/study-music-player';

import { useStudyMusic } from './StudyMusicProvider';

export function PauseForTestPromptView({
  secondsLeft,
  onPause,
  onKeep,
  autoFocus = true,
}: {
  secondsLeft: number;
  onPause: () => void;
  onKeep: () => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const pauseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) pauseRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      data-study-music-prompt=""
      className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[90] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[18px] border border-border bg-surface-3 p-4 text-foreground"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Music className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-[17px] font-semibold leading-snug">
            Pause music for your test?
          </h2>
          <p id={`${id}-body`} className="mt-0.5 text-[13px] text-muted-foreground">
            Music will start again after your test. <span className="font-mono tabular-nums">{promptCountdownText(secondsLeft)}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="min-h-12 cursor-pointer rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Keep playing
        </button>
        <button
          ref={pauseRef}
          type="button"
          onClick={onPause}
          className="min-h-12 cursor-pointer rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Pause (recommended)
        </button>
      </div>
    </div>
  );
}

/** The connected prompt: renders only while the player has a question to ask. */
export function PauseForTestPrompt() {
  const music = useStudyMusic();
  if (!music?.prompt.open) return null;
  return (
    <PauseForTestPromptView
      secondsLeft={music.prompt.secondsLeft}
      onPause={() => music.answerPrompt('pause')}
      onKeep={() => music.answerPrompt('keep')}
    />
  );
}
