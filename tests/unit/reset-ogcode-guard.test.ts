/**
 * scripts/reset-ogcode-scores.ts is a one-time cutover that wipes every OGCode
 * point. These pin the guard: dry run by default, --apply to write, and a refusal
 * once the cutover has been applied unless --force-rerun is also passed.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  RESET_MARKER_ID,
  decideResetRun,
  parseResetArgs,
} from "../../scripts/lib/reset-ogcode-guard.mjs";

const root = new URL("../..", import.meta.url).pathname;

test("parseResetArgs: no flags is a dry run", () => {
  assert.deepEqual(parseResetArgs([]), { apply: false, forceRerun: false, error: null });
});

test("parseResetArgs: --dry-run alone is still a dry run", () => {
  assert.deepEqual(parseResetArgs(["--dry-run"]), { apply: false, forceRerun: false, error: null });
});

test("parseResetArgs: --apply writes; --force-rerun is separate", () => {
  assert.deepEqual(parseResetArgs(["--apply"]), { apply: true, forceRerun: false, error: null });
  assert.deepEqual(parseResetArgs(["--apply", "--force-rerun"]), { apply: true, forceRerun: true, error: null });
});

test("parseResetArgs: --apply with --dry-run is an error, not a write", () => {
  const parsed = parseResetArgs(["--apply", "--dry-run"]);
  assert.equal(parsed.apply, false);
  assert.match(parsed.error ?? "", /mutually exclusive/);
});

test("parseResetArgs: a typo is an error, never a silent mode", () => {
  const parsed = parseResetArgs(["--aply"]);
  assert.equal(parsed.apply, false);
  assert.match(parsed.error ?? "", /--aply/);
});

test("decideResetRun: a fresh cutover proceeds", () => {
  const d = decideResetRun({ apply: true, forceRerun: false, markerPresent: false, staleProgressPresent: false });
  assert.equal(d.proceed, true);
  assert.deepEqual(d.reasons, []);
});

test("decideResetRun: the ledger marker refuses with exit 1", () => {
  const d = decideResetRun({ apply: true, forceRerun: false, markerPresent: true, staleProgressPresent: false });
  assert.equal(d.proceed, false);
  assert.equal(d.exitCode, 1);
  assert.match(d.reasons.join(" "), new RegExp(RESET_MARKER_ID));
});

test("decideResetRun: old V2 progress refuses even without the marker (pre-marker prod run)", () => {
  const d = decideResetRun({ apply: true, forceRerun: false, markerPresent: false, staleProgressPresent: true });
  assert.equal(d.proceed, false);
  assert.equal(d.exitCode, 1);
});

test("decideResetRun: a dry run is refused too once applied", () => {
  const d = decideResetRun({ apply: false, forceRerun: false, markerPresent: true, staleProgressPresent: true });
  assert.equal(d.proceed, false);
  assert.equal(d.reasons.length, 2);
});

test("decideResetRun: the refusal hint is worded for a dry run vs an apply", () => {
  const dry = decideResetRun({ apply: false, forceRerun: false, markerPresent: true, staleProgressPresent: false });
  assert.match(dry.hint ?? "", /dry run: nothing was changed/);
  assert.match(dry.hint ?? "", /--force-rerun \(without --apply\)/);
  assert.doesNotMatch(dry.hint ?? "", /wipes/);
  const real = decideResetRun({ apply: true, forceRerun: false, markerPresent: true, staleProgressPresent: false });
  assert.match(real.hint ?? "", /wipes every OGCode point/);
  assert.equal(decideResetRun({ apply: true, forceRerun: true, markerPresent: true, staleProgressPresent: false }).hint, null);
});

test("decideResetRun: --force-rerun overrides but keeps the reasons for the warning", () => {
  const d = decideResetRun({ apply: true, forceRerun: true, markerPresent: true, staleProgressPresent: true });
  assert.equal(d.proceed, true);
  assert.equal(d.reasons.length, 2);
});

test("the script uses the guard and no longer claims to be safe to re-run", () => {
  const src = readFileSync(`${root}scripts/reset-ogcode-scores.ts`, "utf8");
  assert.match(src, /parseResetArgs\(process\.argv\.slice\(2\)\)/);
  assert.match(src, /decideResetRun\(/);
  assert.match(src, /INSERT INTO app\.migrations/);
  assert.doesNotMatch(src, /Idempotent: a second run/);
  assert.doesNotMatch(src, /process\.argv\.includes\("--dry-run"\)/);
});
