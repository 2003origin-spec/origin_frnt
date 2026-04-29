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
const listeners = new Set<Listener>();
const selectionListeners = new Set<SelectionListener>();

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

    div.style.position = 'absolute';
    div.style.left = '-9999px';
    div.style.top = '0';
    div.style.opacity = '0';
    div.style.pointerEvents = 'none';
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
  const text = extractSelectionText(selection);
  if (!text) {
    if (currentHighlight || currentHighlightRect) {
      currentHighlight = null;
      currentHighlightRect = null;
      emitChange();
    }
    return;
  }

  const anchorNode = selection?.anchorNode;
  const anchorElement =
    anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;

  if (anchorElement?.closest('[data-origin-ai-root="true"]')) {
    if (currentHighlight || currentHighlightRect) {
      currentHighlight = null;
      currentHighlightRect = null;
      emitChange();
    }
    return;
  }

  if (text !== currentHighlight) {
    currentHighlight = text;
    currentHighlightRect = getSelectionRect(selection);
    emitChange();
    return;
  }

  const rect = getSelectionRect(selection);
  if (rect) {
    currentHighlightRect = rect;
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
