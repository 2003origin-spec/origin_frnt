import type { Metadata } from 'next';

import { ExamPredictorPage, examPageMetadata } from '@/sections/RankPredictor/PredictorPage';

// neet rank predictor entry page for search (SEO_APP_DOWNLOAD_NOTES.md). 404 while the rankPredictor flag is off.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Promise<Metadata> {
  return examPageMetadata('neet');
}

export default function RankPredictorNeetPage() {
  return <ExamPredictorPage exam="neet" />;
}
