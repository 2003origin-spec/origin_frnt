'use client';

/**
 * Study Mode toggle — the single-select that scopes the student's whole app to
 * JEE (P·C·M), NEET (P·C·B) or PCMB (all four).
 *
 * Availability rule (plan §7 / Q1): only students who own a COMPLETE mode bundle
 * see this at all. A one- or two-subject buyer has nothing to toggle between —
 * their entitlement already scopes them more tightly than any mode would, and
 * every mode would hide something they paid for. Modes they don't fully own
 * render disabled with the missing subjects named.
 *
 * Because every selectable mode is fully owned, a switch can never hide a paid
 * subject — so there is deliberately no confirmation step. One tap.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.
 */

import { useMemo, useRef } from 'react';
import { Check, Lock, Loader2 } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import {
  ALL_STUDY_MODES,
  STUDY_MODE_BLURB,
  STUDY_MODE_LABELS,
  studyModeCoverage,
  type StudyMode,
} from '@/lib/study-mode';
import { getEntitledSubjects } from '@/lib/entitlements';
import { cn } from '@/lib/utils';

function subjectLabel(subject: string): string {
  return subject[0].toUpperCase() + subject.slice(1);
}

export default function StudyModeToggle({ className }: { className?: string }) {
  const {
    user,
    studyMode,
    studyModeAvailable,
    availableStudyModes,
    studyModePending,
    setStudyMode,
    isNavigationLocked,
  } = useAuth();

  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const owned = useMemo(() => getEntitledSubjects(user), [user]);

  if (!user || user.role !== 'student' || !studyModeAvailable) return null;

  const select = (mode: StudyMode) => {
    if (mode === studyMode || studyModePending || isNavigationLocked) return;
    if (!availableStudyModes.includes(mode)) return;
    void setStudyMode(mode);
  };

  /** Roving focus so the group behaves like a real radiogroup on a keyboard. */
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !backward) return;
    event.preventDefault();
    const delta = forward ? 1 : -1;
    const next = (index + delta + ALL_STUDY_MODES.length) % ALL_STUDY_MODES.length;
    optionRefs.current[next]?.focus();
  };

  // Compact segmented control — one slim row instead of three stacked cards.
  const shortLabel = (mode: StudyMode) => STUDY_MODE_LABELS[mode].replace(/\s*Mode$/i, '');

  return (
    <div className={cn('neu-raised flex items-center gap-2 px-2.5 py-1.5', className)}>
      <span className="hidden sm:inline shrink-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        Mode
      </span>

      <div
        role="radiogroup"
        aria-label="Study mode"
        aria-busy={studyModePending}
        className="neu-inset grid flex-1 grid-cols-3 gap-1 rounded-xl p-1"
      >
        {ALL_STUDY_MODES.map((mode, index) => {
          const selected = mode === studyMode;
          const selectable = availableStudyModes.includes(mode);
          const missing = selectable ? [] : studyModeCoverage(mode, owned).missing;
          const lockReason = selectable
            ? undefined
            : `${STUDY_MODE_LABELS[mode]} needs ${missing.map(subjectLabel).join(' and ')}`;
          const blocked = !selectable || isNavigationLocked;

          return (
            <button
              key={mode}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={blocked || undefined}
              // Roving tabindex: only the active option is in the tab order.
              tabIndex={selected ? 0 : -1}
              disabled={studyModePending}
              // Subject list + any lock reason live in the tooltip to save space.
              title={
                isNavigationLocked && selectable
                  ? 'Finish your test before changing study mode'
                  : lockReason ?? STUDY_MODE_BLURB[mode]
              }
              onClick={() => select(mode)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-black tracking-tight transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                selected
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-foreground hover:bg-primary/5',
                blocked && !selected && 'opacity-40 cursor-not-allowed',
                studyModePending && 'cursor-wait',
              )}
            >
              {shortLabel(mode)}
              {selected ? (
                <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : !selectable ? (
                <Lock className="w-2.5 h-2.5 text-muted-foreground shrink-0" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      {studyModePending && (
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
      )}

      {/* Announced to screen readers on every change without stealing focus. */}
      <p aria-live="polite" className="sr-only">
        {STUDY_MODE_LABELS[studyMode]} selected. Showing {STUDY_MODE_BLURB[studyMode]}.
        {isNavigationLocked ? ' Finish your test before changing study mode.' : ''}
      </p>
    </div>
  );
}
