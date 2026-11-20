'use client';

/**
 * The landing page's screens 2–8 in the app's "Orbit" look (plan: V1/GLASSY_LANDING_PLAN.md).
 * Every number on these screens is read live or comes from the repo; nothing is invented.
 * Ask Ori anything on this page → the hero's doubt box (`askInHero`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, BookOpen, MousePointerClick, Trophy, UserRoundCheck, Users } from 'lucide-react';

import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import Books3D from './Books3D';
import { webglSupported } from './webgl-support';

/** Focus the hero's doubt box (and pre-fill it), from anywhere on the page. */
export function askInHero(question?: string) {
  const box = document.getElementById('ask');
  box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.dispatchEvent(new CustomEvent('origin:focus-doubt-box', { detail: { question } }));
}

export function PhoneFrame({
  src,
  alt,
  className = '',
  crop = false,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Show only the top of the screen (the hero), fading into the page. */
  crop?: boolean;
  priority?: boolean;
}) {
  return (
    <div className={`landing-phone ${crop ? 'landing-phone--crop' : ''} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={540}
        height={1200}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className="landing-phone__screen"
      />
    </div>
  );
}

const Phone3DScene = dynamic(() => import('./Phone3DScene'), { ssr: false });

/**
 * The app's screens on a phone: a real 3D phone (three.js) where WebGL works, the flat
 * frame otherwise (and on the server, so the first paint already shows the phone).
 */
export function PhoneShowcase({
  screens,
  alts,
  active = 0,
  crop = false,
  priority = false,
  lazy = false,
  className = '',
  stageClassName = '',
}: {
  screens: string[];
  alts: string[];
  active?: number;
  crop?: boolean;
  /** Load the flat fallback's screenshot at once (above the fold). */
  priority?: boolean;
  /**
   * Draw the 3D phone only while it is near the screen, and free it after. Browsers allow
   * only a few 3D scenes at once, so pages with many phones (the story on phones, the
   * download section) use this. A phone hidden by CSS (display: none) is never drawn.
   */
  lazy?: boolean;
  className?: string;
  /** Size of the 3D stage. */
  stageClassName?: string;
}) {
  const [three, setThree] = useState(false);
  const [near, setNear] = useState(!lazy);
  const boxRef = useRef<HTMLDivElement>(null);
  const onFail = useCallback(() => setThree(false), []);
  useEffect(() => setThree(webglSupported()), []);
  useEffect(() => {
    if (!lazy || !three || !boxRef.current) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '400px 0px' });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [lazy, three]);
  if (three) {
    return (
      <div ref={boxRef} className={`relative ${crop ? 'landing-phone3d--crop' : ''} ${className}`} role="img" aria-label={alts[active]}>
        {near ? (
          <Phone3DScene screens={screens} active={active} crop={crop} entrance={!lazy} onFail={onFail} className={stageClassName} />
        ) : (
          <div className={stageClassName} />
        )}
      </div>
    );
  }
  return <PhoneFrame src={screens[active]} alt={alts[active]} crop={crop} priority={priority || crop} className={className} />;
}

/* ── Screen 2: the product, big ─────────────────────────────────────────── */

const PRODUCT_QUESTION = 'Why does ethanol boil at a higher temperature than dimethyl ether?';
const PRODUCT_ANSWER = [
  '**Idea:** both have the formula C₂H₆O, so the difference is in how their molecules hold on to each other.',
  '',
  '1. Ethanol has an O–H group, so its molecules form **hydrogen bonds** with each other.',
  '2. Dimethyl ether has no O–H group. Its molecules attract only through weaker dipole forces.',
  '3. Breaking hydrogen bonds takes more energy, so ethanol has to be heated more before it boils.',
  '',
  '**Answer:** ethanol boils at about 78 °C, dimethyl ether at about −24 °C.',
].join('\n');

export function ProductWindow() {
  return (
    <section id="demo" data-mascot-state="answering" data-mascot-side="left" className="landing-screen relative z-10">
      <div className="landing-wrap">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="landing-h2">Every doubt, solved step by step</h2>
          <p className="landing-lead mt-4">
            Ori starts with the idea, then walks through each step to the answer. Stuck on one step? Ask about just that step.
          </p>
        </div>

        <div className="landing-window mx-auto max-w-4xl">
          <div className="landing-window__bar" aria-hidden="true">
            <span />
            <span />
            <span />
            <p>Ori · Chemistry</p>
          </div>
          <div className="flex flex-col gap-5 p-5 sm:p-8">
            <p className="landing-bubble ml-auto max-w-[85%] text-[15px] font-semibold">{PRODUCT_QUESTION}</p>
            <div className="flex gap-3 sm:gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ori2d/ori-thinking.png" alt="" loading="lazy" className="mt-1 h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12" />
              <div className="min-w-0 flex-1">
                <FormattedMessage content={PRODUCT_ANSWER} className="text-[15px] leading-relaxed text-foreground sm:text-base" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pl-16">
              {['Explain hydrogen bonding simply', 'Give me a similar question'].map((q) => (
                <button key={q} type="button" onClick={() => askInHero(q)} className="landing-chip min-h-11 rounded-full px-4 text-sm font-semibold">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Screen 3: a day with Origin ─────────────────────────────────────────── */

const DAY_STEPS = [
  {
    title: 'Practise the chapter you are on',
    body: 'Pick a chapter and solve past-year questions. Your progress shows chapter by chapter.',
    shot: '/landing/app/04-practice1.webp',
    alt: 'Origin app practice screen with chapters and a question of the day',
  },
  {
    title: 'Stuck at 2 AM? Ask Ori',
    body: 'Type or say the question. Ori replies with the steps, not just the answer, and remembers what you were studying.',
    shot: '/landing/app/08-ori.webp',
    alt: 'Origin app chat with Ori explaining rolling motion',
  },
  {
    title: 'See why the answer is right',
    body: 'Every practice question shows the working. Ask Ori to explain it another way if it still does not click.',
    shot: '/landing/app/07-deck2.webp',
    alt: 'Origin app question with the correct option marked and the worked solution',
  },
] as const;

// Built once: a new array on every render would rebuild the 3D phone (and replay its
// entrance) each time the active step changes, instead of just swapping the screen.
const DAY_SHOTS = DAY_STEPS.map((s) => s.shot);
const DAY_ALTS = DAY_STEPS.map((s) => s.alt);
const STEP_SHOTS = DAY_STEPS.map((s) => [s.shot]);
const STEP_ALTS = DAY_STEPS.map((s) => [s.alt]);

export function DayWithOrigin({ rankPredictorEnabled }: { rankPredictorEnabled: boolean }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const els = stepRefs.current.filter(Boolean) as HTMLLIElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      // The step whose middle crosses the middle band of the screen is the active one.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="how-it-works" data-mascot-state="thinking" data-mascot-side="none" className="landing-screen relative z-10">
      <div className="landing-wrap">
        <div className="mb-10 max-w-2xl">
          <h2 className="landing-h2">A day with Origin</h2>
          <p className="landing-lead mt-4">From the first practice question in the morning to the doubt that keeps you up at night.</p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          <ol className="flex flex-col">
            {DAY_STEPS.map((s, i) => (
              <li
                key={s.title}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                data-step={i}
                className={`landing-step lg:min-h-[62vh] ${active === i ? 'is-active' : ''}`}
              >
                <span className="landing-step__dot" aria-hidden="true" />
                <h3 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{s.title}</h3>
                <p className="landing-lead mt-3 max-w-md">{s.body}</p>
                {/* Phones and tablets: each step carries its own screen */}
                <div className="landing-step__phone mt-6 lg:hidden">
                  <PhoneShowcase
                    screens={STEP_SHOTS[i]}
                    alts={STEP_ALTS[i]}
                    lazy
                    className="landing-phone-fit"
                    stageClassName="landing-phone-stage"
                  />
                </div>
              </li>
            ))}
            <li className="landing-step is-last">
              <span className="landing-step__dot" aria-hidden="true" />
              <h3 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">Know where you stand</h3>
              <p className="landing-lead mt-3 max-w-md">
                {rankPredictorEnabled
                  ? 'Type your marks into the free rank predictor and see the rank range past years put you in.'
                  : 'Mock tests show your score, the chapters costing you marks and where to practise next.'}
              </p>
              {rankPredictorEnabled ? (
                <a href="#rank-predictor" className="landing-link mt-4 inline-flex min-h-11 items-center gap-2 font-semibold">
                  Try the rank predictor <ArrowRight aria-hidden className="h-4 w-4" />
                </a>
              ) : null}
            </li>
          </ol>

          {/* Desktop: one phone stays pinned while the steps scroll past it; its screen changes */}
          <div className="hidden lg:block">
            <div className="sticky top-[12vh]">
              <PhoneShowcase
                screens={DAY_SHOTS}
                alts={DAY_ALTS}
                lazy
                active={active}
                stageClassName="h-[76vh] max-h-[720px] w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Screen 5: only on Origin (flag-gated) ──────────────────────────────── */

export type OnlyOnOriginFlags = { originNow: boolean; contest: boolean; notes: boolean };

export function OnlyOnOrigin({ flags, contestSlot }: { flags: OnlyOnOriginFlags; contestSlot?: React.ReactNode }) {
  // Live features only: a row shows only while its feature is switched on.
  const rows = [
    flags.originNow && {
      icon: UserRoundCheck,
      tone: 'mint',
      title: 'A real person when Ori is not enough',
      body: 'Origin NOW sends your doubt to a human solver who answers it for you.',
    },
    flags.contest && {
      icon: Trophy,
      tone: 'nova',
      title: 'A weekly test with everyone',
      body: 'Take the same contest as every other student that week and see where you place.',
    },
    {
      icon: MousePointerClick,
      tone: 'ori',
      title: 'Ask about any line you select',
      body: 'Select a sentence in a question or a solution, and Ori explains just that part.',
    },
    flags.notes && {
      icon: BookOpen,
      tone: 'pulse',
      title: 'Notes for every chapter',
      body: 'Chapter-wise notes to revise from, plus your own notes, PDFs and photos in one place.',
    },
    {
      icon: Users,
      tone: 'sky',
      title: 'Tests with your friends',
      body: 'Share a room code, take the same test together and watch the live leaderboard.',
    },
  ].filter(Boolean) as { icon: typeof Users; tone: string; title: string; body: string }[];

  return (
    <section id="features" data-mascot-state="curious" data-mascot-side="none" className="landing-screen relative z-10">
      <div className="landing-wrap grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <h2 className="landing-h2">More than an answer bot</h2>
          <p className="landing-lead mt-4 max-w-md">
            Origin is built around how JEE and NEET students actually study: alone at night, with friends before a test, and with a teacher when it matters.
          </p>
        </div>
        <ul className="landing-rows">
          {rows.slice(0, 4).map(({ icon: Icon, tone, title, body }) => (
            <li key={title} className="landing-row">
              <span className={`landing-row__icon landing-tone--${tone}`} aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-heading text-xl font-bold text-foreground">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-[var(--lg-muted-foreground)]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        {contestSlot ? <div className="lg:col-span-2">{contestSlot}</div> : null}
      </div>
    </section>
  );
}

/* ── Screen 6: why trust it ─────────────────────────────────────────────── */


const COLLEGES = [
  { src: '/IIT-NIT-IIIT/IIT-Madras.png', alt: 'IIT Madras' },
  { src: '/IIT-NIT-IIIT/NIT-Agartala.png', alt: 'NIT Agartala' },
  { src: '/IIT-NIT-IIIT/IIIT-Manipur.png', alt: 'IIIT Manipur' },
  { src: '/IIT-NIT-IIIT/sharada-university.png', alt: 'Sharda University' },
];

const nf = new Intl.NumberFormat('en-IN');

export function WhyTrust() {
  const [solved, setSolved] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    // ?first=1 counts this page load as one site visit (the old live counter did this; it is gone).
    fetch('/api/public/live-stats?first=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { questionsSolved?: unknown } | null) => {
        if (alive && s && typeof s.questionsSolved === 'number' && s.questionsSolved > 0) setSolved(s.questionsSolved);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="knowledge-base" data-mascot-state="success" data-mascot-side="none" className="landing-screen relative z-10">
      <div className="landing-wrap">
        <div className="mb-10 max-w-2xl">
          <h2 className="landing-h2">Built on the books you already study</h2>
          <p className="landing-lead mt-4">
            Ori&apos;s answers come from NCERT textbooks and the reference books JEE and NEET students rely on, including HC Verma, Irodov and NCERT Exemplar.
          </p>
        </div>

        <Books3D />

        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h3 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">Made by students who sat these exams</h3>
            <p className="landing-lead mt-3 max-w-lg">
              Origin is built by a team from IIT Madras, NIT Agartala, IIIT Manipur and Sharda University
              {solved ? (
                <>
                  , and students on Origin have answered <strong className="text-foreground">{nf.format(solved)} questions</strong> right on their first try.
                </>
              ) : (
                '.'
              )}
            </p>
            <Link href="/founders" className="landing-link mt-4 inline-flex min-h-11 items-center gap-2 font-semibold">
              Meet the founders <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
          <ul className="flex flex-wrap items-center gap-3 sm:gap-4" aria-label="Founders' colleges">
            {COLLEGES.map((c) => (
              <li key={c.alt} className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.src} alt={c.alt} loading="lazy" className="h-14 w-auto object-contain sm:h-20" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Screen 7: price ────────────────────────────────────────────────────── */

type PricingSnapshot = {
  subjects?: { subject: string; amountMinor: number }[];
  bundle?: { amountMinor: number; subjects?: string[] } | null;
};

/** The default per-subject price (₹499 a month), the same fallback /premium uses. */
const DEFAULT_SUBJECT_MINOR = 49_900;

export function cheapestSubjectMinor(snapshot: PricingSnapshot | null): number {
  const amounts = (snapshot?.subjects ?? [])
    .map((s) => s.amountMinor)
    .filter((n) => Number.isFinite(n) && n > 0);
  return amounts.length ? Math.min(...amounts) : DEFAULT_SUBJECT_MINOR;
}

const rupees = (minor: number) => nf.format(Math.round(minor / 100));

export function PriceSection({ onSignUp }: { onSignUp: () => void }) {
  const [pricing, setPricing] = useState<PricingSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/pricing', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: PricingSnapshot | null) => {
        if (alive) setPricing(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const subject = cheapestSubjectMinor(pricing);
  const bundle = pricing?.bundle && pricing.bundle.amountMinor > 0 ? pricing.bundle.amountMinor : null;

  return (
    <section id="pricing" data-mascot-state="thinking" data-mascot-side="right" className="landing-screen relative z-10">
      <div className="landing-wrap">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="landing-h2">Plans and prices</h2>
          <p className="landing-lead mt-4">Start free. Pay only for the subjects you want more of, month by month.</p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="landing-surface rounded-3xl p-6 sm:p-8">
            <h3 className="font-heading text-2xl font-bold text-foreground">Free account</h3>
            <p className="mt-2 font-heading text-4xl font-extrabold text-foreground">₹0</p>
            <ul className="landing-ticks mt-6">
              <li>Ori&apos;s step-by-step answers every day</li>
              <li>Chapter-wise tests and practice questions</li>
              <li>A weakness report after your tests</li>
              <li>Formula sheets and weekly practice sets</li>
            </ul>
            <button type="button" onClick={onSignUp} className="landing-ghost-btn mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold">
              Create a free account
            </button>
          </div>

          <div className="landing-surface landing-surface--accent rounded-3xl p-6 sm:p-8">
            <h3 className="font-heading text-2xl font-bold text-foreground">Premium</h3>
            <p className="mt-2 font-heading text-4xl font-extrabold text-foreground">
              ₹{rupees(subject)}
              <span className="text-base font-semibold text-[var(--lg-muted-foreground)]"> a month, per subject</span>
            </p>
            <ul className="landing-ticks mt-6">
              <li>Everything unlimited in the subjects you choose</li>
              <li>Physics, Chemistry, Maths and Biology, one at a time or together</li>
              {bundle ? <li>All subjects together for ₹{rupees(bundle)} a month</li> : null}
            </ul>
            <Link href="/premium" className="landing-primary-btn mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold">
              Compare plans <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-4xl flex-col gap-3 text-[15px] leading-relaxed text-[var(--lg-muted-foreground)] sm:flex-row sm:justify-between">
          <p className="max-w-md">
            <strong className="text-foreground">For parents:</strong> students under 18 need a parent or guardian to pay and give consent. No ads, and no selling of student data.
          </p>
          <p>
            Teaching a batch?{' '}
            <Link href="/role-selection" className="landing-link font-semibold">
              Set up Origin for your students
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Screen 8: questions + close ────────────────────────────────────────── */

// Answers taken from /faq (src/app/faq/page.tsx), shortened.
const FAQ = [
  {
    q: 'What is O3 Origin?',
    a: 'An AI-powered study platform for JEE and NEET. It finds where you are going wrong and why, then helps you fix it.',
  },
  {
    q: 'Can I use Origin for free?',
    a: 'Yes. The free account includes AI doubt solving every day, chapter-wise tests, a basic weakness report, formula sheets and weekly practice sets. Paid plans unlock unlimited use.',
  },
  {
    q: 'Is it only for JEE and NEET?',
    a: 'JEE Main, JEE Advanced and NEET come first. Class 9 and 10 foundation courses are covered too.',
  },
  {
    q: 'Who built O3 Origin?',
    a: 'SUPERGOAT Technologies Private Limited, a student-founded startup from Agartala, Tripura, started by Dipraj Biswas (NIT Agartala) and Ayush Pal (IIT Madras).',
  },
  {
    q: 'Is Origin safe for my child?',
    a: 'Yes. Origin is built for students: no advertisements, no sharing of a child’s data for commercial purposes, and only educational content.',
  },
  {
    q: 'Can my child pay for a plan alone?',
    a: 'No. Students under 18 cannot pay on their own; a parent or guardian makes every purchase.',
  },
];

export function QuestionsAndClose({ appSlot }: { appSlot?: React.ReactNode }) {
  return (
    <section id="faq" data-mascot-state="success" data-mascot-side="none" className="landing-screen relative z-10">
      <div className="landing-wrap grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="flex flex-col items-start">
          <h2 className="landing-h2">Your first doubt is free</h2>
          <p className="landing-lead mt-4 max-w-md">Ask Ori now, right on this page. No account, no card.</p>
          <button
            type="button"
            onClick={() => askInHero()}
            className="landing-primary-btn mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-bold"
          >
            Ask a doubt free <ArrowRight aria-hidden className="h-4 w-4" />
          </button>
          {appSlot ? <div className="mt-4">{appSlot}</div> : null}
        </div>

        <div>
          <h3 className="sr-only">Common questions</h3>
          <div className="landing-faq">
            {FAQ.map((f) => (
              <details key={f.q} className="landing-faq__item">
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3 font-heading text-lg font-bold text-foreground">
                  {f.q}
                  <span className="landing-faq__sign" aria-hidden="true" />
                </summary>
                <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[var(--lg-muted-foreground)]">{f.a}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className="landing-link mt-4 inline-flex min-h-11 items-center gap-2 font-semibold">
            Read all questions <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
