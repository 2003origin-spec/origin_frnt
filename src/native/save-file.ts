/**
 * Bridge-aware file saving. Client-side blob/dataURL downloads (downloadjs,
 * `<a download>` + createObjectURL) silently do nothing inside an Android
 * WebView — blob: URLs never reach the shell's DownloadListener (plan ledger
 * #26). Call sites do:
 *
 *   if (await saveFileNative(name, mime, data)) return; // shell handled it
 *   // ...existing browser download path unchanged...
 *
 * Returns false in browsers, on old shells without the capability, on
 * oversized payloads, or on any bridge failure — the caller's web path is
 * always the fallback.
 */

import { getOriginNative, hasNativeCapability } from "@/native/bridge";

/** Bridge messages are JSON-serialized strings; keep payloads sane. */
const MAX_BRIDGE_FILE_BYTES = 25 * 1024 * 1024;

function dataUrlToBase64(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex === -1) return null;
  if (!dataUrl.slice(0, commaIndex).includes(";base64")) return null;
  return dataUrl.slice(commaIndex + 1);
}

function blobToBase64(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      resolve(result ? dataUrlToBase64(result) : null);
    };
    reader.readAsDataURL(blob);
  });
}

export async function saveFileNative(
  name: string,
  mime: string,
  data: Blob | string,
): Promise<boolean> {
  if (!(await hasNativeCapability("saveFile"))) return false;

  let base64: string | null;
  if (typeof data === "string") {
    base64 = dataUrlToBase64(data);
  } else {
    if (data.size > MAX_BRIDGE_FILE_BYTES) return false;
    base64 = await blobToBase64(data);
  }
  if (!base64) return false;
  // base64 inflates ~4/3 over raw bytes; re-check for the string path too.
  if (base64.length > (MAX_BRIDGE_FILE_BYTES * 4) / 3) return false;

  try {
    await getOriginNative()?.saveFile({ name, mime, base64 });
    return true;
  } catch {
    return false;
  }
}
