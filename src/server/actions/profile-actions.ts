'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { withStoreAsyncScoped, type StoredUser } from '@/server/store';
import { serializeUser } from '@/server/users';
import { isUserPostgresConfigured } from '@/server/user-postgres';
import bcrypt from 'bcryptjs';
import { dbCreateMediaAsset, dbUpdateUser, dbMobileInUse } from '@/server/db-users';
import { uploadImageToR2, type UserImagePurpose } from '@/server/media-storage';
import type { User } from '@/types';
import { normalizeSoundPreferences, type SoundPreferences } from '@/lib/sound-preferences';
import { normalizeStudyMode, type StudyMode } from '@/lib/study-mode';

/** Normalize a mobile number to digits and validate it's a 10-digit Indian number. */
function normalizeMobile(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  // Accept a leading country code (91) and strip it; require exactly 10 digits.
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

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
  location: string;
  ogcodeCorrectSound: string | null;
  ogcodeWrongSound: string | null;
  soundPreferences: SoundPreferences | null;
  studyMode: StudyMode | null;
}>;

export type UserImageUploadResult = {
  id: string;
  purpose: UserImagePurpose;
  url: string;
  bucket: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
};

const USER_IMAGE_PURPOSES = new Set<UserImagePurpose>([
  'profile_avatar',
  'memory_booth_source',
  'memory_booth_card',
  // Teacher question authoring — diagram + per-option images (R2, any logged-in
  // teacher). Reuses this generic user-image upload action.
  'workspace_question_image',
]);
const MAX_USER_IMAGE_BYTES = 10 * 1024 * 1024;

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

async function applyProfileUpdates(userId: string, input: UpdateProfileInput): Promise<User | null> {
  return withStoreAsyncScoped(
    async (store) => {
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
        ['location', input.location],
      ];

      for (const [field, value] of stringFields) {
        if (typeof value === 'string') (user[field] as unknown) = value;
      }

      const studentClass = input.studentClass ?? input.student_class ?? input.class;
      if (typeof studentClass === 'string') user.studentClass = studentClass;
      if (typeof input.isOnboarded === 'boolean') user.isOnboarded = input.isOnboarded;
      if (typeof input.isDropper === 'boolean') user.isDropper = input.isDropper;
      if (Array.isArray(input.subjects)) user.subjects = input.subjects;
      if ('ogcodeCorrectSound' in input) user.ogcodeCorrectSound = input.ogcodeCorrectSound ?? null;
      if ('ogcodeWrongSound' in input) user.ogcodeWrongSound = input.ogcodeWrongSound ?? null;
      if ('soundPreferences' in input) {
        user.soundPreferences = input.soundPreferences ? normalizeSoundPreferences(input.soundPreferences) : null;
      }
      if ('studyMode' in input) {
        user.studyMode = normalizeStudyMode(input.studyMode);
        // Keep the in-memory row coherent: setting a mode without its prompt
        // marker leaves a half-written user that the first-run picker misreads.
        if (user.studyMode) user.studyModePromptedAt = user.studyModePromptedAt ?? new Date().toISOString();
      }

      const serialized = serializeUser(store, userId);
      return (serialized as unknown as User) ?? null;
    },
    { userId, collections: [], persistUser: true }
  );
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<User> {
  const current = await requireUser();
  const updated = await applyProfileUpdates(current.id, input);

  if (!updated) {
    throw new Error('Failed to update profile');
  }

  // Persist to Postgres if configured
  if (isUserPostgresConfigured()) {
    try {
      const patch: Partial<StoredUser> = {};
      if (input.name !== undefined) patch.name = input.name;
      
      const studentClass = input.studentClass ?? input.class ?? input.student_class;
      if (studentClass !== undefined) patch.studentClass = studentClass;
      
      if (input.fieldOfInterest !== undefined) patch.fieldOfInterest = input.fieldOfInterest;
      if (input.referralSource !== undefined) patch.referralSource = input.referralSource;
      if (input.avatar !== undefined) patch.avatar = input.avatar;
      if (input.selectedCourse !== undefined) patch.selectedCourse = input.selectedCourse;
      if (input.yearsOfExperience !== undefined) patch.yearsOfExperience = input.yearsOfExperience;
      if (input.studentCapacity !== undefined) patch.studentCapacity = input.studentCapacity;
      if (input.location !== undefined) patch.location = input.location;
      
      if ('ogcodeCorrectSound' in input) patch.ogcodeCorrectSound = input.ogcodeCorrectSound ?? null;
      if ('ogcodeWrongSound' in input) patch.ogcodeWrongSound = input.ogcodeWrongSound ?? null;
      if ('soundPreferences' in input) {
        patch.soundPreferences = input.soundPreferences ? normalizeSoundPreferences(input.soundPreferences) : null;
      }

      await dbUpdateUser(current.id, patch);
    } catch (err) {
      console.error('[profile-actions] Failed to persist updates to DB:', err);
      throw new Error('Could not save profile changes. Please try again.');
    }
  }

  revalidatePath('/');
  revalidatePath('/profile');
  revalidatePath('/leaderboard');

  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${current.id}`, 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${current.id}`, 'max');
  revalidateTag('leaderboard', 'max');
  return updated;
}

function readUploadPurpose(formData: FormData): UserImagePurpose {
  const raw = String(formData.get('purpose') ?? 'profile_avatar');
  if (USER_IMAGE_PURPOSES.has(raw as UserImagePurpose)) {
    return raw as UserImagePurpose;
  }
  throw new Error('Unsupported image upload purpose.');
}

function readUploadFile(formData: FormData): File {
  const file = formData.get('file');
  if (!file || typeof file === 'string' || typeof (file as File).arrayBuffer !== 'function') {
    throw new Error('Image file is required.');
  }
  return file as File;
}

export async function uploadUserImageAction(formData: FormData): Promise<UserImageUploadResult> {
  const current = await requireUser();
  if (!isUserPostgresConfigured()) {
    throw new Error('Postgres image metadata storage is not configured.');
  }

  const purpose = readUploadPurpose(formData);
  const file = readUploadFile(formData);
  const mimeType = (file.type || 'application/octet-stream').toLowerCase();
  if (!mimeType.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.');
  }
  if (file.size > MAX_USER_IMAGE_BYTES) {
    throw new Error('Image is too large. Please upload an image under 10 MB.');
  }

  const body = Buffer.from(await file.arrayBuffer());
  const upload = await uploadImageToR2({
    userId: current.id,
    purpose,
    fileName: file.name || `${purpose}.png`,
    mimeType,
    body,
  });
  const record = await dbCreateMediaAsset({
    userId: current.id,
    purpose,
    bucket: upload.bucket,
    objectKey: upload.objectKey,
    publicUrl: upload.publicUrl,
    mimeType,
    sizeBytes: upload.sizeBytes,
    sha256: upload.sha256,
    metadata: {
      originalName: file.name || null,
      source: 'profile',
    },
  });

  if (purpose === 'profile_avatar') {
    await applyProfileUpdates(current.id, { avatar: upload.publicUrl });
    if (isUserPostgresConfigured()) {
      await dbUpdateUser(current.id, { avatar: upload.publicUrl });
    }
    revalidateTag('auth-user', 'max');
    revalidateTag(`user:${current.id}`, 'max');
    revalidateTag('leaderboard', 'max');
    revalidatePath('/profile');
    revalidatePath('/leaderboard');
  }

  return {
    id: record.id,
    purpose,
    url: upload.publicUrl,
    bucket: upload.bucket,
    objectKey: upload.objectKey,
    mimeType,
    sizeBytes: upload.sizeBytes,
    sha256: upload.sha256,
    createdAt: record.createdAt,
  };
}

/**
 * Finalizes onboarding — marks `isOnboarded: true` and applies any remaining
 * profile fields captured during the flow. Kept distinct from `updateProfileAction`
 * so the revalidation surface can include `/onboarding` → `/dashboard`
 * transitions without over-revalidating elsewhere.
 */
export async function completeOnboardingAction(input: UpdateProfileInput = {}): Promise<User> {
  const current = await requireUser();
  const updated = await applyProfileUpdates(current.id, { ...input, isOnboarded: true });
  if (!updated) throw new Error('Onboarding completion failed — user missing from store.');

  // Persist to Postgres if configured
  if (isUserPostgresConfigured()) {
    try {
      await dbUpdateUser(current.id, {
        isOnboarded: true,
        name: input.name,
        studentClass: input.studentClass ?? input.class ?? input.student_class,
        fieldOfInterest: input.fieldOfInterest,
        referralSource: input.referralSource,
        avatar: input.avatar,
        selectedCourse: input.selectedCourse,
        yearsOfExperience: input.yearsOfExperience,
        studentCapacity: input.studentCapacity,
        location: input.location,
        // Onboarding sets the canonical Study Mode alongside the decorative
        // `selectedCourse`, so a brand-new student never sees the first-run
        // picker — they already answered it. Stamped as "prompted" too.
        ...(normalizeStudyMode(input.studyMode)
          ? {
              studyMode: normalizeStudyMode(input.studyMode)!,
              studyModePromptedAt: new Date().toISOString(),
            }
          : {}),
      });
    } catch (err) {
      console.error('[profile-actions] Failed to persist onboarding updates to DB:', err);
    }
  }

  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${current.id}`, 'max');
  revalidateTag('progress', 'max');
  revalidateTag(`progress-user:${current.id}`, 'max');
  revalidatePath('/onboarding');
  revalidatePath('/', 'layout');
  return updated;
}

/**
 * First-time account setup collected during onboarding:
 *  - a unique student mobile number (all students),
 *  - a password for users who signed up via Google (passwordSet === false); OTP
 *    is skipped because Google already verified the email.
 * Returns a validation error instead of throwing so the form can surface it.
 */
export async function completeAccountSetupAction(input: {
  mobile: string;
  password?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const current = await requireUser();

  const mobile = normalizeMobile(input.mobile);
  if (!mobile) {
    return { ok: false, error: 'Enter a valid 10-digit mobile number.' };
  }

  // A password is required only when the user hasn't set one yet (Google signups).
  const needsPassword = current.passwordSet === false;
  const password = input.password ?? '';
  if (needsPassword && password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  if (!isUserPostgresConfigured()) {
    return { ok: false, error: 'Account storage is not configured.' };
  }

  try {
    if (await dbMobileInUse(mobile, current.id)) {
      return { ok: false, error: 'This mobile number is already registered.' };
    }
    const patch: Record<string, unknown> = { mobile };
    if (needsPassword) {
      patch.password = bcrypt.hashSync(password, 10);
      patch.passwordSet = true;
    }
    await dbUpdateUser(current.id, patch);
  } catch (error) {
    console.error('[completeAccountSetupAction]', error);
    return { ok: false, error: 'Could not save your details. Please try again.' };
  }

  revalidateTag('auth-user', 'max');
  revalidateTag(`user:${current.id}`, 'max');
  revalidatePath('/', 'layout');
  return { ok: true };
}
