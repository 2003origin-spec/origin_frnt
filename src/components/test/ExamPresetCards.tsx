'use client';

/**
 * Full-length exam mock presets (JEE Main / JEE Advanced / NEET) — the one-click
 * entry point at the top of the Test Builder.
 *
 * The `locked` state rendered here is PRESENTATION ONLY. The entitlement
 * decision is made server-side in `createFullLengthTestAction`, which re-derives
 * the student's scope and refuses a preset it does not cover (D2). Hiding the
 * button is a courtesy, never the gate.
 *
 * Plan: V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §4, D2.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, Clock, FileText, Loader2, Lock, Play, Target, Trophy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExamPresetId } from '@/lib/exam-blueprints';

const SUBJECT_TITLE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Mirrors `PresetAvailability` from the server, kept structural for the client bundle. */
export type ExamPresetCard = {
  preset: ExamPresetId;
  label: string;
  blurb: string;
  subjects: string[];
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  sections: Array<{ label: string; count: number; marking: string }>;
  locked: boolean;
  lockReason: { kind: string; missing: string[]; message: string } | null;
};

const ACCENT: Record<ExamPresetId, string> = {
  'jee-main': 'from-sky-500/15 to-sky-500/0 text-sky-600 dark:text-sky-400',
  'jee-advanced': 'from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-400',
  neet: 'from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400',
};

export default function ExamPresetCards({
  presets,
  onGenerate,
}: {
  presets: ExamPresetCard[];
  /** Creates the mock server-side and starts it. Rejects with a user-safe message. */
  onGenerate: (preset: ExamPresetId) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ExamPresetId | null>(null);
  const [expanded, setExpanded] = useState<ExamPresetId | null>(null);
  const [error, setError] = useState('');
  // The locked preset whose "unlock" popup is open (null = closed).
  const [lockedPreset, setLockedPreset] = useState<ExamPresetCard | null>(null);

  if (presets.length === 0) return null;

  // Subjects still needed to unlock a preset — the server-derived list when
  // present, else every subject the preset requires.
  const missingSubjects = (p: ExamPresetCard) =>
    (p.lockReason?.missing?.length ? p.lockReason.missing : p.subjects).map((s) => s.toLowerCase());

  const handleGenerate = async (preset: ExamPresetId) => {
    setPending(preset);
    setError('');
    try {
      await onGenerate(preset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build that mock test. Please try again.');
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="mb-10">
      <div className="mb-6">
        <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tighter text-foreground">
          Full-Length Mock Tests
        </h2>
        <p className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Real exam pattern · real marking · sectional paper
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-xs font-bold text-rose-500">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
        {presets.map((preset) => {
          const isPending = pending === preset.preset;
          const isOpen = expanded === preset.preset;
          // Any generation in flight disables the others: two papers building at
          // once would race for the same questions and burn the student's time.
          const disabled = preset.locked || pending !== null;

          return (
            <Card
              key={preset.preset}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-[32px] border-0 neu-raised p-6 transition-all',
                preset.locked && 'opacity-70',
              )}
            >
              <div
                className={cn('pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b', ACCENT[preset.preset])}
                aria-hidden
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-black uppercase tracking-tighter text-foreground">{preset.label}</h3>
                  {preset.locked && (
                    <Badge className="shrink-0 rounded-full border-0 bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                      <Lock className="mr-1 h-3 w-3" />
                      Locked
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-muted-foreground">{preset.blurb}</p>

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    {preset.totalQuestions}
                    <span className="font-medium text-muted-foreground">Qs</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-foreground">
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                    {preset.totalMarks}
                    <span className="font-medium text-muted-foreground">marks</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {preset.durationMinutes}
                    <span className="font-medium text-muted-foreground">min</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : preset.preset)}
                  aria-expanded={isOpen}
                  className="mt-4 flex w-full items-center justify-between rounded-xl border border-border/40 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    {preset.sections.length} sections
                  </span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                  <ul className="mt-2 space-y-1 rounded-xl bg-muted/40 p-3">
                    {preset.sections.map((section) => (
                      <li key={section.label} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate font-semibold text-foreground/80">{section.label}</span>
                        <span className="shrink-0 font-bold text-muted-foreground">
                          {section.count} · {section.marking}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="relative mt-6 flex-1 flex flex-col justify-end">
                {preset.locked && preset.lockReason ? (
                  <p className="mb-3 text-[11px] font-bold leading-relaxed text-amber-600 dark:text-amber-400">
                    {preset.lockReason.message}
                  </p>
                ) : null}
                <Button
                  onClick={() => (preset.locked ? setLockedPreset(preset) : handleGenerate(preset.preset))}
                  // Locked cards stay clickable (to open the unlock popup); only a
                  // build in flight disables everything.
                  disabled={pending !== null}
                  className="h-12 w-full rounded-2xl bg-primary text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building paper…
                    </span>
                  ) : preset.locked ? (
                    <span className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5" />
                      Locked
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Start {preset.label} Mock
                    </span>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Unlock popup for a locked preset. */}
      <Dialog open={lockedPreset !== null} onOpenChange={(open) => !open && setLockedPreset(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          {lockedPreset && (() => {
            const missing = missingSubjects(lockedPreset);
            const required = lockedPreset.subjects.map((s) => s.toLowerCase());
            const missingSet = new Set(missing);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                    <Lock className="h-5 w-5 text-amber-500" />
                    Unlock {lockedPreset.label}
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium text-muted-foreground">
                    The {lockedPreset.label} mock needs all {required.length} subjects. Go premium on the missing one{missing.length === 1 ? '' : 's'} to unlock it.
                  </DialogDescription>
                </DialogHeader>
                <ul className="my-2 space-y-2">
                  {required.map((s) => {
                    const isMissing = missingSet.has(s);
                    return (
                      <li
                        key={s}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-bold',
                          isMissing ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        <span>{SUBJECT_TITLE(s)}</span>
                        {isMissing ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"><Lock className="h-3 w-3" /> Locked</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"><Check className="h-3 w-3" /> Owned</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Button
                  onClick={() => router.push(`/premium?subject=${missing[0] ?? ''}`)}
                  className="h-12 w-full rounded-2xl bg-primary text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20"
                >
                  Go Premium to unlock {lockedPreset.label}
                </Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </section>
  );
}
