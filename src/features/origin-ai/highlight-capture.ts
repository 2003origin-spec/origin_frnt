'use client';

import React from 'react';

type Listener = (text: string | null) => void;
type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
type HighlightSelection = {
  text: string | null;
  rect: HighlightRect | null;
};
type SelectionListener = (selection: HighlightSelection) => void;

let currentHighlight: string | null = null;
let currentHighlightRect: HighlightRect | null = null;
// When the browser clears the selection (e.g. clicking a button), we keep the
// last valid highlight for a short window so auto-ask flows can still read it.
let lastValidHighlight: string | null = null;
let lastValidHighlightTs: number = 0;
const HIGHLIGHT_RETAIN_MS = 3_000; // keep for 3 seconds after deselection
const listeners = new Set<Listener>();
const selectionListeners = new Set<SelectionListener>();

// Selection state tracking
let isMouseDown = false;
let heavyExtractionTimeout: NodeJS.Timeout | null = null;

function emitChange() {
  listeners.forEach((listener) => listener(currentHighlight));
  const selection = {
    text: currentHighlight,
    rect: currentHighlightRect,
  };
  selectionListeners.forEach((listener) => listener(selection));
}

function getSelectionRect(selection: Selection | null): HighlightRect | null {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function extractSelectionText(selection: Selection | null): string | null {
  if (!selection || selection.rangeCount === 0) return null;

  // If we are currently dragging, we perform a LIGHTWEIGHT extraction to avoid
  // triggering layout recalcs that disrupt the browser's selection engine.
  if (isMouseDown) {
    return selection.toString().trim() || null;
  }

  let extractedText = '';
  
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    const frag = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(frag);

    // Process KaTeX nodes bottom-up to handle nested math correctly
    const katexNodes = Array.from(div.querySelectorAll('.katex'));
    // Sort by depth (deepest first) to ensure we don't replace a parent before its children
    katexNodes.sort((a, b) => b.querySelectorAll('*').length - a.querySelectorAll('*').length);

    katexNodes.forEach((node) => {
      // Check if node is still connected to our working div
      if (!div.contains(node)) return;

      const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
      const mathElement = node.querySelector('math');
      const ariaLabel = node.getAttribute('aria-label');
      
      // Attempt to find the best LaTeX source
      const tex = (annotation?.textContent || mathElement?.getAttribute('alttext') || ariaLabel || '').trim();
      
      // If the TeX source looks like it might be visual junk (contains symbols like √ or scripts incorrectly)
      // we try to clean it or skip it to avoid corruption like "$./$(...)"
      if (tex && !tex.includes('$./')) {
        const isDisplay = node.classList.contains('katex-display') || !!node.querySelector('.katex-display');
        const delimiter = isDisplay ? '$$' : '$';
        
        // Replace the entire KaTeX block with the clean TeX string
        const textNode = document.createTextNode(`${delimiter}${tex}${delimiter}`);
        node.replaceWith(textNode);
      } else {
        // If no reliable TeX found, strip all visual noise to prevent corrupted innerText
        node.querySelectorAll('.katex-html, .katex-mathml').forEach(n => n.remove());
        // If it's a root .katex node and we cleared its guts, remove it entirely
        if (node.classList.contains('katex') && !node.textContent?.trim()) {
          node.remove();
        }
      }
    });

    // Cleanup orphaned KaTeX fragments (common in partial selections)
    const orphanedJunk = div.querySelectorAll(
      '.katex-html, .katex-mathml, .katex-display, .vlist, .strut, .base, .mord, .msupsub'
    );
    orphanedJunk.forEach(n => n.remove());

    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.top = '0';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    document.body.appendChild(div);
    
    // innerText respects display:none and gives us a clean text representation
    extractedText += div.innerText;
    document.body.removeChild(div);
  }
  
  return extractedText.trim() || null;
}

function handleSelectionChange() {
  const selection = window.getSelection();
  
  // Phase 1: Immediate lightweight update
  const lightText = selection?.toString().trim() || null;
  
  if (!lightText) {
    if (currentHighlight || currentHighlightRect) {
      // Save the highlight before clearing so auto-ask flows can still read it
      if (currentHighlight) {
        lastValidHighlight = currentHighlight;
        lastValidHighlightTs = Date.now();
      }
      currentHighlight = null;
      currentHighlightRect = null;
      emitChange();
    }
    return;
  }

  // Check if we are inside an ignored root
  const anchorNode = selection?.anchorNode;
  const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;
  if (anchorElement?.closest('[data-origin-ai-root="true"]')) {
    if (currentHighlight || currentHighlightRect) {
      currentHighlight = null;
      currentHighlightRect = null;
      emitChange();
    }
    return;
  }

  // Update immediately with light text if it's new (Phase 1)
  // This gives the user feedback that selection is working without causing lag.
  if (lightText !== currentHighlight) {
    currentHighlight = lightText;
    currentHighlightRect = getSelectionRect(selection);
    emitChange();
  }

  // Phase 2: Rich extraction (KaTeX handling)
  // We debounce this to avoid DOM mutations during active dragging.
  if (heavyExtractionTimeout) clearTimeout(heavyExtractionTimeout);
  
  heavyExtractionTimeout = setTimeout(() => {
    // Only perform heavy extraction if we still have a selection and mouse is up
    if (!isMouseDown) {
      const richText = extractSelectionText(window.getSelection());
      if (richText && richText !== currentHighlight) {
        currentHighlight = richText;
        currentHighlightRect = getSelectionRect(window.getSelection());
        console.log('[highlight-capture] Rich update:', richText.slice(0, 50));
        emitChange();
      }
    }
  }, 200);
}

// Global mouse listeners to track drag state
function handleMouseDown() { 
  isMouseDown = true; 
}
function handleMouseUp() { 
  isMouseDown = false;
  // Trigger a re-evaluation on mouse up to finalize the rich extraction
  handleSelectionChange();
}

let isListening = false;

export function startHighlightCapture(): void {
  if (typeof window === 'undefined' || isListening) return;
  isListening = true;
  document.addEventListener('selectionchange', handleSelectionChange);
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
}

export function stopHighlightCapture(): void {
  if (typeof window === 'undefined') return;
  isListening = false;
  document.removeEventListener('selectionchange', handleSelectionChange);
  window.removeEventListener('mousedown', handleMouseDown);
  window.removeEventListener('mouseup', handleMouseUp);
  clearHighlightedText();
}

export function clearHighlightedText(): void {
  currentHighlight = null;
  currentHighlightRect = null;
  emitChange();
}

export function setManualSelection(text: string | null, rect?: HighlightRect | null): void {
  currentHighlight = text;
  currentHighlightRect = rect || null;
  emitChange();
}

export function getHighlightedText(): string | null {
  return currentHighlight;
}

/**
 * Snapshot the current highlighted text so it survives the browser clearing
 * the selection. Also copies to lastValidHighlight as a fallback.
 */
export function snapshotHighlightedText(): void {
  if (currentHighlight) {
    lastValidHighlight = currentHighlight;
    lastValidHighlightTs = Date.now();
  }
}

/**
 * Retrieve the highlighted text, falling back to the last valid highlight
 * if the browser already cleared the selection (within a 3-second window).
 * Consumes the buffer on read to prevent stale reuse.
 */
export function getPendingHighlightedText(): string | null {
  // Prefer current live highlight
  if (currentHighlight) {
    console.log('[highlight-capture] getPending → live:', currentHighlight?.slice(0, 60));
    return currentHighlight;
  }
  // Fall back to the time-buffered last valid highlight
  if (lastValidHighlight && (Date.now() - lastValidHighlightTs) < HIGHLIGHT_RETAIN_MS) {
    const text = lastValidHighlight;
    console.log('[highlight-capture] getPending → buffered:', text?.slice(0, 60), 'age:', Date.now() - lastValidHighlightTs, 'ms');
    lastValidHighlight = null; // consume
    return text;
  }
  console.log('[highlight-capture] getPending → NULL (buffer:', lastValidHighlight?.slice(0, 30), 'age:', lastValidHighlight ? Date.now() - lastValidHighlightTs : 'n/a', 'ms)');
  lastValidHighlight = null;
  return null;
}

export function getHighlightedSelection(): HighlightSelection {
  return {
    text: currentHighlight,
    rect: currentHighlightRect,
  };
}

export function useHighlightedText(): string | null {
  const [text, setText] = React.useState<string | null>(currentHighlight);

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

export function useHighlightedSelection(): HighlightSelection {
  const [selection, setSelection] = React.useState<HighlightSelection>({
    text: currentHighlight,
    rect: currentHighlightRect,
  });

  React.useEffect(() => {
    startHighlightCapture();

    const handler = (nextSelection: HighlightSelection) => {
      setSelection(nextSelection);
    };

    selectionListeners.add(handler);
    return () => {
      selectionListeners.delete(handler);
    };
  }, []);

  return selection;
}
