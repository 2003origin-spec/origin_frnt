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

  return (
    <div className={cn('neu-raised p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Study Mode</h3>
          <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
            Origin shows only the subjects in the mode you pick.
          </p>
        </div>
        {studyModePending && (
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Saving
          </span>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Study mode"
        aria-busy={studyModePending}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2"
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
              // Roving tabindex: only the active option is in the tab order, so
              // Tab moves past the whole group and arrows move within it.
              tabIndex={selected ? 0 : -1}
              disabled={studyModePending}
              title={
                isNavigationLocked && selectable
                  ? 'Finish your test before changing study mode'
                  : lockReason
              }
              onClick={() => select(mode)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'relative text-left rounded-xl px-3.5 py-3 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                selected ? 'neu-inset bg-primary/10 ring-2 ring-primary' : 'neu-raised',
                !selected && !blocked && 'hover:-translate-y-0.5 hover:bg-primary/5',
                blocked && !selected && 'opacity-50 cursor-not-allowed',
                studyModePending && 'cursor-wait',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm font-black tracking-tight',
                    selected ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {STUDY_MODE_LABELS[mode]}
                </span>
                {selected ? (
                  <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                ) : !selectable ? (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                ) : null}
              </span>
              <span className="block text-[11px] font-bold text-muted-foreground mt-0.5">
                {STUDY_MODE_BLURB[mode]}
              </span>
              {lockReason && (
                <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-500 mt-1">
                  Needs {missing.map(subjectLabel).join(' and ')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isNavigationLocked && (
        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 mt-2.5">
          Finish your test before changing study mode.
        </p>
      )}

      {/* Announced to screen readers on every change without stealing focus. */}
      <p aria-live="polite" className="sr-only">
        {STUDY_MODE_LABELS[studyMode]} selected. Showing {STUDY_MODE_BLURB[studyMode]}.
      </p>
    </div>
  );
}
