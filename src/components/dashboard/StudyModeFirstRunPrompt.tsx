'use client';

/**
 * First-run Study Mode picker.
 *
 * Existing students default to PCMB (everything visible = pre-feature
 * behaviour), so nobody silently loses a subject when this ships. Adoption runs
 * through this card instead: it pre-selects the mode inferred from the student's
 * onboarding answers, and dismissing it leaves them on PCMB permanently.
 *
 * Shown at most once — `study_mode_prompted_at` is stamped on either choosing or
 * dismissing — and only to students with a genuine choice (≥2 fully-owned modes).
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md §3.4.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import {
  STUDY_MODE_BLURB,
  STUDY_MODE_LABELS,
  inferStudyModeFromProfile,
  type StudyMode,
} from '@/lib/study-mode';
import { cn } from '@/lib/utils';

export default function StudyModeFirstRunPrompt() {
  const {
    user,
    studyModeExplicit,
    studyModePrompted,
    studyModeAvailable,
    availableStudyModes,
    studyModePending,
    setStudyMode,
    dismissStudyModePrompt,
  } = useAuth();

  const [dismissing, setDismissing] = useState(false);

  const suggested = inferStudyModeFromProfile(user?.selectedCourse, user?.subjects);
  const [choice, setChoice] = useState<StudyMode | null>(null);

  if (!user || user.role !== 'student') return null;
  // Nothing to ask when they have already chosen, already been asked, or have no
  // real choice (a single-bundle owner is scoped by their entitlement anyway).
  if (studyModeExplicit || studyModePrompted || !studyModeAvailable) return null;
  if (availableStudyModes.length < 2) return null;

  const selected = choice ?? (suggested && availableStudyModes.includes(suggested) ? suggested : null);

  const confirm = async () => {
    if (!selected) return;
    await setStudyMode(selected);
  };

  const dismiss = async () => {
    setDismissing(true);
    await dismissStudyModePrompt();
  };

  if (dismissing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="neu-raised p-4 sm:p-5 relative"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now — keep showing all subjects"
        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-1 pr-8">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
          Pick your study mode
        </h3>
      </div>
      <p className="text-[11px] font-bold text-muted-foreground mb-3">
        Origin will show only the subjects you actually need. You can change this any time
        from your dashboard.
      </p>

      <div role="radiogroup" aria-label="Study mode" className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        {availableStudyModes.map((mode) => {
          const active = mode === selected;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChoice(mode)}
              className={cn(
                'text-left rounded-xl px-3.5 py-2.5 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                active ? 'neu-inset bg-primary/10 ring-2 ring-primary' : 'neu-raised hover:-translate-y-0.5',
              )}
            >
              <span
                className={cn(
                  'block text-sm font-black tracking-tight',
                  active ? 'text-primary' : 'text-foreground',
                )}
              >
                {STUDY_MODE_LABELS[mode]}
                {mode === suggested && (
                  <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    suggested
                  </span>
                )}
              </span>
              <span className="block text-[11px] font-bold text-muted-foreground mt-0.5">
                {STUDY_MODE_BLURB[mode]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={!selected || studyModePending}
          className={cn(
            'neu-raised px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all',
            selected && !studyModePending
              ? 'text-primary hover:-translate-y-0.5 hover:bg-primary/5'
              : 'text-muted-foreground opacity-60 cursor-not-allowed',
          )}
        >
          {studyModePending ? 'Saving…' : 'Use this mode'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="px-3 py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          Show me everything
        </button>
      </div>
    </motion.div>
  );
}
