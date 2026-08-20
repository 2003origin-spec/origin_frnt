'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, EyeOff, Move } from 'lucide-react';
import dynamic from 'next/dynamic';

import { useHighlightedSelection, snapshotHighlightedText } from '@/features/origin-ai/highlight-capture';
import OriMascotStatic from '@/features/mascot/OriMascotStatic';
import { setOriHidden, readOriPos, setOriPos, type OriPos } from '@/lib/ori-visibility';
import { toast } from 'sonner';

// Hold thresholds: 3s → Ori becomes draggable; 4s held still → offer to hide it.
const DRAG_HOLD_MS = 3000;
const HIDE_HOLD_MS = 4000;
const MOVE_THRESHOLD_PX = 8;

const OriMascot = dynamic(() => import('@/features/mascot/OriMascot'), { ssr: false });

// Kept short so each greeting fits on a single line inside the cloud.
const GREET_MESSAGES = [
  (name: string) => `Hey ${name}! Ask me anything 👋`,
  (name: string) => `Stuck, ${name}? I've got you 💡`,
  (name: string) => `Let's crack this, ${name}! ✨`,
  (name: string) => `Need a hint, ${name}? 💡`,
];

interface FloatingChatProps {
  onOpen: (options?: { autoAskSelection?: boolean }) => void;
  autoAskSelectionNonce: number;
  hideMainButton?: boolean;
  userName?: string;
}

export default function FloatingChat({ onOpen, hideMainButton, userName }: FloatingChatProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlightedSelection = useHighlightedSelection();
  const [hovered, setHovered] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * GREET_MESSAGES.length));
  const firstName = userName?.split(' ')[0] ?? 'there';
  const bubbleText = GREET_MESSAGES[msgIndex](firstName);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBubble = (pickNew = false) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (pickNew) setMsgIndex(Math.floor(Math.random() * GREET_MESSAGES.length));
    setBubbleVisible(true);
    // Hold the greeting bubble for 5s before auto-hiding.
    dismissTimerRef.current = setTimeout(() => setBubbleVisible(false), 5000);
  };

  // Auto-show once after 2 s on mount
  useEffect(() => {
    if (hideMainButton) return;
    const t = setTimeout(() => showBubble(), 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideMainButton]);

  // Random re-show every 25–45 s while mascot is visible
  useEffect(() => {
    if (hideMainButton) return;
    const schedule = () => {
      const delay = 25000 + Math.floor(Math.random() * 20000);
      return setTimeout(() => {
        showBubble(true);
        timerRef.current = schedule();
      }, delay);
    };
    const timerRef = { current: schedule() };
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideMainButton]);

  const selectionActionStyle = useMemo(() => {
    const rect = highlightedSelection.rect;
    if (!rect || typeof window === 'undefined') {
      return null;
    }

    const viewportWidth = window.innerWidth;
    const top = Math.max(16, rect.top - 18);
    const left = Math.max(72, Math.min(viewportWidth - 72, rect.left + rect.width / 2));

    return {
      top,
      left,
    };
  }, [highlightedSelection.rect]);

  const shouldShowSelectionAction =
    Boolean(highlightedSelection.text?.trim()) &&
    Boolean(selectionActionStyle);

  // ── Long-press: drag Ori (3s) / offer to hide it (4s held still) ──────────
  const [pos, setPos] = useState<OriPos>({ dx: 0, dy: 0 });
  const [dragMode, setDragMode] = useState(false);
  const [hideOffer, setHideOffer] = useState(false);
  const pressRef = useRef<{ x: number; y: number; dx0: number; dy0: number } | null>(null);
  const movedRef = useRef(false);
  const dragModeRef = useRef(false);
  // A long-press / drag must NOT also fire the button's click-to-open.
  const suppressClickRef = useRef(false);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the saved drag position on mount; clear any pending hold timers on
  // unmount so a timer can never fire setState after the component is gone.
  useEffect(() => {
    setPos(readOriPos());
    return () => {
      if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const clearHoldTimers = () => {
    if (dragTimerRef.current) { clearTimeout(dragTimerRef.current); dragTimerRef.current = null; }
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  };

  const enterDragMode = () => {
    dragModeRef.current = true;
    setDragMode(true);
    // Past this hold, a release is never a "tap to open".
    suppressClickRef.current = true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Ignore secondary buttons; keep keyboard/right-click behaviour intact.
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pressRef.current = { x: e.clientX, y: e.clientY, dx0: pos.dx, dy0: pos.dy };
    movedRef.current = false;
    dragModeRef.current = false;
    suppressClickRef.current = false;
    setHideOffer(false);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    clearHoldTimers();
    dragTimerRef.current = setTimeout(enterDragMode, DRAG_HOLD_MS);
    hideTimerRef.current = setTimeout(() => {
      // Only offer to hide when it was held STILL (no movement).
      if (!movedRef.current) {
        suppressClickRef.current = true;
        setHideOffer(true);
      }
    }, HIDE_HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = pressRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!movedRef.current && Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
      movedRef.current = true;
      // Movement cancels the "hold still to hide" offer.
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      suppressClickRef.current = true;
    }
    if (dragModeRef.current && movedRef.current) {
      // Clamp so Ori can never be dragged fully off-screen.
      const maxX = typeof window !== 'undefined' ? window.innerWidth - 96 : 400;
      const maxY = typeof window !== 'undefined' ? window.innerHeight - 96 : 400;
      const nextDx = Math.max(-maxX, Math.min(96, start.dx0 + dx));
      const nextDy = Math.max(-maxY, Math.min(96, start.dy0 + dy));
      setPos({ dx: nextDx, dy: nextDy });
    }
  };

  const endPress = () => {
    clearHoldTimers();
    if (dragModeRef.current) {
      setOriPos(pos); // persist the new position
    }
    dragModeRef.current = false;
    setDragMode(false);
    pressRef.current = null;
  };

  const onOriClick = () => {
    // Swallow the click that follows a long-press / drag; a real tap opens Ori.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen();
  };

  const hideOri = () => {
    setHideOffer(false);
    suppressClickRef.current = false;
    setOriHidden(true);
    toast('Ori hidden', {
      description: 'You can bring it back anytime from Profile → Settings.',
      icon: <EyeOff className="h-4 w-4" />,
      duration: 6000,
    });
  };

  return (
    <>
      <AnimatePresence>
        {shouldShowSelectionAction && selectionActionStyle ? (
          <motion.button
            type="button"
            key="origin-ai-selection-action"
            data-origin-ai-root="true"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.16 }}
            onMouseDown={() => {
              // Snapshot BEFORE the browser clears the selection (mousedown is the first event)
              snapshotHighlightedText();
            }}
            onClick={() => onOpen({ autoAskSelection: true })}
            className="fixed z-[70] flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-background/90 px-2 py-1.5 text-foreground shadow-xl backdrop-blur-md transition-colors"
            style={{
              top: `${selectionActionStyle.top}px`,
              left: `${selectionActionStyle.left}px`,
              transform: 'translate(-50%, -100%)',
            }}
            aria-label="Ask Ori about the selected text"
          >
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-primary/10 p-0.5">
              <OriMascotStatic className="h-full w-full" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-900 dark:text-primary/80">
              Ask Ori
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Dismiss backdrop for the hide-offer (tap anywhere to cancel). */}
      {!hideMainButton && hideOffer && (
        <div className="fixed inset-0 z-40" onClick={() => setHideOffer(false)} aria-hidden />
      )}

      {!hideMainButton && (
        <div
          ref={containerRef}
          className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 lg:bottom-6 lg:right-6 z-50 flex flex-col items-end gap-2"
          style={{ transform: `translate3d(${pos.dx}px, ${pos.dy}px, 0)` }}
        >

          {/* Glossy 3D cloud thought-bubble — the greeting sits inside the cloud on one line */}
          <AnimatePresence>
            {bubbleVisible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 12, transition: { duration: 0.25 } }}
                // ~1s ease to move/settle into view; exit stays quick (in the exit prop).
                transition={{ duration: 1, ease: 'easeOut' }}
                className="relative mr-10 text-white dark:text-slate-100"
              >
                {/* Cloud shape, stretched to hug the one-line message behind it */}
                <div className="relative px-7 py-4">
                  <svg
                    viewBox="0 0 300 130"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    aria-hidden
                  >
                    <defs>
                      <filter id="ori-cloud-shadow" x="-20%" y="-20%" width="140%" height="150%">
                        <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="rgba(15,23,42,0.18)" />
                      </filter>
                    </defs>
                    <g filter="url(#ori-cloud-shadow)" fill="currentColor">
                      <ellipse cx="150" cy="84" rx="138" ry="40" />
                      <circle cx="58" cy="66" r="30" />
                      <circle cx="116" cy="50" r="38" />
                      <circle cx="184" cy="48" r="40" />
                      <circle cx="244" cy="66" r="31" />
                      <circle cx="30" cy="84" r="22" />
                      <circle cx="272" cy="84" r="22" />
                    </g>
                    {/* top gloss highlight for the 3D sheen */}
                    <ellipse cx="135" cy="46" rx="74" ry="15" fill="#ffffff" opacity="0.5" />
                    {/* soft bottom contact shading for depth */}
                    <ellipse cx="150" cy="112" rx="120" ry="12" fill="rgba(15,23,42,0.05)" />
                  </svg>

                  <button
                    type="button"
                    onClick={() => setBubbleVisible(false)}
                    className="absolute right-1 top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-sm hover:bg-red-100 hover:text-red-400 dark:bg-slate-700 dark:text-slate-300"
                    aria-label="Dismiss"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>

                  <p className="relative z-10 whitespace-nowrap text-center text-[12px] font-bold leading-none text-slate-700 dark:text-slate-800">
                    {bubbleText}
                  </p>
                </div>

                {/* Thought-bubble trailing puffs toward the mascot (down-right) */}
                <span className="absolute -bottom-1 right-6 h-3 w-3 rounded-full bg-current shadow-[0_2px_4px_rgba(15,23,42,0.15)]" />
                <span className="absolute -bottom-3 right-3 h-2 w-2 rounded-full bg-current shadow-[0_2px_4px_rgba(15,23,42,0.15)]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hide-offer: appears after a 4s still hold. Tap to hide Ori. */}
          <AnimatePresence>
            {hideOffer && (
              <motion.button
                type="button"
                data-origin-ai-root="true"
                initial={{ opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 6 }}
                onClick={hideOri}
                className="z-[60] flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-white shadow-2xl"
                aria-label="Hide Ori"
              >
                <EyeOff className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-wider">Hide Ori</span>
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            data-origin-ai-root="true"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onHoverStart={() => { setHovered(true); showBubble(true); }}
            onHoverEnd={() => setHovered(false)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPress}
            onPointerCancel={endPress}
            onClick={onOriClick}
            id="tutorial-mentor-trigger"
            className="relative outline-none"
            style={{ touchAction: 'none', cursor: dragMode ? 'grabbing' : undefined }}
            aria-label="Open Ori"
          >
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-0 transition-transform duration-500 group-hover:scale-150" />
              {/* Drag-mode ring so the student knows Ori is now movable. */}
              {dragMode && (
                <span className="absolute inset-2 z-20 rounded-full ring-2 ring-primary/70 animate-pulse pointer-events-none" />
              )}
              <div className="absolute inset-0 z-0 flex items-center justify-center text-blue-100">
                <Sparkles className="h-4 w-4 lg:h-5 lg:w-5" />
              </div>
              <div className="relative z-10 block h-24 w-24 drop-shadow-2xl lg:h-28 lg:w-28">
                <OriMascot state="idle" title="Ori" preload={false} />
              </div>
              <div className="absolute right-1.5 top-1.5 z-20 h-3 w-3 rounded-full border-2 border-white bg-primary shadow-md dark:border-slate-900 lg:right-2 lg:top-2 lg:h-3.5 lg:w-3.5" />
              {dragMode && (
                <span className="absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-900/90 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white pointer-events-none flex items-center gap-0.5">
                  <Move className="h-2.5 w-2.5" /> Drag
                </span>
              )}
            </div>
          </motion.button>
        </div>
      )}
    </>
  );
}
