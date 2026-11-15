'use client';

/**
 * The only music control inside a test (V1/STUDY_MUSIC_PLAN.md §7): one 48 px
 * play / pause button. Each test renders it INSIDE its own header, in normal
 * layout flow, so it can never cover the question, the options, the palette or
 * Submit (a fixed corner button covered "Mark & next" in the exam footer).
 * Renders nothing until a track was chosen, or without the player.
 */

import { Pause, Play } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useStudyMusic } from './StudyMusicProvider';

export function TestMusicButton({ className }: { className?: string }) {
  const music = useStudyMusic();
  if (!music || music.status !== 'ready' || !music.track) return null;
  const playing = music.audible;
  return (
    <>
      <button
        type="button"
        onClick={music.toggle}
        aria-label={playing ? 'Pause music' : 'Play music'}
        aria-pressed={playing}
        title={playing ? `Pause ${music.track.title}` : `Play ${music.track.title}`}
        data-study-music-exam-button=""
        className={cn(
          'flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-2 text-foreground transition-colors duration-200 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          className,
        )}
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {playing ? 'Music playing' : music.held ? 'Music paused for your test' : 'Music paused'}
      </span>
    </>
  );
}
