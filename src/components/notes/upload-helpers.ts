/**
 * Origin Notes — browser-side upload helpers shared by the admin library and
 * My Notes (V1/NOTES_PLAN.md §3, §8).
 */

/** PUT a file to a signed link with upload progress (fetch can't report upload progress). */
export function putWithProgress(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection, or the storage CORS settings.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/** Page count of a PDF, read in the browser with pdf.js (null when it can't be read). */
export async function pdfPageCount(file: Blob): Promise<number | null> {
  if (file.type !== 'application/pdf') return null;
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const pages = doc.numPages;
    void doc.destroy();
    return pages;
  } catch {
    return null;
  }
}

/** Length of an audio or video file in seconds (null when the browser can't tell). */
export function mediaDuration(file: Blob): Promise<number | null> {
  const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : null;
  if (!kind || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const element = document.createElement(kind);
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      element.removeAttribute('src');
      resolve(value);
    };
    const timer = window.setTimeout(() => done(null), 8000);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(Number.isFinite(element.duration) && element.duration > 0 ? element.duration : null);
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      done(null);
    };
    element.src = url;
  });
}

/**
 * Shrinks a photo so its long side is at most `maxSide` px (JPEG, quality
 * 0.85), keeping the camera's orientation. Small photos and anything the
 * browser can't decode go through unchanged.
 */
export async function shrinkPhoto(file: File, maxSide = 2000): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    // JPEG has no transparency: paint white first so PNG cut-outs don't turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/u, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
