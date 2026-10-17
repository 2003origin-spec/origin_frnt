/**
 * Origin NOW inside /teacher (pilot readiness item 4, decision B83): teachers
 * who are approved solvers get an "Origin NOW" item in their workspace menu.
 *
 * The flag is checked before any database call, so while Origin NOW ships
 * dark the teacher pages never touch the `now` schema (which may not exist in
 * production yet). Any error hides the item instead of breaking the page.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";

import { getHelperByUserId } from "./dispatch-service";

export async function isNowSolver(userId: string | null | undefined): Promise<boolean> {
  if (!userId || !isFeatureEnabled("originNow")) return false;
  try {
    const helper = await getHelperByUserId(userId);
    return Boolean(helper) && helper!.verification_status !== "rejected";
  } catch (error) {
    console.warn("[origin-now] teacher menu check failed", error instanceof Error ? error.message : error);
    return false;
  }
}
