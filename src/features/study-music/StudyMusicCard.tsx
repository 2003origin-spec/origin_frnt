'use client';

/**
 * The Pomodoro page's "Study Music" card when the studyMusic flag is on
 * (V1/STUDY_MUSIC_PLAN.md §7, §9): mood picker, the mood's tracks, play /
 * pause / previous / next, "Start music with focus", "Stop at breaks",
 * "Pause music during tests", the sleep timer, "Music today" and the music credits.
 *
 * `StudyMusicCardView` is pure (props in, callbacks out) so every state can be
 * rendered in tests; `StudyMusicCard` connects it to the player.
 */

import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from 'lucide-react';

import { cn } from '@/lib/utils';
import { MUSIC_MOOD_LABELS, formatMusicToday, type MusicMood, type MusicPrefs } from '@/lib/study-music';
import { availableMoods, moodQueue, type FocusSettings, type PlayerTrack } from '@/lib/study-music-player';
import { SLEEP_PRESETS_MIN, sleepLabel, type SleepChoice, type SleepTimer } from '@/lib/study-music-sleep';

import { useStudyMusic } from './StudyMusicProvider';

function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const roundButton =
  'flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50';

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-12 items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          checked ? 'border-primary bg-primary' : 'border-border bg-surface-3',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-background transition-transform duration-200 motion-reduce:transition-none',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

const CHIP =
  'min-h-12 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  );
}

export type StudyMusicCardViewProps = {
  status: 'loading' | 'ready' | 'off';
  tracks: PlayerTrack[];
  mood: MusicMood;
  currentId: string | null;
  playing: boolean;
  held: boolean;
  error: string | null;
  prefs: MusicPrefs;
  focusSettings: FocusSettings;
  today: { seconds: number; focusSeconds: number };
  sleep: SleepTimer;
  /** Clock for the "Stops in N min" text. */
  now: number;
  onSleep: (choice: SleepChoice) => void;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSelect: (trackId: string) => void;
  onMood: (mood: MusicMood) => void;
  onPauseDuringTests: (value: boolean) => void;
  onFocusSettings: (value: FocusSettings) => void;
};

export function StudyMusicCardView(props: StudyMusicCardViewProps) {
  const { status, tracks, mood, currentId, playing, held, error, prefs, focusSettings, today } = props;
  const moodGroup = useId();
  const sleepGroup = useId();
  if (status === 'loading') {
    return (
      <div aria-busy="true" className="space-y-3">
        <p className="text-sm text-muted-foreground">Loading music…</p>
        <div className="h-12 animate-pulse rounded-full bg-surface-3 motion-reduce:animate-none" />
      </div>
    );
  }
  if (status === 'off' || !tracks.length) {
    return <p className="text-sm text-muted-foreground">No music yet. It will appear here as soon as it is added.</p>;
  }
  const moods = availableMoods(tracks);
  const queue = moodQueue(tracks, mood);
  const current = tracks.find((t) => t.id === currentId) ?? null;
  const credited = tracks.filter((t) => t.credit.text);

  return (
    <div className="space-y-4 text-foreground">
      {/* Now playing + controls */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={props.onPrevious} aria-label="Previous track" className={cn(roundButton, 'hover:bg-surface-3')}>
          <SkipBack className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={props.onToggle}
          aria-label={playing ? 'Pause music' : 'Play music'}
          aria-pressed={playing}
          className={cn(roundButton, 'bg-primary text-primary-foreground hover:bg-primary/90')}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button type="button" onClick={props.onNext} aria-label="Next track" className={cn(roundButton, 'hover:bg-surface-3')}>
          <SkipForward className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 pl-1" aria-live="polite">
          <p className="truncate text-sm font-semibold" title={current?.title}>
            {current ? current.title : 'Pick a mood and press play'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {error ?? (current ? (held && !playing ? `${current.artist} · paused for now` : current.artist) : `${tracks.length} tracks`)}
          </p>
        </div>
      </div>
      {current && <p className="text-xs text-muted-foreground">{current.credit.text}</p>}

      {/* Moods */}
      <div role="radiogroup" aria-labelledby={`${moodGroup}-label`}>
        <p id={`${moodGroup}-label`} className="mb-2 text-xs font-medium text-muted-foreground">
          Mood
        </p>
        <div className="flex flex-wrap gap-2">
          {moods.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === mood}
              onClick={() => props.onMood(m)}
              className={cn(
                CHIP,
                m === mood ? 'border-primary bg-primary/15 text-foreground' : 'border-border hover:bg-surface-3',
              )}
            >
              {MUSIC_MOOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Tracks of the mood */}
      <ul className="space-y-1" aria-label={`${MUSIC_MOOD_LABELS[mood]} tracks`}>
        {queue.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => props.onSelect(t.id)}
              aria-current={t.id === currentId ? 'true' : undefined}
              className={cn(
                'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                t.id === currentId ? 'bg-primary/10' : 'hover:bg-surface-3',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" title={t.title}>
                  {t.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{t.artist}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{mmss(t.durationSeconds)}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Settings */}
      <div className="divide-y divide-border border-y border-border">
        <Switch
          label="Start music with focus"
          checked={focusSettings.startWithFocus}
          onChange={(v) => props.onFocusSettings({ ...focusSettings, startWithFocus: v })}
        />
        <Switch
          label="Stop at breaks"
          hint="Music comes back when the next focus block starts."
          checked={focusSettings.stopAtBreaks}
          onChange={(v) => props.onFocusSettings({ ...focusSettings, stopAtBreaks: v })}
        />
        <Switch
          label="Pause music during tests"
          hint="Asks when a test starts."
          checked={prefs.pauseDuringTests}
          onChange={props.onPauseDuringTests}
        />
      </div>

      {/* Sleep timer (same choices as the app) */}
      <div role="group" aria-labelledby={`${sleepGroup}-label`}>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p id={`${sleepGroup}-label`} className="text-xs font-medium text-muted-foreground">
            Sleep timer
          </p>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {sleepLabel(props.sleep, props.now) ?? 'Off'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SLEEP_PRESETS_MIN.map((m) => (
            <button key={m} type="button" onClick={() => props.onSleep(m)} className={cn(CHIP, 'border-border hover:bg-surface-3')}>
              {m} min
            </button>
          ))}
          <button
            type="button"
            aria-pressed={props.sleep?.kind === 'endOfTrack'}
            onClick={() => props.onSleep('endOfTrack')}
            className={cn(CHIP, props.sleep?.kind === 'endOfTrack' ? 'border-primary bg-primary/15' : 'border-border hover:bg-surface-3')}
          >
            End of track
          </button>
          {props.sleep && (
            <button type="button" onClick={() => props.onSleep(null)} aria-label="Turn the sleep timer off" className={cn(CHIP, 'border-border hover:bg-surface-3')}>
              Off
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{formatMusicToday(today)}</p>

      {/* Credits: required ones are listed for every track (plan §4.4). */}
      <details className="group text-xs">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1 font-medium text-foreground">
          Music credits
          <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <ul className="space-y-2 pb-2 text-muted-foreground">
          {credited.map((t) => (
            <li key={t.id}>
              <span className="text-foreground">{t.credit.text}</span> · <ExternalLink href={t.credit.licenceUrl}>{t.credit.licenceName}</ExternalLink> ·{' '}
              <ExternalLink href={t.credit.sourceUrl}>source</ExternalLink>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function StudyMusicCard() {
  const music = useStudyMusic();
  const sleep = music?.sleep ?? null;
  const [now, setNow] = useState(() => Date.now());
  // Refresh "Stops in N min" while a timed stop is set.
  useEffect(() => {
    if (sleep?.kind !== 'at') return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [sleep]);
  if (!music) return null;
  return (
    <StudyMusicCardView
      status={music.status}
      tracks={music.state.tracks}
      mood={music.state.mood}
      currentId={music.state.trackId}
      playing={music.audible}
      held={music.held}
      error={music.state.error}
      prefs={music.prefs}
      focusSettings={music.focusSettings}
      today={music.today}
      sleep={music.sleep}
      now={now}
      onSleep={(choice) => {
        setNow(Date.now());
        music.setSleep(choice);
      }}
      onToggle={music.toggle}
      onNext={music.next}
      onPrevious={music.previous}
      onSelect={music.select}
      onMood={music.setMood}
      onPauseDuringTests={music.setPauseDuringTests}
      onFocusSettings={music.setFocusSettings}
    />
  );
}
