import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { JsonLd } from '@/components/seo/JsonLd';
import type { RankPredictorExam } from '@/lib/rank-predictor/types';
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  RANK_PREDICTOR_DESCRIPTION,
  RANK_PREDICTOR_PATH,
  RANK_PREDICTOR_TITLE,
  EXAM_PAGES,
  rankPredictorFaq,
  SEO_IMAGE,
  webApplicationJsonLd,
  type ExamPage,
} from '@/lib/seo/rank-predictor-seo';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { isFeatureEnabledRuntime } from '@/server/feature-flags-runtime';
import { rankPredictorShiftOptions } from '@/server/rank-predictor/data';

import AboutBlocks from './AboutBlocks';
import RankPredictor from './RankPredictor';

/** Metadata for /rank-predictor (examPage null) or one exam page. Callers return it only while the flag is on. */
export function predictorMetadata(examPage: ExamPage | null): Metadata {
  const title = examPage?.title ?? RANK_PREDICTOR_TITLE;
  const description = examPage?.description ?? RANK_PREDICTOR_DESCRIPTION;
  const path = examPage?.path ?? RANK_PREDICTOR_PATH;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'website', siteName: 'O3 Origin', locale: 'en_IN', images: [SEO_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [SEO_IMAGE.url] },
  };
}

/**
 * The public predictor page body: JSON-LD (free web app, breadcrumbs, FAQ),
 * the tool, then server-rendered "what it covers" and the visible FAQ.
 */
export default function PredictorPage({
  examPage,
  initialExam,
  initialAttemptId,
  collegesEnabled,
}: {
  examPage: ExamPage | null;
  initialExam: RankPredictorExam;
  initialAttemptId: string | null;
  collegesEnabled: boolean;
}) {
  const siteUrl = getCanonicalSiteUrl();
  const faq = rankPredictorFaq(examPage?.faq ?? [], collegesEnabled);
  const path = examPage?.path ?? RANK_PREDICTOR_PATH;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Rank Predictor', path: RANK_PREDICTOR_PATH },
    ...(examPage ? [{ name: examPage.heading, path: examPage.path }] : []),
  ];
  return (
    <>
      <JsonLd
        data={[
          webApplicationJsonLd({
            siteUrl,
            path,
            name: examPage ? `Origin ${examPage.heading}` : 'Origin NEET & JEE Rank Predictor',
            description: examPage?.description ?? RANK_PREDICTOR_DESCRIPTION,
          }),
          breadcrumbJsonLd(siteUrl, crumbs),
          faqPageJsonLd(faq),
        ]}
      />
      <RankPredictor
        initialExam={initialExam}
        shiftOptions={rankPredictorShiftOptions()}
        initialAttemptId={initialAttemptId}
        collegesEnabled={collegesEnabled}
        heading={examPage?.heading}
        intro={examPage?.intro}
        returnPath={path}
      >
        <AboutBlocks examPage={examPage} faq={faq} collegesEnabled={collegesEnabled} />
      </RankPredictor>
    </>
  );
}

/**
 * Exam entry pages (/rank-predictor/neet, /jee-main, /jee-advanced): the same
 * tool with that exam pre-selected, plus the exam's own title, copy, FAQ and a
 * self-canonical. Three small static routes (not a dynamic segment) so every
 * public path is listed exactly in route-policy. Same flag as /rank-predictor:
 * off → 404, no metadata, no JSON-LD.
 */
export async function examPageMetadata(exam: RankPredictorExam): Promise<Metadata> {
  return (await isFeatureEnabledRuntime('rankPredictor')) ? predictorMetadata(EXAM_PAGES[exam]) : {};
}

export async function ExamPredictorPage({ exam }: { exam: RankPredictorExam }) {
  const [enabled, collegesEnabled] = await Promise.all([isFeatureEnabledRuntime('rankPredictor'), isFeatureEnabledRuntime('collegeCounselling')]);
  if (!enabled) notFound();
  return <PredictorPage examPage={EXAM_PAGES[exam]} initialExam={exam} initialAttemptId={null} collegesEnabled={collegesEnabled} />;
}
