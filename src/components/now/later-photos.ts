/** Uploads one Ask later photo (B94) to the private bucket through a 15-minute signed link; returns its key. */

import { apiCall } from '@/lib/api';

export const LATER_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const LATER_MAX_PHOTOS = 3;

export async function uploadLaterPhoto(file: File, laterId: string | null = null): Promise<string> {
  const ticket = (await apiCall('/now/later/uploads', {
    method: 'POST',
    body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size, laterId }),
  })) as { uploadUrl: string; objectKey: string; contentType: string };
  const put = await fetch(ticket.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': ticket.contentType } });
  if (!put.ok) throw new Error(`The photo did not upload (${put.status}). Try again.`);
  return ticket.objectKey;
}
