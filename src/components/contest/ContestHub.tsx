'use client';

import { ContestExploreSection } from '@/components/contest/ContestExploreSection';
import { ContestList } from '@/components/contest/ContestList';

/**
 * The dedicated Weekly Contest page (reached from the Explore grid card). Holds
 * ALL the contest surfaces in one place: the current-contest hero + feature tiles
 * + ORBIT links (ContestExploreSection), and the full list of open contests.
 */
export function ContestHub() {
  return (
    <div className="min-h-dvh neu-surface py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <ContestExploreSection />
        <ContestList embedded />
      </div>
    </div>
  );
}
