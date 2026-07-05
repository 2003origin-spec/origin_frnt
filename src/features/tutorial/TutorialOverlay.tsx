'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from './TutorialProvider';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';

// Cycle through different Ori expressions per step for variety
const ORI_IMAGES = [
  '/ori2d/ori-happy.png',
  '/ori2d/ori-thubmsup.png',
  '/ori2d/ori-exited.png',
  '/ori2d/ori-curious.png',
  '/ori2d/ori-winking.png',
  '/ori2d/ori-proud.png',
  '/ori2d/ori-cheerful.png',
  '/ori2d/ori-reading.png',
  '/ori2d/ori-thinking.png',
  '/ori2d/ori-determined.png',
  '/ori2d/ori-surprise.png',
  '/ori2d/ori-laptop.png',
];

function getOriImage(stepIndex: number): string {
  return ORI_IMAGES[stepIndex % ORI_IMAGES.length];
}

export const TutorialOverlay: React.FC = () => {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTutorial } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[currentStep];

  useEffect(() => {
    if (!isActive || !step) return;

    let rafId: number;
    let roCleanup: (() => void) | null = null;

    const measure = () => {
      if (step.targetId === 'tutorial-welcome') {
        setTargetRect(null);
        return;
      }
      const element = document.getElementById(step.targetId);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };

    const init = () => {
      if (step.targetId === 'tutorial-welcome') {
        setTargetRect(null);
        return;
      }

      // Handle mentor panel trigger
      if (step.targetId === 'tutorial-mentor') {
        const el = document.getElementById(step.targetId);
        if (!el) {
          document.getElementById('tutorial-mentor-trigger')?.click();
          setTimeout(init, 350);
          return;
        }
      }

      const element = document.getElementById(step.targetId);
      if (element) {
        // Scroll first, then re-measure after scroll settles
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Measure immediately for a quick first paint
        setTargetRect(element.getBoundingClientRect());
        // Re-measure after smooth scroll finishes (~400ms)
        const t = setTimeout(measure, 420);

        // Keep tracking if element resizes (e.g. panel expands)
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(scheduleUpdate);
          ro.observe(element);
          roCleanup = () => ro.disconnect();
        }

        return () => clearTimeout(t);
      } else {
        setTargetRect(null);
      }
    };

    init();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      roCleanup?.();
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate);
    };
  }, [isActive, step, currentStep]);

  if (!isActive || !step) return null;

  const placement = step.placement ?? 'bottom';
  const pos = calculateTooltipPosition(targetRect, placement);
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* Spotlight overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={skipTutorial}>
        <defs>
          <mask id="tutorial-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <motion.rect
                initial={false}
                animate={{
                  x: targetRect.x - 10,
                  y: targetRect.y - 10,
                  width: targetRect.width + 20,
                  height: targetRect.height + 20,
                  rx: 14,
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.62)"
          mask="url(#tutorial-spotlight-mask)"
        />
      </svg>

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          className="pointer-events-none fixed inset-0 z-[10000]"
        >
          <div
            className="pointer-events-auto absolute neu-raised"
            style={{
              ...pos,
              width: 'min(360px, calc(100vw - 32px))',
              borderRadius: 20,
              padding: '20px 22px 18px',
            }}
          >
            {/* Directional arrow caret pointing at the target */}
            {targetRect && placement !== 'center' && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  ...(placement === 'bottom' || placement === 'top'
                    ? {
                        left: '50%',
                        transform: 'translateX(-50%)',
                        [placement === 'bottom' ? 'top' : 'bottom']: -8,
                        borderLeft: '8px solid transparent',
                        borderRight: '8px solid transparent',
                        ...(placement === 'bottom'
                          ? { borderBottom: '8px solid hsl(var(--neu-bg))' }
                          : { borderTop: '8px solid hsl(var(--neu-bg))' }),
                      }
                    : {
                        top: '50%',
                        transform: 'translateY(-50%)',
                        [placement === 'right' ? 'left' : 'right']: -8,
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        ...(placement === 'right'
                          ? { borderRight: '8px solid hsl(var(--neu-bg))' }
                          : { borderLeft: '8px solid hsl(var(--neu-bg))' }),
                      }),
                  width: 0,
                  height: 0,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* Subtle primary glow */}
            <div
              className="absolute inset-0 rounded-[20px] pointer-events-none overflow-hidden"
              aria-hidden
            >
              <div
                className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-[48px] opacity-20"
                style={{ background: 'radial-gradient(circle, var(--color-primary, #0066ff), transparent)' }}
              />
            </div>

            {/* Header row */}
            <div className="relative flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <motion.img
                  key={currentStep}
                  src={getOriImage(currentStep)}
                  alt="Ori"
                  className="w-10 h-10 object-contain shrink-0 select-none"
                  initial={{ scale: 0.7, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  draggable={false}
                />
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground truncate">
                  {step.title}
                </h3>
              </div>
              <button
                onClick={skipTutorial}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                Skip <X className="w-3 h-3" />
              </button>
            </div>

            {/* Description */}
            <p className="relative text-sm text-muted-foreground leading-relaxed font-medium mb-5">
              {step.description}
            </p>

            {/* Footer: dots + nav */}
            <div className="relative flex items-center justify-between">
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === currentStep ? 20 : 6,
                      background: i === currentStep
                        ? 'var(--color-primary, #0066ff)'
                        : 'hsl(var(--neu-shadow, 215 28% 17%) / 0.18)',
                    }}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 transition-all"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-full text-white text-[11px] font-black uppercase tracking-[0.15em] transition-all hover:opacity-90 active:scale-95"
                  style={{
                    background: 'var(--color-primary, #0066ff)',
                    boxShadow: '0 4px 14px rgba(0,102,255,0.30)',
                  }}
                >
                  {isLast ? 'Done' : 'Next'}
                  {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Step counter */}
            {steps.length > 1 && (
              <div className="relative mt-3 text-center text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">
                {currentStep + 1} / {steps.length}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

function calculateTooltipPosition(rect: DOMRect | null, placement: string): React.CSSProperties {
  if (!rect) {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const GAP = 18;
  const MARGIN = 16;
  const TW = 360;
  const TH = 230;

  let top: number;
  let left: number;
  let tx = '-50%';
  let ty = '0%';

  if (placement === 'top') {
    top = rect.top - GAP;
    left = rect.left + rect.width / 2;
    ty = '-100%';
  } else if (placement === 'left') {
    top = rect.top + rect.height / 2;
    left = rect.left - GAP;
    tx = '-100%';
    ty = '-50%';
  } else if (placement === 'right') {
    top = rect.top + rect.height / 2;
    left = rect.right + GAP;
    tx = '0%';
    ty = '-50%';
  } else {
    // bottom (default)
    top = rect.bottom + GAP;
    left = rect.left + rect.width / 2;
  }

  // flip bottom→top if off screen
  if (placement === 'bottom' && top + TH > window.innerHeight - MARGIN) {
    top = rect.top - GAP;
    ty = '-100%';
  }
  // flip top→bottom if off screen
  if (placement === 'top' && top - TH < MARGIN) {
    top = rect.bottom + GAP;
    ty = '0%';
  }

  // horizontal clamp
  const estLeft = left + (tx === '-50%' ? -TW / 2 : tx === '-100%' ? -TW : 0);
  if (estLeft < MARGIN) {
    left = MARGIN;
    tx = '0%';
  } else if (estLeft + TW > window.innerWidth - MARGIN) {
    left = window.innerWidth - MARGIN;
    tx = '-100%';
  }

  // vertical clamp
  const estTop = top + (ty === '-50%' ? -TH / 2 : ty === '-100%' ? -TH : 0);
  if (estTop < MARGIN) {
    top = MARGIN;
    ty = '0%';
  } else if (estTop + TH > window.innerHeight - MARGIN) {
    top = window.innerHeight - MARGIN;
    ty = '-100%';
  }

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    transform: `translate(${tx}, ${ty})`,
  };
}
