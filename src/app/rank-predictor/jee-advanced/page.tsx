import type { Metadata } from 'next';

import { ExamPredictorPage, examPageMetadata } from '@/sections/RankPredictor/PredictorPage';

// jee-advanced rank predictor entry page for search (SEO_APP_DOWNLOAD_NOTES.md). 404 while the rankPredictor flag is off.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Promise<Metadata> {
  return examPageMetadata('jee-advanced');
}

export default function RankPredictorJeeAdvancedPage() {
  return <ExamPredictorPage exam="jee-advanced" />;
}
