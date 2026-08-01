'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { studyModeSubjects } from '@/lib/study-mode';

const CLASS_OPTIONS = [11, 12] as const;
// The exam picker was removed from the student builder and the study-room test
// config: Study Mode already expresses which exam the student is preparing for,
// so asking a second time was redundant and could directly contradict it.
// `exams` remains in TestConfigValue and is sent empty (= all exams), which
// keeps the payload shape and every server-side caller unchanged.
const SUBJECT_LABELS: Record<string, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};
const QUESTION_COUNT_OPTIONS = [10, 20, 30, 40, 50] as const;

export type TestConfigValue = {
  subjects: string[];
  chapters: string[];
  classLevels: number[];
  exams: string[];
  question_count: number;
};

export const EMPTY_TEST_CONFIG: TestConfigValue = {
  subjects: [],
  chapters: [],
  classLevels: [],
  exams: [],
  question_count: 10,
};

function ChipMultiSelect<T extends string | number>({
  options,
  selected,
  onToggle,
  emptyLabel,
}: {
  options: readonly { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={cn(
              'h-10 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all border',
              active
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                : 'bg-background border-border/40 text-foreground hover:border-primary/40',
            )}
          >
            {opt.label}
          </button>
        );
      })}
      {selected.length === 0 && (
        <span className="self-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{emptyLabel}</span>
      )}
    </div>
  );
}

/**
 * Shared multi-select test configuration (Class · Exam · Subject · Chapter ·
 * Question count) used by the Test Builder and the study-room "Configure Test"
 * drawer so both offer identical options. Empty selections mean "any / all".
 */
export default function TestConfigFields({
  value,
  onChange,
}: {
  value: TestConfigValue;
  onChange: (next: TestConfigValue) => void;
}) {
  // Only the subjects of the student's Study Mode are offered. The server
  // clamps the request as well (createCustomTest) — this just keeps the UI from
  // showing a chip that would silently return nothing.
  const { studyMode } = useAuth();
  const subjectOptions = useMemo(
    () => studyModeSubjects(studyMode).map((s) => ({ value: s as string, label: SUBJECT_LABELS[s] })),
    [studyMode],
  );

  const [facetChapters, setFacetChapters] = useState<string[]>([]);
  const [facetChaptersLoading, setFacetChaptersLoading] = useState(false);
  const [chapterDropdownOpen, setChapterDropdownOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');
  const chapterFacetReq = useRef(0);
  // Always read the LATEST value/onChange inside the async facet callback — the
  // closure captured at effect time is stale, and using it there would clobber
  // later selections (e.g. reset multi-subject back to a one-subject snapshot).
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  // A mode switch can strand an already-selected subject (picked Biology, then
  // switched to JEE). The server clamps it anyway, but leaving the chip lit
  // would show a filter that silently returns nothing. Prune on change only —
  // guarded by the length check so this never loops.
  useEffect(() => {
    const allowed = new Set(subjectOptions.map((option) => option.value));
    const current = valueRef.current;
    const kept = current.subjects.filter((subject) => allowed.has(subject));
    if (kept.length !== current.subjects.length) {
      onChangeRef.current({ ...current, subjects: kept, chapters: [] });
    }
  }, [subjectOptions]);

  const labelCls = 'text-[10px] uppercase font-black tracking-widest text-muted-foreground';

  // Fetch the available chapters whenever the subject/class/exam scope changes,
  // and prune any selected chapters that fall out of the new scope.
  useEffect(() => {
    const req = ++chapterFacetReq.current;
    setFacetChaptersLoading(true);
    const qs = new URLSearchParams();
    qs.set('level', 'chapter');
    value.classLevels.forEach((c) => qs.append('classes', String(c)));
    value.exams.forEach((e) => qs.append('occurrences', e));
    value.subjects.forEach((s) => qs.append('subjects', s));

    apiCall(`/assessments/ogcode/facets?${qs.toString()}`)
      .then((data) => {
        if (req !== chapterFacetReq.current) return;
        const values = Array.isArray(data) ? (data as string[]) : [];
        setFacetChapters(values);
        // Prune against the LATEST value so we never revert other selections.
        const latest = valueRef.current;
        const pruned = latest.chapters.filter((c) => values.includes(c));
        if (pruned.length !== latest.chapters.length) onChangeRef.current({ ...latest, chapters: pruned });
      })
      .catch(() => {
        if (req === chapterFacetReq.current) setFacetChapters([]);
      })
      .finally(() => {
        if (req === chapterFacetReq.current) setFacetChaptersLoading(false);
      });
    // Refetch only when the scope inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.subjects, value.classLevels, value.exams]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5">
        <div className="space-y-2.5">
          <span className={labelCls}>Class</span>
          <ChipMultiSelect
            options={CLASS_OPTIONS.map((c) => ({ value: c, label: `Class ${c}` }))}
            selected={value.classLevels}
            emptyLabel="All classes"
            onToggle={(c) =>
              onChange({
                ...value,
                classLevels: value.classLevels.includes(c) ? value.classLevels.filter((x) => x !== c) : [...value.classLevels, c],
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2.5">
        <span className={labelCls}>Subject</span>
        <ChipMultiSelect
          options={subjectOptions}
          selected={value.subjects}
          emptyLabel="All subjects (mixed)"
          onToggle={(s) =>
            onChange({
              ...value,
              subjects: value.subjects.includes(s) ? value.subjects.filter((x) => x !== s) : [...value.subjects, s],
              chapters: [], // changing subjects invalidates chapter selection
            })
          }
        />
      </div>

      <div className="space-y-2.5 relative">
        <span className={labelCls}>Chapter (Optional)</span>
        <button
          type="button"
          disabled={value.subjects.length === 0 || facetChaptersLoading}
          onClick={() => {
            setChapterDropdownOpen((o) => !o);
            setChapterSearch('');
          }}
          className="w-full h-12 px-4 flex items-center justify-between gap-2 rounded-2xl bg-background border border-border/40 text-foreground font-black text-sm outline-none focus:border-primary transition-all disabled:opacity-50 text-left"
        >
          <span className="truncate">
            {value.subjects.length === 0
              ? 'Pick a subject first'
              : facetChaptersLoading
                ? 'Loading chapters…'
                : value.chapters.length === 0
                  ? 'Any Chapter'
                  : `${value.chapters.length} chapter${value.chapters.length === 1 ? '' : 's'} selected`}
          </span>
          <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform', chapterDropdownOpen && 'rotate-180')} />
        </button>
        {chapterDropdownOpen && value.subjects.length > 0 && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setChapterDropdownOpen(false)} />
            <div className="absolute left-0 right-0 z-50 mt-2 max-h-[360px] flex flex-col rounded-2xl border border-border/40 bg-background shadow-xl overflow-hidden">
              <div className="p-2 border-b border-border/40 shrink-0">
                <input
                  type="text"
                  placeholder="Search chapters…"
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                  className="w-full bg-muted/40 border border-border/40 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary/50"
                />
              </div>
              <div className="overflow-y-auto p-2 flex-1 space-y-1">
                {(() => {
                  const filtered = facetChapters.filter((ch) => ch.toLowerCase().includes(chapterSearch.toLowerCase()));
                  if (filtered.length === 0) {
                    return <div className="p-3 text-center text-[11px] italic text-muted-foreground">No chapters found</div>;
                  }
                  const allSelected = filtered.every((ch) => value.chapters.includes(ch));
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...value,
                            chapters: allSelected
                              ? value.chapters.filter((c) => !filtered.includes(c))
                              : [...new Set([...value.chapters, ...filtered])],
                          })
                        }
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-black text-primary hover:bg-primary/5 border-b border-border/20 mb-1 text-left"
                      >
                        <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', allSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                          {allSelected && <Check className="w-3 h-3 text-white" />}
                        </span>
                        Select All
                      </button>
                      {filtered.map((ch) => {
                        const active = value.chapters.includes(ch);
                        return (
                          <button
                            key={ch}
                            type="button"
                            onClick={() =>
                              onChange({
                                ...value,
                                chapters: active ? value.chapters.filter((c) => c !== ch) : [...value.chapters, ch],
                              })
                            }
                            className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold text-left hover:bg-primary/5', active ? 'text-primary bg-primary/5' : 'text-foreground/80')}
                          >
                            <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', active ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                              {active && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <span className="line-clamp-2 leading-tight">{ch}</span>
                          </button>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2.5">
        <span className={labelCls}>Questions</span>
        <div className="flex flex-wrap gap-2">
          {QUESTION_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onChange({ ...value, question_count: count })}
              className={cn(
                'h-10 w-14 rounded-xl font-black text-sm transition-all border',
                value.question_count === count
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                  : 'bg-background border-border/40 text-foreground hover:border-primary/40',
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
