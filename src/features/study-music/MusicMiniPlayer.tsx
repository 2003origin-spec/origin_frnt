'use client';

/**
 * Study Music mini player (V1/STUDY_MUSIC_PLAN.md §7), mounted once in ClientShell.
 *
 *   - Shows only once a track was chosen. Desktop: bottom-left, clear of the
 *     sidebar rail (Ori's launcher is bottom-right). Mobile: above the bottom
 *     tab bar and clear of Ori's raised centre button. z-40, below the nav (z-50).
 *   - Exam pages: nothing here; each test shows ONE 48 px play / pause button
 *     in its own header (TestMusicButton), the only music control in a test.
 *   - Hidden on admin, the teacher console and the signed-out pages.
 *   - After a full page load the browser may refuse to start audio without a
 *     click: then a "Resume music" chip replaces the controls.
 * Play state is announced to screen readers; the little equaliser only moves
 * when the system allows motion.
 */

import { Pause, Play, SkipForward, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isMusicExamPath, isMusicHiddenPath } from '@/lib/study-music-player';

import { useStudyMusic } from './StudyMusicProvider';

const iconButton =
  'flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors duration-200 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function Equaliser({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn('w-[3px] rounded-sm bg-primary', on ? 'h-full origin-bottom motion-safe:animate-[music-eq_0.9s_ease-in-out_infinite]' : 'h-1')}
          style={on ? { animationDelay: `${i * 0.15}s` } : undefined}
        />
      ))}
    </span>
  );
}

export function MusicMiniPlayer({ pathname, withTabBar, railWidth }: { pathname: string; withTabBar: boolean; railWidth: number }) {
  const music = useStudyMusic();
  if (!music || music.status !== 'ready' || !music.track || isMusicHiddenPath(pathname)) return null;
  const { track, audible, held, state } = music;
  const playing = audible;
  const label = playing ? 'Pause music' : 'Play music';
  const announce = state.error
    ? state.error
    : playing
      ? `Playing ${track.title} by ${track.artist}`
      : held
        ? 'Music paused for now'
        : 'Music paused';

  // Exam pages: the test renders its own 48 px button in its header
  // (TestMusicButton), where it can't cover any exam control.
  if (isMusicExamPath(pathname)) return null;

  return (
    <section
      aria-label="BoomBoom music player"
      data-study-music-mini=""
      style={{ ['--music-rail' as string]: `${railWidth}px` }}
      className={cn(
        'fixed z-40 flex items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-1 text-foreground',
        // Mobile: full width above the tab bar (or the screen edge without one).
        'left-3 right-3',
        // The tab bar is 3.75rem and Ori's centre button rises ~1.6rem above it.
        withTabBar ? 'bottom-[calc(6rem+env(safe-area-inset-bottom))]' : 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]',
        // Desktop: a compact pill bottom-left, clear of the sidebar rail.
        'md:right-auto md:bottom-4 md:left-[calc(var(--music-rail)+1rem)] md:w-[22rem]',
      )}
    >
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
      {state.needsGesture ? (
        <button
          type="button"
          onClick={music.play}
          className="flex min-h-12 flex-1 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Play className="h-4 w-4" aria-hidden />
          <span className="truncate">Resume music · {track.title}</span>
        </button>
      ) : (
        <>
          <button type="button" onClick={music.toggle} aria-label={label} aria-pressed={playing} className={cn(iconButton, 'bg-surface-3')}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1 px-1">
            <p className="flex items-center gap-2 truncate text-[13px] font-semibold leading-tight">
              <Equaliser on={playing} />
              <span className="truncate" title={track.title}>
                {track.title}
              </span>
            </p>
            <p className="truncate text-xs leading-tight text-muted-foreground" title={state.error ?? track.artist}>
              {state.error ?? (held ? 'Paused for now' : track.artist)}
            </p>
          </div>
          <button type="button" onClick={music.next} aria-label="Next track" className={iconButton}>
            <SkipForward className="h-5 w-5" />
          </button>
        </>
      )}
      <button type="button" onClick={music.stop} aria-label="Close music player" className={iconButton}>
        <X className="h-5 w-5" />
      </button>
    </section>
  );
}
