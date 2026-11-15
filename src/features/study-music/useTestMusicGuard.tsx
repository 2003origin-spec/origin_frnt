'use client';

/**
 * The one helper every test start / end site calls (V1/STUDY_MUSIC_PLAN.md §5):
 *
 *   const music = useTestMusicGuard(isRunning);
 *   …start the test FIRST, then music.onTestStart()
 *   …on submit / leave: music.onTestEnd()
 *   render {music.prompt} inside the test surface (it shows in fullscreen), and
 *   {music.button} in the test's own header (the one 48 px play / pause).
 *
 * `active` also covers starts and ends that have no handler of their own (a
 * restored attempt, time-up auto-submit, a third-strike submit), and the hold
 * is always released on unmount (back gesture, crash, navigation). Nothing
 * here can stop or delay a test: without the player (flag off, admin, CBT
 * guest) every call is a no-op and `prompt` renders nothing.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { PauseForTestPrompt } from './PauseForTestPrompt';
import { TestMusicButton } from './TestMusicButton';
import { useStudyMusic } from './StudyMusicProvider';

export function useTestMusicGuard(active: boolean) {
  const music = useStudyMusic();
  const ref = useRef(music);
  useLayoutEffect(() => {
    ref.current = music;
  });

  const onTestStart = useCallback(() => {
    try {
      ref.current?.testStarted();
    } catch {
      /* music must never break a test */
    }
  }, []);
  const onTestEnd = useCallback(() => {
    try {
      ref.current?.testEnded();
    } catch {
      /* music must never break a test */
    }
  }, []);

  useEffect(() => {
    if (active) onTestStart();
    else onTestEnd();
  }, [active, onTestStart, onTestEnd]);

  // Leaving the screen always gives the music back, even a hold restored after
  // a reload that this screen never started.
  useEffect(
    () => () => {
      try {
        ref.current?.testLeft();
      } catch {
        /* music must never break a test */
      }
    },
    [],
  );

  return { onTestStart, onTestEnd, prompt: <PauseForTestPrompt />, button: <TestMusicButton /> };
}
