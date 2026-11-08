/**
 * Import upload tokens (docs/bug-fixes/02-uploads-services.md, U1 c): the
 * presign route hands the browser an HMAC over (userId, objectKey, expiry);
 * the job-create step accepts the key only with that token, so a presigned
 * key can be registered only by the user it was issued to, and only while
 * the upload link is alive.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createImportUploadObjectKey,
  createImportUploadToken,
  IMPORT_UPLOAD_TOKEN_TTL_MS,
  verifyImportUploadToken,
} from "../../src/server/media-storage";

// AWS's published example credential — not a real secret.
const SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";

function withSecret<T>(value: string | undefined, run: () => T): T {
  const saved = process.env.R2_SECRET_ACCESS_KEY;
  if (value === undefined) delete process.env.R2_SECRET_ACCESS_KEY;
  else process.env.R2_SECRET_ACCESS_KEY = value;
  try {
    return run();
  } finally {
    if (saved === undefined) delete process.env.R2_SECRET_ACCESS_KEY;
    else process.env.R2_SECRET_ACCESS_KEY = saved;
  }
}

const KEY = createImportUploadObjectKey("Physics Paper (1).pdf");
const NOW = 1_800_000_000_000;

test("a token round-trips for the user and key it was minted for", () => {
  withSecret(SECRET, () => {
    const token = createImportUploadToken("u_1", KEY, NOW);
    assert.match(token, /^\d+\.[0-9a-f]{64}$/u);
    assert.equal(token.split(".")[0], String(NOW + IMPORT_UPLOAD_TOKEN_TTL_MS));
    assert.equal(IMPORT_UPLOAD_TOKEN_TTL_MS, 10 * 60 * 1000);

    assert.equal(verifyImportUploadToken(token, "u_1", KEY, NOW), true);
    assert.equal(verifyImportUploadToken(token, "u_1", KEY, NOW + IMPORT_UPLOAD_TOKEN_TTL_MS), true);
    // Deterministic for the same inputs; the key is part of the signature.
    assert.equal(createImportUploadToken("u_1", KEY, NOW), token);
    assert.notEqual(createImportUploadToken("u_1", createImportUploadObjectKey("other.pdf"), NOW), token);
  });
});

test("a token is for one user only", () => {
  withSecret(SECRET, () => {
    const token = createImportUploadToken("u_1", KEY, NOW);
    assert.equal(verifyImportUploadToken(token, "u_2", KEY, NOW), false);
    assert.equal(verifyImportUploadToken(token, "", KEY, NOW), false);
    assert.equal(verifyImportUploadToken(token, "u_1 ", KEY, NOW), false);
  });
});

test("a token is for one object key only", () => {
  withSecret(SECRET, () => {
    const token = createImportUploadToken("u_1", KEY, NOW);
    assert.equal(verifyImportUploadToken(token, "u_1", createImportUploadObjectKey("paper.pdf"), NOW), false);
    assert.equal(verifyImportUploadToken(token, "u_1", "origin-now/kyc/u_1/pan.pdf", NOW), false);
    assert.equal(verifyImportUploadToken(token, "u_1", "", NOW), false);
    // The three fields are newline-separated, so a user id cannot spill into the key.
    const shifted = createImportUploadToken("u_1\nimports/x", "y", NOW);
    assert.equal(verifyImportUploadToken(shifted, "u_1", "imports/x\ny", NOW), true); // same message...
    assert.equal(verifyImportUploadToken(shifted, "u_1", "imports/x", NOW), false); // ...but not the real key
  });
});

test("a token expires with the upload link", () => {
  withSecret(SECRET, () => {
    const token = createImportUploadToken("u_1", KEY, NOW);
    assert.equal(verifyImportUploadToken(token, "u_1", KEY, NOW + IMPORT_UPLOAD_TOKEN_TTL_MS + 1), false);
    // Nor can a forged expiry push it past the TTL: the expiry is signed, and
    // a token claiming to live longer than the TTL is refused outright.
    const [, sig] = token.split(".");
    assert.equal(verifyImportUploadToken(`${NOW + 2 * IMPORT_UPLOAD_TOKEN_TTL_MS}.${sig}`, "u_1", KEY, NOW), false);
    assert.equal(verifyImportUploadToken(`${NOW + IMPORT_UPLOAD_TOKEN_TTL_MS - 1}.${sig}`, "u_1", KEY, NOW), false);
  });
});

test("a tampered or malformed token is refused", () => {
  withSecret(SECRET, () => {
    const token = createImportUploadToken("u_1", KEY, NOW);
    const [exp, sig] = token.split(".");
    const flipped = (sig[0] === "0" ? "1" : "0") + sig.slice(1);
    for (const bad of [
      `${exp}.${flipped}`,
      `${exp}.${sig.slice(0, -2)}`,
      `${exp}.${sig}00`,
      `${exp}.${sig.toUpperCase()}`,
      `${exp}.`,
      `.${sig}`,
      sig,
      exp,
      `${exp}.${sig}.extra`,
      `${exp}x.${sig}`,
      `-${exp}.${sig}`,
      `${exp}.${"0".repeat(64)}`,
      "",
    ]) {
      assert.equal(verifyImportUploadToken(bad, "u_1", KEY, NOW), false, bad);
    }
    for (const notAString of [undefined, null, 42, {}, [token], { token }]) {
      assert.equal(verifyImportUploadToken(notAString, "u_1", KEY, NOW), false);
    }
  });
});

test("tokens are bound to the server secret", () => {
  const token = withSecret(SECRET, () => createImportUploadToken("u_1", KEY, NOW));
  // Another deployment's secret cannot verify, and minting needs the secret.
  withSecret("some-other-secret", () => {
    assert.equal(verifyImportUploadToken(token, "u_1", KEY, NOW), false);
  });
  withSecret(undefined, () => {
    assert.throws(() => createImportUploadToken("u_1", KEY, NOW), /R2_SECRET_ACCESS_KEY is required/);
    // Verification fails closed instead of throwing.
    assert.equal(verifyImportUploadToken(token, "u_1", KEY, NOW), false);
  });
  withSecret(SECRET, () => {
    assert.throws(() => createImportUploadToken("", KEY, NOW), /needs a user id/);
  });
});
