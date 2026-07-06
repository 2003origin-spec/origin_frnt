import { NextResponse } from 'next/server';

import { isFeatureEnabled } from '@/lib/feature-flags';

/**
 * CBT student-surface health probe. Public at the edge (rides the
 * `/api/cbt-student` public prefix), so an anonymous 200 confirms the new route
 * tree actually deployed — the canary for the known new-route-404 gotcha.
 */
export async function GET() {
  if (!isFeatureEnabled('cbtModule')) {
    return NextResponse.json({ detail: 'Not found.' }, { status: 404 });
  }
  return NextResponse.json({ status: 'ok', surface: 'cbt-student', checkedAt: new Date().toISOString() });
}
