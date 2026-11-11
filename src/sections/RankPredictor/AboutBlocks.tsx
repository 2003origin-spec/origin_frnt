import Link from 'next/link';

import { FaqList } from '@/components/seo/FaqList';
import type { FaqItem } from '@/lib/seo/rank-predictor-seo';
import { COLLEGE_FINDER_PATH, EXAM_PAGE_LIST, PREDICTOR_DATA_YEARS, RANK_PREDICTOR_PATH, type ExamPage } from '@/lib/seo/rank-predictor-seo';

const fieldFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const pill = `inline-flex min-h-12 items-center rounded-full border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-surface-2 ${fieldFocus}`;

/**
 * Server-rendered copy under the Rank Predictor tool (SEO_APP_DOWNLOAD_NOTES.md):
 * what it covers, links between the exam pages and the college finder, and a
 * visible FAQ. The page's FAQPage JSON-LD uses exactly `faq`, so the two match.
 */
export default function AboutBlocks({ examPage, faq, collegesEnabled }: { examPage: ExamPage | null; faq: readonly FaqItem[]; collegesEnabled: boolean }) {
  const otherExams = EXAM_PAGE_LIST.filter((p) => p.exam !== examPage?.exam);
  return (
    <>
      <section aria-labelledby="rank-predictor-about" className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4 sm:p-6">
        <h2 id="rank-predictor-about" className="font-display text-[21px] font-bold text-foreground">
          {examPage ? `What the ${examPage.heading} shows` : 'What the Rank Predictor covers'}
        </h2>
        {examPage ? (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-foreground">
            {examPage.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-foreground">
            <li>NEET UG: All India rank range from your Physics, Chemistry and Biology marks, with category rank and state rank for 9 states.</li>
            <li>JEE Main: expected percentile and All India rank range from your Maths, Physics and Chemistry marks, and whether you are likely to qualify for JEE Advanced.</li>
            <li>JEE Advanced: Common Rank List (CRL) range from both papers together.</li>
            <li>Built on official results and public data from {PREDICTOR_DATA_YEARS}. Every result shows its sources and how sure it is.</li>
          </ul>
        )}
        <nav aria-label="More predictors" className="flex flex-col gap-2 pt-1">
          <ul className="flex flex-wrap gap-2">
            {examPage ? (
              <li>
                <Link href={RANK_PREDICTOR_PATH} className={pill}>
                  All exams
                </Link>
              </li>
            ) : null}
            {otherExams.map((page) => (
              <li key={page.path}>
                <Link href={page.path} className={pill}>
                  {page.heading}
                </Link>
              </li>
            ))}
            {collegesEnabled ? (
              <li>
                <Link href={COLLEGE_FINDER_PATH} className={pill}>
                  College finder (JoSAA, CSAB, MCC)
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      </section>

      <FaqList items={faq} headingId="rank-predictor-faq" />
    </>
  );
}
