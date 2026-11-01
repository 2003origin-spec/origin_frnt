/**
 * SigV4 signer checked against AWS's published S3 examples
 * ("Authenticating Requests: Using Query Parameters" and "…in the Authorization
 * Header — Transferring Payload in a Single Chunk"). If these pass, the same
 * code signs R2 requests correctly with region "auto".
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  EMPTY_PAYLOAD_SHA256,
  canonicalObjectPath,
  presignUrl,
  signRequest,
  type SigV4Credentials,
} from "../../src/server/notes/r2-sigv4";

const AWS: SigV4Credentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  service: "s3",
};
const AWS_DATE = new Date("2013-05-24T00:00:00Z");
const ORIGIN = "https://examplebucket.s3.amazonaws.com";

test("presigned GET matches the AWS query-parameter example", () => {
  const url = presignUrl({
    method: "GET",
    origin: ORIGIN,
    canonicalUri: "/test.txt",
    credentials: AWS,
    expiresSeconds: 86400,
    now: AWS_DATE,
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/u);
  assert.ok(url.startsWith(`${ORIGIN}/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request`));
});

test("header-signed ranged GET matches the AWS single-chunk example", () => {
  const { headers } = signRequest({
    method: "GET",
    origin: ORIGIN,
    canonicalUri: "/test.txt",
    credentials: AWS,
    headers: { range: "bytes=0-9" },
    payloadHash: EMPTY_PAYLOAD_SHA256,
    now: AWS_DATE,
  });
  assert.match(headers.Authorization, /SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/u);
  assert.equal(headers["x-amz-date"], "20130524T000000Z");
});

test("header-signed PUT with a body matches the AWS PUT example", () => {
  const body = "Welcome to Amazon S3.";
  const { headers } = signRequest({
    method: "PUT",
    origin: ORIGIN,
    canonicalUri: "/test%24file.text",
    credentials: AWS,
    headers: { date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" },
    payloadHash: createHash("sha256").update(body).digest("hex"),
    now: AWS_DATE,
  });
  assert.match(headers.Authorization, /Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd$/u);
});

test("path-style object paths encode each segment but keep the slashes", () => {
  assert.equal(canonicalObjectPath("notes-dev", "notes/library/2026/10/a b+c.pdf"), "/notes-dev/notes/library/2026/10/a%20b%2Bc.pdf");
});

test("signed headers and response overrides are part of the presigned signature", () => {
  const base = { method: "PUT" as const, origin: ORIGIN, canonicalUri: "/x.pdf", credentials: AWS, expiresSeconds: 600, now: AWS_DATE };
  const plain = presignUrl(base);
  const typed = presignUrl({ ...base, signedHeaders: { "content-type": "application/pdf" } });
  assert.match(typed, /X-Amz-SignedHeaders=content-type%3Bhost/u);
  assert.notEqual(plain.split("X-Amz-Signature=")[1], typed.split("X-Amz-Signature=")[1]);

  const get = presignUrl({ ...base, method: "GET", query: { "response-content-type": "application/pdf" } });
  // Query keys sort by byte value, so the lower-case override comes after X-Amz-*.
  assert.match(get, /X-Amz-SignedHeaders=host&response-content-type=application%2Fpdf&X-Amz-Signature=/u);
});
