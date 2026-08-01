'use server';

/**
 * Study Mode server actions — the only write path for `origin_users.study_mode`.
 *
 * Cache note (plan §2.5 / §6.10): a mode switch must NOT revalidate the global
 * tags (`ogcode`, `challenge`, `leaderboard`, `dpps`). Those are shared by every
 * user, so flushing them on every toggle would nuke the whole platform's render
 * cache. Correctness instead comes from the mode being an explicit ARGUMENT to
 * every mode-dependent `unstable_cache` loader — a switch simply lands on a
 * different cache key. Only the per-user auth tags are revalidated here, so
 * `useAuth().user.studyMode` and the RSC seed agree immediately.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.
 */

import { revalidatePath, revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { metric } from '@/lib/metrics';
import { isWithinLimit, studyModeLimiter } from '@/lib/rate-limit';
import {
  STUDY_MODE_LABELS,
  normalizeStudyMode,
  studyModeCoverage,
  type StudyMode,
} from '@/lib/study-mode';
import { dbUpdateUser } from '@/server/db-users';
import { withStoreAsyncScoped } from '@/server/store';
import { getStudentScope, resolveStudyMode } from '@/server/study-scope';
import { isUserPostgresConfigured } from '@/server/user-postgres';

export type StudyModeActionResult =
  | { ok: true; mode: StudyMode }
  | { ok: false; error: string };

async function requireStudent() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  // Study Mode is a student-only concept. Teachers and admins are never scoped,
  // so writing a mode for them would be dead data with a misleading UI.
  if (user.role !== 'student') throw new Error('Study Mode applies to student accounts only.');
  return user;
}

/**
 * Mirrors the in-memory store so a serializeUser() in the same request sees the
 * new value, then persists to Postgres. Ordered store-first (same as
 * `applyProfileUpdates`) so a DB failure surfaces before the caller believes it
 * succeeded.
 */
async function persistStudyMode(
  userId: string,
  patch: { studyMode?: StudyMode; studyModePromptedAt?: string },
): Promise<void> {
  await withStoreAsyncScoped(
    async (store) => {
      const stored = store.users.find((u) => u.id === userId);
      if (!stored) return null;
      if (patch.studyMode !== undefined) stored.studyMode = patch.studyMode;
      if (patch.studyModePromptedAt !== undefined) {
        stored.studyModePromptedAt = patch.studyModePromptedAt;
      }
      return null;
    },
    { userId, collections: [], persistUser: true },
  );

  if (isUserPostgresConfigured()) {
    await dbUpdateUser(userId, patch);
  }
}

/**
 * Revalidates ONLY the per-user surfaces. Deliberately no global content tags —
 * see the file header.
 */
function revalidateForUser(userId: string): void {
  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${userId}`, 'max');
  // `user-profile` guards getCachedFrontendUser in src/lib/auth-server.ts, which
  // seeds every RSC page (and therefore the mode passed into the render loaders).
  // It is a shared tag, but its TTL is only 10s and a miss costs one store read
  // + serialize — so dropping it platform-wide is genuinely negligible, unlike
  // the `ogcode` / `challenge` / `leaderboard` tags which guard 30-300s caches
  // over expensive question queries and are deliberately NOT touched here.
  revalidateTag('user-profile', 'max');
  revalidatePath('/dashboard');
  revalidatePath('/ogcode');
  revalidatePath('/tests');
  revalidatePath('/dpp');
  revalidatePath('/leaderboard');
  revalidatePath('/profile');
}

/** Sets the student's Study Mode. Idempotent — re-selecting the current mode is a no-op. */
export async function setStudyModeAction(input: unknown): Promise<StudyModeActionResult> {
  const user = await requireStudent();

  const mode = normalizeStudyMode(input);
  if (!mode) {
    return { ok: false, error: 'Pick JEE, NEET, or PCMB.' };
  }

  // Entitlement check. Hiding the toggle in the UI is not enforcement: a student
  // who owns one or two subjects (or none) must not be able to put themselves
  // into a mode by calling this action directly, because every mode would hide
  // something they paid for. Only modes whose subjects they FULLY own are
  // selectable. Skipped entirely when the scope is not enforced (flag off / dev).
  const scope = await getStudentScope(user.id, user.role);
  if (scope.enforced) {
    if (!scope.canChooseMode) {
      return {
        ok: false,
        error:
          'Study Mode is available once you have a full JEE, NEET, or PCMB subject set. Your current subjects already scope your content.',
      };
    }
    if (!scope.availableModes.includes(mode)) {
      const missing = studyModeCoverage(mode, scope.ownedSubjects).missing;
      const names = missing.map((s) => s[0].toUpperCase() + s.slice(1)).join(' and ');
      return {
        ok: false,
        error: `${STUDY_MODE_LABELS[mode]} needs ${names}, which you don't have yet.`,
      };
    }
  }

  // Compare against POSTGRES, not `user` — that came from the in-memory store,
  // a per-lambda snapshot with a 5-minute TTL. Comparing against a stale value
  // meant a student could tap a mode the snapshot already believed was active
  // and hit the early-return below, so the write never happened and the choice
  // silently didn't save.
  const current = await resolveStudyMode(user.id);
  const previous = current.explicit ? current.mode : null;
  if (previous === mode) {
    // Still stamp the prompt marker: choosing the already-active mode from the
    // first-run picker is a real answer and must stop it re-asking.
    if (!current.prompted) {
      try {
        await persistStudyMode(user.id, { studyModePromptedAt: new Date().toISOString() });
        revalidateForUser(user.id);
      } catch (err) {
        console.error('[study-mode-actions] failed to stamp prompt marker:', err);
      }
    }
    return { ok: true, mode };
  }

  if (!(await isWithinLimit(studyModeLimiter, `study-mode:${user.id}`))) {
    return { ok: false, error: 'You are switching modes very fast. Try again in a few minutes.' };
  }

  try {
    await persistStudyMode(user.id, {
      studyMode: mode,
      studyModePromptedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[study-mode-actions] failed to persist study mode:', err);
    return { ok: false, error: 'Could not save your study mode. Please try again.' };
  }

  metric('origin.study_mode.switch', { from: previous ?? 'unset', to: mode });
  revalidateForUser(user.id);
  return { ok: true, mode };
}

/**
 * Records that the first-run picker was shown and dismissed WITHOUT choosing.
 * `study_mode` stays NULL, so the student keeps the fully-open default.
 */
export async function dismissStudyModePromptAction(): Promise<{ ok: boolean }> {
  const user = await requireStudent();
  // Authoritative — see setStudyModeAction for why `user` cannot be trusted here.
  if ((await resolveStudyMode(user.id)).prompted) return { ok: true };

  try {
    await persistStudyMode(user.id, { studyModePromptedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[study-mode-actions] failed to dismiss study mode prompt:', err);
    return { ok: false };
  }

  metric('origin.study_mode.prompt_dismissed', {});
  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${user.id}`, 'max');
  revalidatePath('/dashboard');
  return { ok: true };
}
