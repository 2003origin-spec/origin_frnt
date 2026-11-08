/**
 * Private R2 bucket (V1/PRIVATE_R2_BUCKET_PLAN.md): private files (import
 * sources, proctor frames, Origin NOW KYC + store papers) must never land in
 * the public image bucket, and public images must not change. Phase 3: a
 * presigned upload is signed for the file's type and exact size.
 */

import { createHash } from "node:crypto";
import test, { mock } from "node:test";
import assert from "node:assert/strict";

import type { Pool } from "pg";

import {
  createImportUploadObjectKey,
  createImportUploadToken,
  createPresignedR2PutUrl,
  deleteR2Object,
  isImportUploadObjectKey,
  MAX_IMPORT_DOCUMENT_BYTES,
  parseListObjectsV2,
  presignImportUpload,
  privateR2BucketName,
  uploadImageToR2,
  uploadImportDocumentToR2,
  uploadStudyMaterialToR2,
  verifyImportUploadToken,
} from "../src/server/media-storage";
import { MAX_PROCTOR_SNAPSHOT_BYTES, presignProctorSnapshot } from "../src/server/contest/contest-proctor-service";
import { copyMatches, isPrivateObjectKey, runPrivateObjectMove } from "../src/server/r2-private-migration";
import { AuthzError } from "../src/server/authz";
import { createImportJob } from "../src/server/workspaces/document-import-service";

// AWS's published example credentials — not real secrets.
const R2_TEST_ENV: Record<string, string> = {
  R2_ACCESS_KEY_ID: "AKIDEXAMPLE",
  R2_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  R2_ENDPOINT: "https://acct123.r2.cloudflarestorage.com",
  R2_BUCKET_NAME: "origin",
  R2_PRIVATE_BUCKET: "origin-private",
  R2_PUBLIC_BASE_URL: "https://media.example.com",
};
const R2_ENV_NAMES = [...Object.keys(R2_TEST_ENV), "R2_ENDPOINT_URL", "R2_ACCOUNT_ID"];

async function withR2Env(overrides: Record<string, string | undefined>, run: () => unknown): Promise<void> {
  const saved = new Map(R2_ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const name of R2_ENV_NAMES) delete process.env[name];
  for (const [name, value] of Object.entries({ ...R2_TEST_ENV, ...overrides })) {
    if (value !== undefined) process.env[name] = value;
  }
  try {
    await run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

type Captured = { url: string; method: string; headers: Headers };

async function captureR2Fetch(run: () => Promise<unknown>): Promise<Captured[]> {
  const original = globalThis.fetch;
  const calls: Captured[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", headers: new Headers(init?.headers) });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
  return calls;
}

const pathOf = (url: string) => new URL(url).pathname;

test("the private bucket has no fallback to the public bucket", async () => {
  await withR2Env({ R2_PRIVATE_BUCKET: undefined }, () => {
    assert.throws(() => privateR2BucketName(), /R2_PRIVATE_BUCKET is required/);
    assert.throws(
      () =>
        createPresignedR2PutUrl({
          objectKey: "contest-proctor/c_1/u_1/1-abc.jpg",
          contentType: "image/jpeg",
          contentLength: 18_000,
        }),
      /R2_PRIVATE_BUCKET is required/,
    );
  });
  await withR2Env({ R2_PRIVATE_BUCKET: "origin" }, () => {
    assert.throws(() => privateR2BucketName(), /must not be the public image bucket/);
  });
});

test("signed links default to the private bucket; an explicit bucket still wins", async () => {
  await withR2Env({}, () => {
    const kyc = createPresignedR2PutUrl({ objectKey: "origin-now/kyc/u_1/pan-1.pdf", method: "GET" });
    assert.equal(kyc.bucket, "origin-private");
    assert.equal(pathOf(kyc.url), "/origin-private/origin-now/kyc/u_1/pan-1.pdf");

    const recording = createPresignedR2PutUrl({
      objectKey: "origin-now/recordings/s_1.ogg",
      bucket: "origin-recordings",
      method: "GET",
    });
    assert.equal(pathOf(recording.url), "/origin-recordings/origin-now/recordings/s_1.ogg");
  });
});

test("deletes default to the private bucket", async () => {
  await withR2Env({}, async () => {
    const calls = await captureR2Fetch(async () => {
      await deleteR2Object({ objectKey: "origin-now/kyc/u_1/pan-1.pdf" });
      await deleteR2Object({ bucket: "origin", objectKey: "imports/uploads/x/old.pdf" });
    });
    assert.deepEqual(
      calls.map((call) => [call.method, pathOf(call.url)]),
      [
        ["DELETE", "/origin-private/origin-now/kyc/u_1/pan-1.pdf"],
        ["DELETE", "/origin/imports/uploads/x/old.pdf"],
      ],
    );
  });
});

test("the delete request is signed exactly as before the signer was shared", async () => {
  // Golden value recorded from the previous deleteR2Object implementation.
  await withR2Env({}, async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-18T09:30:00.000Z") });
    try {
      const [call] = await captureR2Fetch(() =>
        deleteR2Object({ bucket: "origin-private", objectKey: "contest-proctor/c_1/u_1/1700000000000-abc123.jpg" }),
      );
      assert.equal(call.url, "https://acct123.r2.cloudflarestorage.com/origin-private/contest-proctor/c_1/u_1/1700000000000-abc123.jpg");
      assert.equal(call.headers.get("x-amz-date"), "20261018T093000Z");
      assert.equal(
        call.headers.get("authorization"),
        "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20261018/auto/s3/aws4_request, " +
          "SignedHeaders=host;x-amz-content-sha256;x-amz-date, " +
          "Signature=581a313edccbdd85f8fe57b3b8ce538daf45ba1cf88ea4128771fdec1249d33b",
      );
    } finally {
      mock.timers.reset();
    }
  });
});

test("import sources upload to the private bucket and get no public URL", async () => {
  await withR2Env({}, async () => {
    let result: Awaited<ReturnType<typeof uploadImportDocumentToR2>> | undefined;
    const calls = await captureR2Fetch(async () => {
      result = await uploadImportDocumentToR2({
        jobId: "dijob_1",
        fileName: "Paper 1.pdf",
        mimeType: "application/pdf",
        body: Buffer.from("%PDF-1.7"),
      });
    });
    assert.equal(pathOf(calls[0].url), "/origin-private/imports/dijob_1/Paper_1.pdf");
    assert.equal(result?.bucket, "origin-private");
    assert.equal(result?.publicUrl, "r2://origin-private/imports/dijob_1/Paper_1.pdf");
  });
});

test("public uploads are unchanged and don't need the private bucket", async () => {
  await withR2Env({ R2_PRIVATE_BUCKET: undefined }, async () => {
    let avatarUrl = "";
    let materialUrl = "";
    const calls = await captureR2Fetch(async () => {
      avatarUrl = (
        await uploadImageToR2({
          userId: "u_1",
          purpose: "profile_avatar",
          fileName: "me.png",
          mimeType: "image/png",
          body: Buffer.from("png"),
        })
      ).publicUrl;
      materialUrl = (
        await uploadStudyMaterialToR2({
          workspaceId: "ws_1",
          batchId: "b_1",
          fileName: "notes.pdf",
          mimeType: "application/pdf",
          body: Buffer.from("%PDF-1.7"),
        })
      ).publicUrl;
    });
    assert.ok(calls.every((call) => pathOf(call.url).startsWith("/origin/")));
    assert.match(avatarUrl, /^https:\/\/media\.example\.com\/profile_avatar\/u_1\//u);
    assert.match(materialUrl, /^https:\/\/media\.example\.com\/study_material\/ws_1\/b_1\//u);
  });
});

test("import jobs accept only keys made by the import presign route", () => {
  const uuid = "3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e";
  assert.equal(isImportUploadObjectKey(createImportUploadObjectKey("My Paper (1).pdf")), true);
  assert.equal(isImportUploadObjectKey(`imports/uploads/${uuid}/paper.pdf`), true);

  for (const key of [
    `origin-now/kyc/u_1/aadhaar_masked-${uuid}.jpg`,
    "contest-proctor/c_1/u_1/1700000000000-abc123.jpg",
    "imports/dijob_1/paper.pdf",
    "imports/uploads/not-a-uuid/paper.pdf",
    `imports/uploads/${uuid}/../../origin-now/kyc/u_1/pan.pdf`,
    `imports/uploads/${uuid}/..`,
    `imports/uploads/${uuid}/a/b.pdf`,
    "",
  ]) {
    assert.equal(isImportUploadObjectKey(key), false, key);
  }
});

test("creating an import job from another object's key is refused before any DB work", async () => {
  await withR2Env({}, async () => {
    const objectKey = "origin-now/kyc/u_1/pan-3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e.pdf";
    await assert.rejects(
      createImportJob({
        workspaceId: "ws_1",
        userId: "u_1",
        sourceType: "pdf",
        fileName: "pan.pdf",
        // Even a genuine token for that key doesn't make a non-import key acceptable.
        sourceR2: { objectKey, uploadToken: createImportUploadToken("u_1", objectKey) },
        triggerPipeline: false,
      }),
      /not uploaded through the import upload link/,
    );
  });
});

test("creating an import job needs the upload token the presign route issued to this user", async () => {
  await withR2Env({}, async () => {
    const objectKey = createImportUploadObjectKey("paper.pdf");
    const attempt = (uploadToken: unknown, userId = "u_1") =>
      createImportJob({
        workspaceId: "ws_1",
        userId,
        sourceType: "pdf",
        fileName: "paper.pdf",
        sourceR2: { objectKey, uploadToken: uploadToken as string },
        triggerPipeline: false,
      });
    const refused = (error: unknown) =>
      error instanceof AuthzError && error.status === 403 && /not issued to you or has expired/u.test(error.message);

    // No token (a tab from before tokens existed), a forged one, someone else's,
    // one for another key, and an expired one: all 403 before any DB work.
    await assert.rejects(attempt(undefined), refused);
    await assert.rejects(attempt(""), refused);
    await assert.rejects(attempt("1800000000000.deadbeef"), refused);
    await assert.rejects(attempt(createImportUploadToken("u_2", objectKey)), refused);
    await assert.rejects(attempt(createImportUploadToken("u_1", objectKey), "u_2"), refused);
    await assert.rejects(attempt(createImportUploadToken("u_1", createImportUploadObjectKey("paper.pdf"))), refused);
    await assert.rejects(attempt(createImportUploadToken("u_1", objectKey, Date.now() - 11 * 60 * 1000)), refused);
    // A genuine token gets past both guards: the next step is the workspace
    // membership lookup, which has no database in this test.
    await assert.rejects(attempt(createImportUploadToken("u_1", objectKey)), (error: unknown) => !refused(error));
  });
});

test("the move script takes private folders and leaves public question diagrams", () => {
  for (const key of [
    "imports/uploads/3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e/paper.pdf",
    "imports/dijob_1/paper.pdf",
    "contest-proctor/c_1/u_1/1700000000000-abc123.jpg",
    "origin-now/kyc/u_1/pan-1.pdf",
    "origin-now/store/sitem_1/0011223344556677.pdf",
    "origin-now/recordings/s_1.ogg",
  ]) {
    assert.equal(isPrivateObjectKey(key), true, key);
  }
  for (const key of [
    "imports/dijob_1/diagrams/q_0.png",
    "profile_avatar/u_1/2026/10/a.png",
    "study_material/ws_1/b_1/2026/10/x.pdf",
    "doubt-solver/abc/s_1/x.png",
    "q_maths_bc472d71.png",
  ]) {
    assert.equal(isPrivateObjectKey(key), false, key);
  }
});

test("a public copy is only deleted when the private copy matches", () => {
  const source = { key: "imports/dijob_1/paper.pdf", sizeBytes: 10, etag: '"abc"' };
  assert.equal(copyMatches(source, { sizeBytes: 10, etag: '"abc"' }), true);
  assert.equal(copyMatches(source, { sizeBytes: 10, etag: '"def"' }), false);
  assert.equal(copyMatches(source, { sizeBytes: 9, etag: '"abc"' }), false);
  // Multipart ETags differ after a copy, so only the size can be compared.
  assert.equal(copyMatches({ ...source, etag: '"abc-2"' }, { sizeBytes: 10, etag: '"xyz"' }), true);
});

test("bucket listings are parsed with XML escapes and paging", () => {
  const page = parseListObjectsV2(
    `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><IsTruncated>true</IsTruncated>` +
      `<Contents><Key>imports/dijob_1/a&amp;b.pdf</Key><Size>12</Size><ETag>&quot;e1&quot;</ETag></Contents>` +
      `<Contents><Key>contest-proctor/c/u/1.jpg</Key><Size>3</Size><ETag>"e2"</ETag></Contents>` +
      `<NextContinuationToken>tok/1+</NextContinuationToken></ListBucketResult>`,
  );
  assert.deepEqual(page.objects, [
    { key: "imports/dijob_1/a&b.pdf", sizeBytes: 12, etag: '"e1"' },
    { key: "contest-proctor/c/u/1.jpg", sizeBytes: 3, etag: '"e2"' },
  ]);
  assert.equal(page.nextContinuationToken, "tok/1+");

  const last = parseListObjectsV2("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>");
  assert.deepEqual(last, { objects: [], nextContinuationToken: null });
});

/** In-memory stand-in for the R2 S3 API: list (2 per page), HEAD, copy, DELETE. */
function fakeR2(initial: Record<string, Record<string, string>>) {
  const buckets = new Map(Object.entries(initial).map(([name, objects]) => [name, new Map(Object.entries(objects))]));
  const etag = (body: string) => `"${createHash("md5").update(body).digest("hex")}"`;
  const bucket = (name: string) => buckets.get(name) ?? buckets.set(name, new Map()).get(name)!;
  const writes: string[] = [];

  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const [bucketName, ...keyParts] = url.pathname.slice(1).split("/").map(decodeURIComponent);
    const objects = bucket(bucketName);
    const key = keyParts.join("/");

    if (method === "GET" && !key) {
      const prefix = url.searchParams.get("prefix") ?? "";
      const start = Number(url.searchParams.get("continuation-token") ?? 0);
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      const page = keys.slice(start, start + 2);
      const more = start + 2 < keys.length;
      const contents = page
        .map((k) => `<Contents><Key>${k}</Key><Size>${objects.get(k)!.length}</Size><ETag>${etag(objects.get(k)!).replace(/"/gu, "&quot;")}</ETag></Contents>`)
        .join("");
      return new Response(
        `<ListBucketResult><IsTruncated>${more}</IsTruncated>${contents}${more ? `<NextContinuationToken>${start + 2}</NextContinuationToken>` : ""}</ListBucketResult>`,
      );
    }
    if (method === "HEAD") {
      const body = objects.get(key);
      if (body === undefined) return new Response(null, { status: 404 });
      return new Response(null, { headers: { "content-length": String(body.length), etag: etag(body) } });
    }
    if (method === "PUT") {
      const source = new Headers(init?.headers).get("x-amz-copy-source") ?? "";
      const [fromBucket, ...fromKey] = source.split("/").map(decodeURIComponent);
      objects.set(key, bucket(fromBucket).get(fromKey.join("/"))!);
      writes.push(`copy ${bucketName}/${key}`);
      return new Response("<CopyObjectResult></CopyObjectResult>");
    }
    if (method === "DELETE") {
      objects.delete(key);
      writes.push(`delete ${bucketName}/${key}`);
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 400 });
  }) as typeof fetch;

  return { buckets, writes, fetchImpl };
}

test("the move script copies, verifies, and only then deletes public copies", async () => {
  const upload = "imports/uploads/3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e/paper.pdf";
  const r2 = fakeR2({
    origin: {
      [upload]: "PAPER",
      "imports/dijob_1/notes.pdf": "NOTES",
      "imports/dijob_1/diagrams/q_0.png": "DIAGRAM",
      "contest-proctor/c_1/u_1/1-abc.jpg": "FRAME",
      "origin-now/kyc/u_1/pan-1.pdf": "PAN",
      "profile_avatar/u_1/a.png": "AVATAR",
    },
  });
  const queries: { sql: string; params?: unknown[] }[] = [];
  const db = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      return sql.includes("to_regclass")
        ? { rows: [{ t: "import.document_import_jobs" }], rowCount: 1 }
        : { rows: [], rowCount: 1 };
    },
  } as unknown as Pick<Pool, "query">;

  const original = globalThis.fetch;
  globalThis.fetch = r2.fetchImpl;
  try {
    await withR2Env({}, async () => {
      const dry = await runPrivateObjectMove("dry-run");
      assert.deepEqual(
        Object.fromEntries(Object.entries(dry.byPrefix).map(([prefix, stats]) => [prefix, stats.objects])),
        { "imports/": 2, "contest-proctor/": 1, "origin-now/": 1 },
      );
      assert.equal(dry.keptPublicDiagrams, 1);
      assert.deepEqual(r2.writes, []);

      const copy = await runPrivateObjectMove("copy");
      assert.equal(copy.copied, 4);
      assert.deepEqual(copy.failures, []);
      assert.equal(r2.buckets.get("origin-private")!.get(upload), "PAPER");
      assert.equal(r2.buckets.get("origin")!.size, 6, "copy must not delete anything");

      const again = await runPrivateObjectMove("copy");
      assert.deepEqual([again.copied, again.alreadyCopied], [0, 4]);

      // A private copy that no longer matches must keep its public original.
      r2.buckets.get("origin-private")!.set("origin-now/kyc/u_1/pan-1.pdf", "PAN-CHANGED");
      const done = await runPrivateObjectMove("delete-public", { db });
      assert.deepEqual([done.deleted, done.notCopiedYet], [3, 1]);
      assert.deepEqual(
        [...r2.buckets.get("origin")!.keys()].sort(),
        ["imports/dijob_1/diagrams/q_0.png", "origin-now/kyc/u_1/pan-1.pdf", "profile_avatar/u_1/a.png"],
      );
      assert.deepEqual(
        queries.filter((q) => q.sql.includes("UPDATE")).map((q) => q.params),
        [
          ["origin-private", "origin", "imports/dijob_1/notes.pdf"],
          ["origin-private", "origin", upload],
        ],
      );
    });
  } finally {
    globalThis.fetch = original;
  }
});

// Phase 3 — upload limits. The golden links below are byte-identical to what
// botocore 1.43.114 (S3SigV4QueryAuth, region "auto") gives for the same
// request, credentials and time, so R2's standard SigV4 check accepts them.
const SIGNED_AT = new Date("2026-10-18T09:30:00.000Z");

async function withR2EnvAt(run: () => void): Promise<void> {
  await withR2Env({}, () => {
    mock.timers.enable({ apis: ["Date"], now: SIGNED_AT });
    try {
      run();
    } finally {
      mock.timers.reset();
    }
  });
}

const signedHeadersOf = (url: string) => new URL(url).searchParams.get("X-Amz-SignedHeaders");

test("GET links are unchanged: signed for host only, no headers to send", async () => {
  await withR2EnvAt(() => {
    const link = createPresignedR2PutUrl({
      objectKey: "contest-proctor/c_1/u_1/1700000000000-abc123.jpg",
      method: "GET",
      expiresSeconds: 900,
    });
    // Recorded from the code before this change (5c4dec77).
    assert.equal(
      link.url,
      "https://acct123.r2.cloudflarestorage.com/origin-private/contest-proctor/c_1/u_1/1700000000000-abc123.jpg" +
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIDEXAMPLE%2F20261018%2Fauto%2Fs3%2Faws4_request" +
        "&X-Amz-Date=20261018T093000Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host" +
        "&X-Amz-Signature=2fb9e5d1462d3620417dca1061d0caa8e485fc58a6bbe2d571f9e0e45a1112c4",
    );
    assert.deepEqual(link.headers, {});
  });
});

test("a presigned PUT is signed for its Content-Type and exact size", async () => {
  await withR2EnvAt(() => {
    const link = createPresignedR2PutUrl({
      objectKey: "imports/uploads/9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f/paper.pdf",
      expiresSeconds: 600,
      contentType: "application/pdf",
      contentLength: 5_242_880,
    });
    assert.equal(
      link.url,
      "https://acct123.r2.cloudflarestorage.com/origin-private/imports/uploads/9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f/paper.pdf" +
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIDEXAMPLE%2F20261018%2Fauto%2Fs3%2Faws4_request" +
        "&X-Amz-Date=20261018T093000Z&X-Amz-Expires=600&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost" +
        "&X-Amz-Signature=25f72be67cca97989ac17e761159130c2c25cb41c5c2b23004cf14074be1cf95",
    );
    // The browser sends this; it sets Content-Length from the body itself.
    assert.deepEqual(link.headers, { "Content-Type": "application/pdf" });
  });
});

test("a link signed for one type or size is not the link for another", async () => {
  await withR2EnvAt(() => {
    const sign = (contentType: string, contentLength: number) =>
      createPresignedR2PutUrl({ objectKey: "contest-proctor/c_1/u_1/1700000000000-abc123.jpg", expiresSeconds: 300, contentType, contentLength }).url;
    // botocore gives this URL's signature for image/jpeg, 18000 bytes.
    assert.match(sign("image/jpeg", 18_000), /&X-Amz-Signature=f3e03673e8737f475f76f6520191cbff73bbfc84cf65015b84c63173e8bf1f5e$/);
    const links = new Set([sign("image/jpeg", 18_000), sign("image/jpeg", 18_001), sign("image/jpeg", 17_999), sign("image/png", 18_000)]);
    assert.equal(links.size, 4);
  });
});

test("a PUT link needs a plain Content-Type and a whole, positive size", async () => {
  await withR2Env({}, () => {
    const objectKey = "imports/uploads/9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f/paper.pdf";
    for (const contentLength of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(
        () => createPresignedR2PutUrl({ objectKey, contentType: "application/pdf", contentLength }),
        /needs the file size in bytes/,
        String(contentLength),
      );
    }
    for (const contentType of ["", "pdf", " application/pdf", "application/pdf; charset=binary", "image/png\nx-amz-acl:public-read"]) {
      assert.throws(
        () => createPresignedR2PutUrl({ objectKey, contentType, contentLength: 10 }),
        /needs a plain Content-Type/,
        JSON.stringify(contentType),
      );
    }
  });
});

test("an import upload is signed for its type and size, up to 25 MB", async () => {
  await withR2EnvAt(() => {
    const ticket = presignImportUpload({ fileName: "Physics Paper (1).PDF", mimeType: "Application/PDF", size: 5_000_000 }, "u_1");
    assert.equal(ticket.bucket, "origin-private");
    assert.equal(isImportUploadObjectKey(ticket.objectKey), true);
    // The token binds this key to the teacher who asked for the link.
    assert.equal(verifyImportUploadToken(ticket.uploadToken, "u_1", ticket.objectKey), true);
    assert.equal(verifyImportUploadToken(ticket.uploadToken, "u_2", ticket.objectKey), false);
    assert.throws(() => presignImportUpload({ mimeType: "application/pdf", size: 1_000 }, ""), /signed-in user/);
    assert.deepEqual(ticket.uploadHeaders, { "Content-Type": "application/pdf" });
    assert.equal(signedHeadersOf(ticket.uploadUrl), "content-length;content-type;host");
    // Exactly the link for this key, type and size.
    const expected = (contentLength: number) =>
      createPresignedR2PutUrl({ objectKey: ticket.objectKey, expiresSeconds: 600, contentType: "application/pdf", contentLength }).url;
    assert.equal(ticket.uploadUrl, expected(5_000_000));
    assert.notEqual(ticket.uploadUrl, expected(5_000_001));

    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    assert.deepEqual(presignImportUpload({ mimeType: docx, size: MAX_IMPORT_DOCUMENT_BYTES }, "u_1").uploadHeaders, { "Content-Type": docx });
    assert.throws(() => presignImportUpload({ mimeType: docx, size: MAX_IMPORT_DOCUMENT_BYTES + 1 }, "u_1"), /too large \(max 25 MB\)/);
    assert.throws(() => presignImportUpload({ mimeType: "application/zip", size: 1_000 }, "u_1"), /Only PDF, DOCX/);
    // A tab opened before sizes were signed sends none.
    for (const size of [undefined, null, "5000000", 0, -5, 2.5]) {
      assert.throws(() => presignImportUpload({ mimeType: "application/pdf", size }, "u_1"), /size is missing/, String(size));
    }
  });
});

test("a proctor photo is signed as image/jpeg for its exact size, up to 256 KB", async () => {
  await withR2EnvAt(() => {
    const ticket = presignProctorSnapshot("c_1", "u_1", 18_000);
    assert.match(ticket.r2Key, /^contest-proctor\/c_1\/u_1\/\d+-[a-z0-9]+\.jpg$/);
    assert.equal(ticket.bucket, "origin-private");
    assert.deepEqual(ticket.uploadHeaders, { "Content-Type": "image/jpeg" });
    assert.equal(
      ticket.uploadUrl,
      createPresignedR2PutUrl({ objectKey: ticket.r2Key, expiresSeconds: 300, contentType: "image/jpeg", contentLength: 18_000 }).url,
    );

    assert.equal(signedHeadersOf(presignProctorSnapshot("c_1", "u_1", MAX_PROCTOR_SNAPSHOT_BYTES).uploadUrl), "content-length;content-type;host");
    for (const size of [0, 1.5, MAX_PROCTOR_SNAPSHOT_BYTES + 1]) {
      assert.throws(() => presignProctorSnapshot("c_1", "u_1", size), /between 1 byte and 256 KB/, String(size));
    }
  });
});
