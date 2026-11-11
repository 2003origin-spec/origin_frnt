import Link from 'next/link';
import { ArrowLeft, Check, LogIn, UserPlus } from 'lucide-react';

import { FaqList } from '@/components/seo/FaqList';
import { COUNSELLING_DISCLAIMER, OFFICIAL_LINKS } from '@/lib/counselling/format';
import { COLLEGE_FINDER_FAQ, EXAM_PAGE_LIST } from '@/lib/seo/rank-predictor-seo';

import { COLLEGES_LOGIN_HREF, COLLEGES_SIGNUP_HREF } from '@/sections/RankPredictor/login-links';

import { BandChip } from './ResultRow';
import TrackedAuthLink from './TrackedAuthLink';


const fieldFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Logged-out view of /rank-predictor/colleges (plan §11, Q9): what the finder
 * does, one clearly marked example, and "Create a free account / Log in".
 * No real data is shown here.
 */
export default function CollegeFinderPreview() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6">
      <Link href="/rank-predictor" className={`-ml-3 inline-flex h-12 w-fit items-center gap-2 rounded-full px-3 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}>
        <ArrowLeft aria-hidden className="size-4" /> Rank Predictor
      </Link>
      <header className="-mt-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[34px] font-extrabold leading-none text-foreground">College finder for JoSAA, CSAB and NEET</h1>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-foreground">Free</span>
        </div>
        <p className="text-[14px] text-muted-foreground">Which colleges your JEE or NEET rank would have got in past years, round by round, from official closing ranks.</p>
      </header>

      <section className="flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4 sm:p-6">
        <h2 className="font-display text-[21px] font-bold text-foreground">What you get</h2>
        <ul className="flex flex-col gap-2 text-[14px] text-foreground">
          {[
            'JEE: every IIT, NIT, IIIT and GFTI branch from JoSAA, plus CSAB special rounds.',
            'NEET: MCC All India Quota colleges, and your state quota where we have the list (9 states).',
            'Safe, Likely and Reach for your rank, category, gender and home state.',
            'The closing rank of every round, so you see when a seat would have opened for you.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <figure className="flex flex-col gap-2 rounded-[12px] border border-dashed border-border p-3">
          <figcaption className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Example of one result</figcaption>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-foreground">An NIT, Computer Science</span>
              <span className="text-[13px] text-muted-foreground">Other state · OPEN · Gender-neutral</span>
              <span className="text-[13px] text-muted-foreground">Closing rank R1 1,100 → R5 1,370 · opened in round 4</span>
            </div>
            <BandChip band="likely" />
          </div>
        </figure>

        <div className="flex flex-col gap-2 sm:flex-row">
          <TrackedAuthLink
            href={COLLEGES_SIGNUP_HREF}
            action="sign_up"
            className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[16px] font-semibold text-primary-foreground ${fieldFocus}`}
          >
            <UserPlus aria-hidden className="size-5" /> Create a free account
          </TrackedAuthLink>
          <TrackedAuthLink
            href={COLLEGES_LOGIN_HREF}
            action="log_in"
            className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border px-6 text-[16px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}
          >
            <LogIn aria-hidden className="size-5" /> Log in
          </TrackedAuthLink>
        </div>
        <p className="text-[13px] text-muted-foreground">Free with any Origin account. No approval, no daily limit.</p>
      </section>

      <section aria-labelledby="college-finder-how" className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4 sm:p-6">
        <h2 id="college-finder-how" className="font-display text-[21px] font-bold text-foreground">How it works</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-foreground">
          <li>Get your rank range from the free Rank Predictor, or type the rank you already have.</li>
          <li>Pick your category, gender and home state, so you only see seats you can apply for.</li>
          <li>See every matching seat as Safe, Likely or Reach, with the closing rank of each counselling round.</li>
        </ol>
        <p className="text-[14px] text-muted-foreground">Don&apos;t know your rank yet? Start with a rank predictor:</p>
        <ul className="flex flex-wrap gap-2">
          {EXAM_PAGE_LIST.map((page) => (
            <li key={page.path}>
              <Link
                href={page.path}
                className={`inline-flex min-h-12 items-center rounded-full border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`}
              >
                {page.heading}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <FaqList items={COLLEGE_FINDER_FAQ} headingId="college-finder-faq" />

      <footer className="flex flex-col gap-2 rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        <p>{COUNSELLING_DISCLAIMER}</p>
        <p className="flex flex-wrap items-center gap-x-3">
          <span>Official sites:</span>
          {OFFICIAL_LINKS.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center font-semibold text-foreground underline underline-offset-2">
              {l.label}
            </a>
          ))}
        </p>
      </footer>
    </main>
  );
}
