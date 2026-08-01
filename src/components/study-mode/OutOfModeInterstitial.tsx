'use client';

/**
 * Shown when a student opens a question whose subject is outside their Study
 * Mode — a shared link, a stale bookmark, an old notification.
 *
 * Deliberately an explanation with an escape hatch rather than a 404: the
 * content exists and the student may well want it, they just need to switch (or
 * own) the right mode. Modes they cannot select render disabled with the
 * missing subjects named.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md §3.3.
 */

import { useRouter } from 'next/navigation';
import { Compass, Lock } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import {
  ALL_STUDY_MODES,
  STUDY_MODE_BLURB,
  STUDY_MODE_LABELS,
  isSubjectInMode,
  studyModeCoverage,
  type StudyMode,
} from '@/lib/study-mode';
import { getEntitledSubjects } from '@/lib/entitlements';
import { cn } from '@/lib/utils';

export default function OutOfModeInterstitial({
  subject,
  backHref = '/ogcode',
  backLabel = 'Back to OG Code',
}: {
  /** The blocked content's subject, if known — used to name it in the copy. */
  subject?: string | null;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const { user, studyMode, availableStudyModes, studyModePending, setStudyMode } = useAuth();

  const owned = getEntitledSubjects(user);
  const label = subject ? subject[0].toUpperCase() + subject.slice(1) : 'This question';

  // Only modes that would actually reveal the content are worth offering.
  const rescueModes = ALL_STUDY_MODES.filter(
    (mode) => mode !== studyMode && (!subject || isSubjectInMode(mode, subject)),
  );

  const switchTo = async (mode: StudyMode) => {
    const ok = await setStudyMode(mode);
    if (ok) router.refresh();
  };

  return (
    <div className="min-h-screen neu-surface flex items-center justify-center px-4 py-10">
      <div className="neu-raised max-w-md w-full p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Compass className="w-6 h-6 text-primary" />
        </div>

        <h1 className="text-lg font-black text-foreground mb-1.5">
          {label} is outside {STUDY_MODE_LABELS[studyMode]}
        </h1>
        <p className="text-xs font-bold text-muted-foreground mb-5">
          You&apos;re studying {STUDY_MODE_BLURB[studyMode]}. Switch modes to open this, or head
          back to your own set.
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {rescueModes.map((mode) => {
            const selectable = availableStudyModes.includes(mode);
            const missing = selectable ? [] : studyModeCoverage(mode, owned).missing;
            return (
              <button
                key={mode}
                type="button"
                disabled={!selectable || studyModePending}
                onClick={() => switchTo(mode)}
                className={cn(
                  'neu-raised rounded-xl px-4 py-3 text-left transition-all',
                  selectable && !studyModePending
                    ? 'hover:-translate-y-0.5 hover:bg-primary/5'
                    : 'opacity-50 cursor-not-allowed',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-foreground">
                    Switch to {STUDY_MODE_LABELS[mode]}
                  </span>
                  {!selectable && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </span>
                <span className="block text-[11px] font-bold text-muted-foreground mt-0.5">
                  {selectable
                    ? STUDY_MODE_BLURB[mode]
                    : `Needs ${missing.map((s) => s[0].toUpperCase() + s.slice(1)).join(' and ')}`}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="w-full px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {backLabel}
        </button>
      </div>
    </div>
  );
}
