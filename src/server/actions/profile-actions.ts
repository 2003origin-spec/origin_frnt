'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

import { getServerUser } from '@/lib/auth-server';
import { withStoreAsync } from '@/server/store';
import { serializeUser } from '@/server/users';
import { isUserPostgresConfigured } from '@/server/user-postgres';
import { dbCreateMediaAsset, dbUpdateUser } from '@/server/db-users';
import { uploadImageToR2, type UserImagePurpose } from '@/server/media-storage';
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
  location: string;
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
]);
const MAX_USER_IMAGE_BYTES = 10 * 1024 * 1024;

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error('Not authenticated.');
  return user;
}

async function applyProfileUpdates(userId: string, input: UpdateProfileInput): Promise<User | null> {
  return withStoreAsync(async (store) => {
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

    const serialized = serializeUser(store, userId);
    return (serialized as unknown as User) ?? null;
  });
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
      await dbUpdateUser(current.id, {
        name: input.name,
        studentClass: input.studentClass ?? input.class ?? input.student_class,
        fieldOfInterest: input.fieldOfInterest,
        referralSource: input.referralSource,
        avatar: input.avatar,
        selectedCourse: input.selectedCourse,
        yearsOfExperience: input.yearsOfExperience,
        studentCapacity: input.studentCapacity,
        location: input.location,
      });
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
