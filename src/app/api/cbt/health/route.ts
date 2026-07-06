import { NextResponse } from 'next/server';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { ensureCbtSchema } from '@/server/cbt/cbt-schema';

/**
 * CBT teacher-surface health probe. Role-gated to cbt_teacher at the edge (it
 * rides the `/api/cbt` role prefix), so a 200 here also confirms an
 * authenticated CBT session can reach the API tree. Triggers the cbt.* schema
 * bootstrap so a fresh environment self-provisions on first authenticated hit.
 */
export async function GET() {
  if (!isFeatureEnabled('cbtModule')) {
    return NextResponse.json({ detail: 'Not found.' }, { status: 404 });
  }
  try {
    await ensureCbtSchema();
  } catch (error) {
    return NextResponse.json(
      { status: 'down', surface: 'cbt', detail: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
  return NextResponse.json({ status: 'ok', surface: 'cbt', checkedAt: new Date().toISOString() });
}
