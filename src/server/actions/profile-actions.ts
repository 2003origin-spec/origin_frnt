'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { withStore } from '@/server/store';
import { serializeUser } from '@/server/users';
import type { User } from '@/types';

type UpdateProfileInput = Partial<{
  name: string;
  class: string;
  student_class: string;
  fieldOfInterest: string;
  referralSource: string;
  avatar: string;
  selectedCourse: string;
  yearsOfExperience: string;
  studentCapacity: string;
  studentClass: string;
  isOnboarded: boolean;
  isDropper: boolean;
  subjects: string[];
}>;

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

function applyProfileUpdates(userId: string, input: UpdateProfileInput): User | null {
  return withStore((store) => {
    const user = store.users.find((u) => u.id === userId);
    if (!user) return null;

    const stringFields: Array<[keyof typeof user, string | undefined]> = [
      ['name', input.name],
      ['fieldOfInterest', input.fieldOfInterest],
      ['referralSource', input.referralSource],
      ['avatar', input.avatar],
      ['selectedCourse', input.selectedCourse],
      ['yearsOfExperience', input.yearsOfExperience],
      ['studentCapacity', input.studentCapacity],
    ];

    for (const [field, value] of stringFields) {
      if (typeof value === 'string') (user[field] as unknown) = value;
    }

    const studentClass = input.studentClass ?? input.student_class ?? input.class;
    if (typeof studentClass === 'string') user.studentClass = studentClass;
    if (typeof input.isOnboarded === 'boolean') user.isOnboarded = input.isOnboarded;
    if (typeof input.isDropper === 'boolean') user.isDropper = input.isDropper;
    if (Array.isArray(input.subjects)) user.subjects = input.subjects;

    const serialized = serializeUser(store, userId);
    return (serialized as unknown as User) ?? null;
  });
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<User> {
  const current = await requireUser();
  const updated = applyProfileUpdates(current.id, input);
  if (!updated) throw new Error('Profile update failed — user missing from store.');

  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${current.id}`, 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${current.id}`, 'max');
  revalidatePath('/', 'layout');
  return updated;
}

/**
 * Finalizes onboarding — marks `isOnboarded: true` and applies any remaining
 * profile fields captured during the flow. Kept distinct from `updateProfileAction`
 * so the revalidation surface can include `/onboarding` → `/dashboard`
 * transitions without over-revalidating elsewhere.
 */
export async function completeOnboardingAction(input: UpdateProfileInput = {}): Promise<User> {
  const current = await requireUser();
  const updated = applyProfileUpdates(current.id, { ...input, isOnboarded: true });
  if (!updated) throw new Error('Onboarding completion failed — user missing from store.');

  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${current.id}`, 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${current.id}`, 'max');
  revalidatePath('/onboarding');
  revalidatePath('/', 'layout');
  return updated;
}
