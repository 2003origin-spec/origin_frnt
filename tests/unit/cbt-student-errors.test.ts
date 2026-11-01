/**
 * handleStudentError (src/app/api/cbt-student/_utils.ts): only an error that
 * carries a status is the student's fault. A status-less error (pg timeout,
 * pool exhaustion, reset connection) used to come back as 400, which the CBT
 * player treated as a permanent rejection, so it stopped saving at the bell.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { handleStudentError, isTransientInfraError } from "@/app/api/cbt-student/_utils";

async function bodyOf(res: Response): Promise<{ detail?: string; code?: string; rev?: number }> {
  return (await res.json()) as { detail?: string; code?: string; rev?: number };
}

test("an error with a status keeps it, with its code and rev", async () => {
  const err = Object.assign(new Error("A newer version of your answers is already saved."), {
    status: 409,
    code: "stale_draft",
    rev: 7,
  });
  const res = handleStudentError(err);
  assert.equal(res.status, 409);
  assert.deepEqual(await bodyOf(res), { detail: err.message, code: "stale_draft", rev: 7 });

  const tooBig = Object.assign(new Error("Answer payload too large."), { status: 413, code: "payload_too_large" });
  assert.equal(handleStudentError(tooBig).status, 413);
});

test("a status-less DB timeout is a retryable 503, never a 400", async () => {
  const timeout = Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" });
  const res = handleStudentError(timeout);
  assert.equal(res.status, 503);
  const body = await bodyOf(res);
  assert.equal(body.code, "temporarily_unavailable");
  assert.doesNotMatch(body.detail ?? "", /statement/, "internal error text is not leaked");

  assert.equal(handleStudentError(new Error("Connection terminated unexpectedly")).status, 503);
  assert.equal(handleStudentError(new Error("timeout exceeded when trying to connect")).status, 503);
  assert.equal(handleStudentError(Object.assign(new Error("x"), { code: "ECONNRESET" })).status, 503);
});

test("any other status-less error is a 500", async () => {
  const res = handleStudentError(new Error("Cannot read properties of undefined"));
  assert.equal(res.status, 500);
  assert.equal((await bodyOf(res)).code, "server_error");
  assert.equal(handleStudentError("boom").status, 500);
});

test("isTransientInfraError: connection-class SQLSTATEs and pool errors", () => {
  assert.equal(isTransientInfraError(Object.assign(new Error("x"), { code: "08006" })), true);
  assert.equal(isTransientInfraError(Object.assign(new Error("x"), { code: "53300" })), true);
  assert.equal(isTransientInfraError(Object.assign(new Error("x"), { code: "23505" })), false);
  assert.equal(isTransientInfraError(new Error("relation does not exist")), false);
});
