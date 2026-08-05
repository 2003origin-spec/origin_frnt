import download from 'downloadjs';
import { saveFileNative } from '@/native/save-file';
import { getCanonicalSiteUrl } from '@/lib/site-url';

/**
 * Image sharing that actually delivers the image.
 *
 * The hard platform truth: you CANNOT pre-attach an image to WhatsApp / X /
 * Telegram via a `wa.me?text=` / intent URL — those carry TEXT ONLY. The only
 * web mechanism that attaches an image is the native share sheet
 * (`navigator.share` with `files`, i.e. Web Share API Level 2), which every
 * modern mobile browser + the Android WebView support. So we always TRY the
 * native file-share first (it lets the user pick WhatsApp/Instagram/anything
 * with the image attached). Only when that's unavailable (mostly desktop) do we
 * fall back to saving the image + opening the target's text link, so the user
 * can attach the saved file manually.
 */

export type ShareTarget = 'whatsapp' | 'twitter' | 'telegram' | 'facebook';
export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

async function urlToFile(imageUrl: string, fileName: string): Promise<File> {
  const blob = await (await fetch(imageUrl)).blob();
  return new File([blob], fileName, { type: blob.type || 'image/png' });
}

/** Save an image via the native bridge (Android app) or a browser download. */
export async function saveImage(imageUrl: string, fileName: string): Promise<void> {
  // Android shell: blob/dataURL downloads no-op in a WebView — use the bridge.
  if (await saveFileNative(fileName, 'image/png', imageUrl)) return;
  download(imageUrl, fileName);
}

function targetTextUrl(target: ShareTarget, text: string): string {
  const enc = encodeURIComponent(text);
  const site = encodeURIComponent(getCanonicalSiteUrl());
  switch (target) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${enc}`;
    case 'telegram':
      return `https://t.me/share/url?url=${site}&text=${enc}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${site}&quote=${enc}`;
    case 'whatsapp':
    default:
      return `https://wa.me/?text=${enc}`;
  }
}

/**
 * Share an image with a caption. Returns:
 *  - 'shared'     → went through the native sheet (image attached)
 *  - 'downloaded' → no native share; image saved + the target link opened (or
 *                   just saved when no `target`), so the user attaches it
 *  - 'cancelled'  → user dismissed the native sheet
 *  - 'failed'     → nothing worked
 */
export async function shareImage(opts: {
  imageUrl: string;
  fileName: string;
  title?: string;
  text: string;
  /** Text-link fallback platform when native file-share is unavailable. */
  target?: ShareTarget;
}): Promise<ShareResult> {
  const { imageUrl, fileName, title, text, target } = opts;

  // 1. Native file-share — the only path that attaches the image.
  try {
    const file = await urlToFile(imageUrl, fileName);
    const data: ShareData = { files: [file], title, text };
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare(data)
    ) {
      await navigator.share(data);
      return 'shared';
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    // otherwise fall through to the save + link fallback
  }

  // 2. No native file-share (desktop / old WebView): save the image so the user
  //    has it, then open the target's text link so they can attach it.
  try {
    await saveImage(imageUrl, fileName);
    if (target) window.open(targetTextUrl(target, text), '_blank', 'noopener');
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
