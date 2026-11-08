'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { NotesLook } from './NotesMarkdown';

const STORAGE_KEY = 'origin-notes-look';
const listeners = new Set<() => void>();
/** Used when storage is blocked (private mode), so the toggle still works this visit. */
let memoryLook: NotesLook | null = null;

function read(): NotesLook {
  if (memoryLook) return memoryLook;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'clean' ? 'clean' : 'notebook';
  } catch {
    return 'notebook';
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Notebook / Clean reading style, remembered per device (a convenience only). */
export function useNotesLook(): [NotesLook, (look: NotesLook) => void] {
  // Server render and first paint use the default, so hydration always matches.
  const look = useSyncExternalStore(subscribe, read, () => 'notebook' as NotesLook);
  const update = useCallback((next: NotesLook) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      memoryLook = null;
    } catch {
      memoryLook = next;
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [look, update];
}
