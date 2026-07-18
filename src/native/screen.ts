/**
 * Exam-integrity + wakefulness bridge hooks (plan ledger #41/#42).
 *
 * - setSecureScreen(true): shell sets FLAG_SECURE — blocks screenshots and
 *   screen recording while a CBT/test attempt is active. Aligns with
 *   CBT_FRAUD_DETECTION_PLAN.
 * - setKeepAwake(true): keeps the display on during attempts and live/study
 *   rooms so a 3-hour paper never sleeps mid-question.
 *
 * All no-ops in browsers and on shells without the capability. The
 * `useSecureExamScreen` hook pairs enable/disable with mount/unmount so a
 * crashed component can't leave the flags stuck on.
 */

import { useEffect } from "react";

import { getOriginNative, hasNativeCapability } from "@/native/bridge";

export async function setSecureScreen(on: boolean): Promise<void> {
  if (!(await hasNativeCapability("secureScreen"))) return;
  try {
    await getOriginNative()?.setSecureScreen({ on });
  } catch {
    // Best-effort.
  }
}

export async function setKeepAwake(on: boolean): Promise<void> {
  if (!(await hasNativeCapability("keepAwake"))) return;
  try {
    await getOriginNative()?.setKeepAwake({ on });
  } catch {
    // Best-effort.
  }
}

/**
 * While mounted (and `active`), the screen is secure + kept awake. Both are
 * released on unmount, including via effect cleanup on crashes/navigation.
 */
export function useSecureExamScreen(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    void setSecureScreen(true);
    void setKeepAwake(true);
    return () => {
      void setSecureScreen(false);
      void setKeepAwake(false);
    };
  }, [active]);
}
