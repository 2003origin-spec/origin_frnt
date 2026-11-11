/**
 * Search copy and structured data for the public Rank Predictor pages and the
 * college finder teaser (SEO_APP_DOWNLOAD_NOTES.md). Pure and server-safe.
 *
 * Rules (owner brief, 11/11/2026):
 * - Every FAQ answer here is also rendered as visible text on the page that
 *   emits its FAQPage JSON-LD (see `FaqList`). Never put a question in the
 *   JSON-LD that is not on the page.
 * - Plain, honest copy: estimates from past official data, no "most accurate",
 *   no ratings or reviews, no keyword lists.
 * - Callers render all of this only while the `rankPredictor` flag is on (and
 *   `collegeCounselling` for the college finder), so nothing leaks when off.
 */

import type { RankPredictorExam } from "@/lib/rank-predictor/types";
import { FREE_CHECKS_PER_DAY } from "@/lib/rank-predictor/types";

export type FaqItem = { question: string; answer: string; /** Shown only while the college finder is on. */ needsColleges?: boolean };

export const RANK_PREDICTOR_PATH = "/rank-predictor";
export const COLLEGE_FINDER_PATH = "/rank-predictor/colleges";

/** Years of official results the predictor tables cover (src/lib/rank-predictor/data/*.json). */
export const PREDICTOR_DATA_YEARS = "2023 to 2026";

/** OG/Twitter image: the site's existing brand card (no new asset). */
export const SEO_IMAGE = { url: "/origin-new.jpg", alt: "O3 Origin" } as const;

export const RANK_PREDICTOR_TITLE = "NEET & JEE Rank Predictor 2027 (Free) | Origin";
export const RANK_PREDICTOR_DESCRIPTION =
  "Free NEET, JEE Main and JEE Advanced rank predictor. Enter your marks per subject to see your All India rank range, category rank and, for JEE Main, your percentile. Built on official results from 2023 to 2026.";

export const COLLEGE_FINDER_TITLE = "JoSAA, CSAB & NEET College Predictor (Free) | Origin";
export const COLLEGE_FINDER_DESCRIPTION =
  "Free college finder: see which IIT, NIT, IIIT, GFTI and medical college seats your rank would have got in past JoSAA, CSAB and MCC counselling rounds, with closing ranks round by round.";

/** Shared questions for /rank-predictor (and each exam page, after its own). */
export const RANK_PREDICTOR_FAQ: readonly FaqItem[] = [
  {
    question: "How does the Rank Predictor estimate my rank?",
    answer:
      `It compares your marks with the official marks-to-rank and marks-to-percentile data published for ${PREDICTOR_DATA_YEARS}, year by year, and shows the range those years give. Unusual years are left out or given less weight, and the page tells you when that happens.`,
  },
  {
    question: "Which exams does it cover?",
    answer: "NEET UG, JEE Main and JEE Advanced. You enter marks per subject, and pick your category, PwD status and, for NEET, your home state.",
  },
  {
    question: "Is it free, and how many checks do I get?",
    answer: `Yes, it is free. Without an account you get ${FREE_CHECKS_PER_DAY} checks a day. With a free Origin account the checks are unlimited.`,
  },
  {
    question: "Is the predicted rank a guarantee?",
    answer:
      "No. It is an estimate from past years. Your real rank depends on this year's paper and on how everyone else does, so treat it as guidance, not a promise of a rank or a seat.",
  },
  {
    question: "Can I see which colleges my rank could get?",
    answer:
      "Yes. With a free account, the college finder shows the IIT, NIT, IIIT, GFTI and medical college seats your rank would have got in past JoSAA, CSAB and MCC counselling rounds, using the official closing ranks.",
    needsColleges: true,
  },
];

/**
 * The FAQ shown (and marked up) on a predictor page: the exam's own questions
 * first, then the shared ones. The college finder question only while that
 * feature is on, so the page never describes something a visitor cannot open.
 */
export function rankPredictorFaq(examFaq: readonly FaqItem[], collegesEnabled: boolean): FaqItem[] {
  return [...examFaq, ...RANK_PREDICTOR_FAQ.filter((item) => collegesEnabled || !item.needsColleges)].map(({ question, answer }) => ({ question, answer }));
}

export type ExamPage = {
  exam: RankPredictorExam;
  path: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  /** Short "what you get for this exam" points, shown on the page. */
  points: readonly string[];
  faq: readonly FaqItem[];
};

/** Exam entry pages: same tool, exam pre-selected, their own copy and canonical. */
export const EXAM_PAGES: Readonly<Record<RankPredictorExam, ExamPage>> = {
  neet: {
    exam: "neet",
    path: "/rank-predictor/neet",
    title: "NEET Rank Predictor 2027: Marks vs Rank (Free) | Origin",
    description:
      "Free NEET UG rank predictor. Enter your Physics, Chemistry and Biology marks to see your All India rank range, category rank and, for 9 states, your state rank, from official NEET results.",
    heading: "NEET Rank Predictor",
    intro: "Your NEET marks in, an All India rank range out, from official NEET UG results.",
    points: [
      "Marks per subject: Physics, Chemistry and Biology, out of 720 in total.",
      "All India rank range, plus category rank and PwD rank.",
      "State rank for the 9 states that publish an official list (Karnataka, Tamil Nadu, Uttar Pradesh, Rajasthan, Gujarat, Madhya Pradesh, Maharashtra, Bihar, Odisha).",
      "Whether your marks clear the qualifying cut-off for your category in past years.",
    ],
    faq: [
      {
        question: "How is the NEET rank estimated?",
        answer:
          "From the official NEET marks-to-rank data for each recent year. 2024 was an unusual year (re-test and grace marks), so it is kept out of the main range and only used as a cross-check.",
      },
      {
        question: "Does it give a NEET state rank?",
        answer:
          "Yes, for the 9 states that publish an official state merit list. For other states it says so instead of guessing.",
      },
    ],
  },
  "jee-main": {
    exam: "jee-main",
    path: "/rank-predictor/jee-main",
    title: "JEE Main Rank Predictor 2027: Percentile & Rank | Origin",
    description:
      "Free JEE Main rank predictor. Enter your Maths, Physics and Chemistry marks to see your expected percentile, All India rank range and category rank, and whether you are likely to qualify for JEE Advanced.",
    heading: "JEE Main Rank Predictor",
    intro: "Your JEE Main marks in, a percentile and All India rank range out, from official JEE Main results.",
    points: [
      "Marks per subject: Maths, Physics and Chemistry, out of 300 in total.",
      "Expected NTA percentile, All India rank range, category rank and PwD rank.",
      "Optional: compare with one 2024 shift, the only year with official shift-wise tables.",
      "Whether you are likely to clear the JEE Advanced cut-off for your category.",
    ],
    faq: [
      {
        question: "How does it turn JEE Main marks into a percentile?",
        answer:
          "It uses the official marks-to-percentile data published for past sessions, then turns the percentile into a rank using the number of candidates that year. Shift difficulty changes percentiles, so you see a range.",
      },
      {
        question: "Will it tell me if I qualify for JEE Advanced?",
        answer:
          "It compares your expected percentile with past JEE Advanced eligibility cut-offs for your category and says likely, borderline or not this year.",
      },
    ],
  },
  "jee-advanced": {
    exam: "jee-advanced",
    path: "/rank-predictor/jee-advanced",
    title: "JEE Advanced Rank Predictor 2027: CRL Rank (Free) | Origin",
    description:
      "Free JEE Advanced rank predictor. Enter your Maths, Physics and Chemistry marks (both papers together) to see your Common Rank List (CRL) range and category rank, from official JEE Advanced results.",
    heading: "JEE Advanced Rank Predictor",
    intro: "Your JEE Advanced marks in, a Common Rank List (CRL) range out, from official JEE Advanced results.",
    points: [
      "Marks per subject for both papers together: each subject out of 120, 360 in total.",
      "Common Rank List (CRL) range, category rank and PwD rank.",
      "Each year's paper pattern differs, so the range comes from the marks-to-rank data of every recent year.",
    ],
    faq: [
      {
        question: "Which rank does the JEE Advanced predictor show?",
        answer:
          "Your Common Rank List (CRL) range, plus a category rank range. IIT seats in JoSAA use these ranks.",
      },
      {
        question: "Should I enter Paper 1 and Paper 2 separately?",
        answer: "No. Add both papers for each subject, so each subject is out of 120 and the total is out of 360.",
      },
    ],
  },
};

export const EXAM_PAGE_LIST: readonly ExamPage[] = Object.values(EXAM_PAGES);

/** Visible on the logged-out college finder page and in its FAQPage JSON-LD. */
export const COLLEGE_FINDER_FAQ: readonly FaqItem[] = [
  {
    question: "How does the college finder use closing ranks?",
    answer:
      "For each seat (institute, branch, quota, category and gender pool) it looks up the official closing rank of every counselling round we have, and compares it with your rank. Safe means your rank was well inside round 1, Likely means inside the last round, and Reach means just outside it.",
  },
  {
    question: "Which counselling does it cover?",
    answer:
      "JEE: JoSAA (IITs, NITs, IIITs and GFTIs) and CSAB special rounds. NEET: MCC All India Quota (government, deemed, central universities, AIIMS, JIPMER and ESIC), plus state quota lists for the states where we have official data.",
  },
  {
    question: "Is it free?",
    answer: "Yes. It needs a free Origin account (no approval, no daily limit). Without an account you can use the Rank Predictor first.",
  },
  {
    question: "Will I surely get the college it shows?",
    answer:
      "No. It shows what your rank would have got in past years. Closing ranks change every year, so always check the official JoSAA, CSAB, MCC or state counselling site before choice filling.",
  },
];

// ── JSON-LD builders ───────────────────────────────────────────────────────

const ORG_NAME = "O3 Origin";

export function webApplicationJsonLd(input: { siteUrl: string; path: string; name: string; description: string }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: input.name,
    url: `${input.siteUrl}${input.path}`,
    description: input.description,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any (web browser)",
    isAccessibleForFree: true,
    inLanguage: "en-IN",
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    provider: { "@type": "EducationalOrganization", name: ORG_NAME, url: input.siteUrl },
  };
}

export function breadcrumbJsonLd(siteUrl: string, items: readonly { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path === "/" ? "" : item.path}`,
    })),
  };
}

export function faqPageJsonLd(items: readonly FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
