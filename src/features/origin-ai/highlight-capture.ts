'use client';

import React from 'react';

type Listener = (text: string | null) => void;

let currentHighlight: string | null = null;
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach((listener) => listener(currentHighlight));
}

function handleSelectionChange() {
  const selection = window.getSelection();
  const text = selection?.toString().trim() || null;
  if (text !== currentHighlight) {
    currentHighlight = text && text.length > 0 ? text : null;
    emitChange();
  }
}

let isListening = false;

export function startHighlightCapture(): void {
  if (isListening) return;
  isListening = true;
  document.addEventListener('selectionchange', handleSelectionChange);
}

export function stopHighlightCapture(): void {
  isListening = false;
  document.removeEventListener('selectionchange', handleSelectionChange);
  currentHighlight = null;
  emitChange();
}

export function getHighlightedText(): string | null {
  return currentHighlight;
}

export function useHighlightedText(): string | null {
  const [text, setText] = React.useState<string | null>(null);

  React.useEffect(() => {
    startHighlightCapture();

    const handler = (newText: string | null) => {
      setText(newText);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return text;
}
