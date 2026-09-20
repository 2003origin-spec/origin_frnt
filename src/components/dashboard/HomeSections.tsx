'use client';

/**
 * The home sections introduced by the 2026-09-21 mockup.
 *
 * Kept out of Dashboard.tsx on purpose: that file is already ~900 lines and
 * carries the hero, the badge gallery and the progress panel. These are five
 * self-contained blocks with no shared state, so they compose rather than nest.
 *
 * Every destination here is a route that exists. Where the mockup names a
 * feature we have not built, the tile points at its Coming Soon screen rather
 * than being drawn and left dead — see V1/HOME_REDESIGN_PLAN.md §4.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Code,
  FileText,
  Share2,
  Sparkles,
  Target,
  Timer,
  Users,
  UsersRound,
} from 'lucide-react';

import { istDayStartMs, istEpochDay } from '@/lib/ist-day';
import type { ViewState } from '@/types';

type Navigate = (view: ViewState) => void;

/* ── Question of the day ─────────────────────────────────────────────────── */

/**
 * Counts down to the next IST midnight, which is when the daily challenge
 * rolls over (`ogcode_daily_*` is keyed on the IST date). Using the IST day
 * boundary rather than the device's midnight matters: a student in any other
 * timezone would otherwise be told the wrong thing.
 */
function useTimeToIstMidnight() {
  const [left, setLeft] = useState<{ h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = istDayStartMs(istEpochDay() + 1) - Date.now();
      const clamped = Math.max(0, ms);
      setLeft({
        h: Math.floor(clamped / 3_600_000),
        m: Math.floor((clamped % 3_600_000) / 60_000),
        s: Math.floor((clamped % 60_000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return left;
}

export function QuestionOfTheDayCard({ onOpen }: { onOpen: () => void }) {
  const left = useTimeToIstMidnight();

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles className="h-6 w-6" aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-widest text-primary">
          Question of the day
        </span>
        <span className="block truncate text-sm font-bold text-foreground">
          Can you solve today&apos;s quest?
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          A new challenge every day to keep you consistent.
        </span>
      </span>

      {/* Two shapes, because three 44px chips plus the icon and the chevron do
          not fit beside readable copy at 412px: a single compact clock on a
          phone, the mockup's labelled chips from sm up.
          suppressHydrationWarning — the value is clock-derived, so the server
          pass and the first client pass legitimately differ. */}
      {left ? (
        <>
          <span
            className="shrink-0 rounded-lg border border-border bg-background px-2 py-1 text-xs font-black tabular-nums text-foreground sm:hidden"
            suppressHydrationWarning
          >
            {String(left.h).padStart(2, '0')}:{String(left.m).padStart(2, '0')}:
            {String(left.s).padStart(2, '0')}
          </span>
          <span className="hidden shrink-0 items-center gap-1 sm:flex" suppressHydrationWarning>
            {([['hrs', left.h], ['mins', left.m], ['sec', left.s]] as const).map(([unit, value]) => (
              <span
                key={unit}
                className="flex w-11 flex-col items-center rounded-lg border border-border bg-background py-1"
              >
                <span className="text-sm font-black tabular-nums text-foreground">
                  {String(value).padStart(2, '0')}
                </span>
                <span className="text-[9px] font-medium uppercase text-muted-foreground">{unit}</span>
              </span>
            ))}
          </span>
        </>
      ) : null}

      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

/* ── Chat with Ori ───────────────────────────────────────────────────────── */

export function ChatWithOriCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3 text-left transition-colors hover:bg-surface-3"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background">
        <Image
          src="/ori2d/ori-nav.webp"
          alt=""
          aria-hidden
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-primary">
          Chat with <span className="text-foreground">Ori</span>
        </span>
        <span className="block text-xs leading-snug text-muted-foreground">
          Get instant answers, explanations and guidance.
        </span>
      </span>

      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <ArrowRight className="h-5 w-5" aria-hidden />
      </span>
    </button>
  );
}

/* ── Primary action grid ─────────────────────────────────────────────────── */

interface ActionTile {
  icon: LucideIcon;
  title: string;
  blurb: string;
  view: ViewState;
}

const ACTIONS: ActionTile[] = [
  { icon: Code, title: 'Practise Questions', blurb: 'Sharpen your concepts with OG Code.', view: 'ogcode' },
  { icon: FileText, title: 'Take a Test', blurb: 'Attempt chapter-wise and full tests.', view: 'test-list' },
  { icon: Target, title: 'Auto-generate DPPs', blurb: 'Personalised practice sets, just for you.', view: 'dpp' },
  { icon: BarChart3, title: 'Analyze Progress', blurb: 'Track your performance and weak topics.', view: 'graphs' },
];

export function ActionGrid({ onNavigate, onPrefetch }: { onNavigate: Navigate; onPrefetch?: Navigate }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ACTIONS.map(({ icon: Icon, title, blurb, view }) => (
        <button
          key={title}
          onClick={() => onNavigate(view)}
          onTouchStart={() => onPrefetch?.(view)}
          className="flex min-h-[7.5rem] flex-col items-start gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left transition-colors hover:bg-surface-3"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-sm font-bold leading-tight text-foreground">{title}</span>
          <span className="text-xs leading-snug text-muted-foreground">{blurb}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Popular tools ───────────────────────────────────────────────────────── */

interface ToolTile {
  icon: LucideIcon;
  title: string;
  blurb: string;
  view: ViewState;
}

// `studentSocial` defaults true in dev AND prod, so Social is listed
// unconditionally rather than threading a flag through the dashboard.
const TOOLS: ToolTile[] = [
  { icon: UsersRound, title: 'Rooms', blurb: 'Study together', view: 'study-rooms' },
  { icon: Target, title: 'Goals', blurb: 'Track & achieve', view: 'tasks-goals' },
  { icon: Users, title: 'Social', blurb: 'Find study buddies', view: 'social' },
  { icon: Timer, title: 'Focus Timer', blurb: 'Study without distractions', view: 'pomodoro' },
];

export function PopularTools({ onNavigate }: { onNavigate: Navigate }) {
  const tools = TOOLS;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title="Popular Tools" onSeeAll={() => onNavigate('explore')} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tools.map(({ icon: Icon, title, blurb, view }) => (
          <button
            key={title}
            onClick={() => onNavigate(view)}
            className="flex min-h-[6rem] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-surface-2 p-3 text-center transition-colors hover:bg-surface-3"
          >
            <Icon className="h-6 w-6 text-primary" aria-hidden />
            <span className="text-sm font-bold text-foreground">{title}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{blurb}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Important dates / Mindmaps ──────────────────────────────────────────── */

/**
 * Exam dates are a static table on purpose. There is no exam-calendar model,
 * and inventing a migration for four rows that change once a year would cost
 * more than it returns. Update the table when the boards publish.
 */
const EXAM_DATES: { name: string; iso: string }[] = [
  { name: 'JEE Mains 2027', iso: '2027-01-23' },
  { name: 'NEET UG 2027', iso: '2027-05-02' },
  { name: 'JEE Advanced 2027', iso: '2027-05-23' },
];

function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00+05:30`).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

export function ImportantDates({ onNavigate }: { onNavigate: Navigate }) {
  const next = EXAM_DATES.map((e) => ({ ...e, days: daysUntil(e.iso) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title="Important Dates / Mindmaps" onSeeAll={() => onNavigate('study-corner')} />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-2">
        {next ? (
          <div className="flex items-center gap-3 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">{next.name}</span>
              <span className="block text-xs text-muted-foreground" suppressHydrationWarning>
                {new Date(`${next.iso}T00:00:00+05:30`).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                · {next.days} days left
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              {next.days}d
            </span>
          </div>
        ) : null}

        <button
          onClick={() => onNavigate('mindmaps')}
          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-3"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Share2 className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">Mindmaps</span>
            <span className="block text-xs text-muted-foreground">Visual notes for better recall</span>
          </span>
          <span className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
            Coming soon
          </span>
        </button>
      </div>
    </section>
  );
}

/* ── shared ──────────────────────────────────────────────────────────────── */

function SectionHeading({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">{title}</h2>
      {onSeeAll ? (
        <button
          onClick={onSeeAll}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary"
        >
          See all <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
