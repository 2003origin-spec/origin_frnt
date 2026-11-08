/**
 * Live check that R2 enforces the headers a presigned PUT is signed for
 * (V1/PRIVATE_R2_BUCKET_PLAN.md, Phase 3 — upload limits). Unit tests pin the
 * signature; only live R2 can show it is accepted, and that a different type or
 * size is refused.
 *
 * Signs one PUT for a 1 KB PDF in R2_PRIVATE_BUCKET and tries it four ways:
 *   other Content-Type    → expect 403
 *   one byte more         → expect 403
 *   one byte less         → expect 403
 *   right type and size   → expect 200
 * then checks the stored size and deletes the test object. Nothing else in the
 * bucket is touched.
 *
 * Usage (secrets only at run time, never committed):
 *   cd new-frontend
 *   npx tsx --env-file=<env file> scripts/smoke-r2-signed-put.ts
 *
 * Needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT (or R2_ENDPOINT_URL /
 * R2_ACCOUNT_ID), R2_BUCKET_NAME and R2_PRIVATE_BUCKET. It runs from Node, so it
 * does not check the bucket's CORS rule; a browser upload does.
 */

import { randomUUID } from "node:crypto";

import { createPresignedR2PutUrl, deleteR2Object, headR2Object, privateR2BucketName } from "@/server/media-storage";

const SIZE = 1024;
const TYPE = "application/pdf";

// Refusals first, so the object only exists after the last attempt.
const ATTEMPTS = [
  { name: "other Content-Type", contentType: "image/png", bytes: SIZE, expect: 403 },
  { name: "one byte more", contentType: TYPE, bytes: SIZE + 1, expect: 403 },
  { name: "one byte less", contentType: TYPE, bytes: SIZE - 1, expect: 403 },
  { name: "right type and size", contentType: TYPE, bytes: SIZE, expect: 200 },
];

function line(ok: boolean, name: string, got: string, expected: string | number): string {
  return `  ${ok ? "ok  " : "FAIL"} ${name.padEnd(20)} -> ${got} (expected ${expected})`;
}

async function main() {
  const bucket = privateR2BucketName();
  const objectKey = `smoke-tests/signed-put-${randomUUID()}.pdf`;
  const signed = createPresignedR2PutUrl({ objectKey, expiresSeconds: 300, contentType: TYPE, contentLength: SIZE });
  console.log(`\n[r2 smoke] bucket "${bucket}", key ${objectKey}`);
  console.log(`[r2 smoke] link signed for ${TYPE}, ${SIZE} bytes\n`);

  let failures = 0;
  try {
    for (const attempt of ATTEMPTS) {
      // Node's fetch sets Content-Length from the body, as a browser does.
      const response = await fetch(signed.url, {
        method: "PUT",
        headers: { "Content-Type": attempt.contentType },
        body: new Uint8Array(attempt.bytes),
      });
      const body = await response.text().catch(() => "");
      const code = /<Code>([^<]+)<\/Code>/u.exec(body)?.[1];
      const ok = response.status === attempt.expect;
      if (!ok) failures += 1;
      console.log(line(ok, attempt.name, `${response.status}${code ? ` ${code}` : ""}`, attempt.expect));
    }
    const stored = await headR2Object({ bucket, objectKey });
    const sizeOk = stored?.sizeBytes === SIZE;
    if (!sizeOk) failures += 1;
    console.log(line(sizeOk, "stored size", stored ? String(stored.sizeBytes) : "missing", SIZE));
  } finally {
    await deleteR2Object({ bucket, objectKey });
    console.log("\n[r2 smoke] test object deleted.");
  }

  if (failures > 0) {
    console.error(`[r2 smoke] ${failures} check(s) failed. Don't deploy the signed-upload change until they pass.`);
    process.exit(1);
  }
  console.log("[r2 smoke] R2 accepts the signed type and size and refuses anything else.");
  process.exit(0);
}

main().catch((error) => {
  console.error("[r2 smoke] failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
