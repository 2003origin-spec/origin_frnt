'use client';

import { useSyncExternalStore } from 'react';

/**
 * Client preference: whether the floating Ori assistant is hidden, and where the
 * student dragged it. localStorage-backed and reactive via useSyncExternalStore,
 * so the mascot (in FloatingChat) and the Profile toggle stay in sync instantly
 * — including across tabs (the `storage` event). Purely a UI preference; it does
 * not touch the AI feature itself (the highlight "Ask Ori" action still works).
 */

const HIDDEN_KEY = 'origin.ori.hidden';
const POS_KEY = 'origin.ori.pos';
const EVENT = 'origin:ori-visibility';

export type OriPos = { dx: number; dy: number };

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

// ── Hidden flag ─────────────────────────────────────────────────────────────

function readHidden(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOriHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0');
  } catch {
    /* ignore */
  }
  emit();
}

export function useOriHidden(): boolean {
  return useSyncExternalStore(subscribe, readHidden, () => false);
}

// ── Drag position ───────────────────────────────────────────────────────────

const ZERO: OriPos = { dx: 0, dy: 0 };

export function readOriPos(): OriPos {
  if (typeof window === 'undefined') return ZERO;
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return ZERO;
    const p = JSON.parse(raw) as Partial<OriPos>;
    return { dx: Number(p.dx) || 0, dy: Number(p.dy) || 0 };
  } catch {
    return ZERO;
  }
}

export function setOriPos(pos: OriPos): void {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify({ dx: Math.round(pos.dx), dy: Math.round(pos.dy) }));
  } catch {
    /* ignore */
  }
}
