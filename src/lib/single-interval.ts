/**
 * An interval slot that can hold at most one running timer.
 *
 * Writing a new `setInterval` id into a shared ref without clearing the old
 * one orphans the old timer for good. OGCode's "Try Again" did exactly that,
 * so every retry added another stopwatch and the reported solve time grew 2×,
 * 3×… — cutting the student's time bonus. `start` always stops the previous
 * timer first.
 */

type IntervalApi<H> = {
  set: (fn: () => void, ms: number) => H;
  clear: (handle: H) => void;
};

export type SingleInterval = {
  start: (fn: () => void, ms: number) => void;
  stop: () => void;
  isRunning: () => boolean;
};

export function createSingleInterval<H = ReturnType<typeof setInterval>>(
  api: IntervalApi<H> = {
    set: (fn, ms) => setInterval(fn, ms) as unknown as H,
    clear: (handle) => clearInterval(handle as unknown as ReturnType<typeof setInterval>),
  },
): SingleInterval {
  let handle: H | null = null;
  const stop = () => {
    if (handle !== null) api.clear(handle);
    handle = null;
  };
  return {
    start(fn, ms) {
      stop();
      handle = api.set(fn, ms);
    },
    stop,
    isRunning: () => handle !== null,
  };
}
