/**
 * `requireFeatureEnabledRuntime` — the handler-side counterpart of the
 * middleware kill-switch (docs/bug-fixes/11-new-teacher-admin.md finding 5).
 * `requireFeatureEnabled` in src/lib/feature-flags.ts is env-only, so a flag
 * killed in /admin/incidents was still served by every handler. The runtime
 * variant consults the override first and only falls back to env when none
 * is set. Uses the in-memory incident store (Redis unconfigured in unit CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { FeatureDisabledError } from "../../src/lib/feature-flags";
import { isFeatureEnabledRuntime, requireFeatureEnabledRuntime } from "../../src/server/feature-flags-runtime";
import { setFlagOverride } from "../../src/server/incidents";

async function withEnv<T>(name: string, value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  }
}

test("requireFeatureEnabledRuntime throws FeatureDisabledError when the override is 'off', even though env says on", async () => {
  await withEnv("TEACHER_LAUNCH_STUDY_MATERIALS", "true", async () => {
    await setFlagOverride("studyMaterials", "off");
    try {
      await assert.rejects(requireFeatureEnabledRuntime("studyMaterials"), FeatureDisabledError);
      assert.equal(await isFeatureEnabledRuntime("studyMaterials"), false);
    } finally {
      await setFlagOverride("studyMaterials", "clear");
    }
  });
});

test("requireFeatureEnabledRuntime falls back to the env flag when there is no override", async () => {
  await setFlagOverride("studyMaterials", "clear");
  await withEnv("TEACHER_LAUNCH_STUDY_MATERIALS", "true", async () => {
    await assert.doesNotReject(requireFeatureEnabledRuntime("studyMaterials"));
    assert.equal(await isFeatureEnabledRuntime("studyMaterials"), true);
  });
  await withEnv("TEACHER_LAUNCH_STUDY_MATERIALS", "false", async () => {
    await assert.rejects(requireFeatureEnabledRuntime("studyMaterials"), FeatureDisabledError);
    assert.equal(await isFeatureEnabledRuntime("studyMaterials"), false);
  });
});

test("requireFeatureEnabledRuntime honours a 'forced on' override over an env-off flag", async () => {
  await withEnv("TEACHER_LAUNCH_CONTEST", "false", async () => {
    await setFlagOverride("contest", "on");
    try {
      await assert.doesNotReject(requireFeatureEnabledRuntime("contest"));
    } finally {
      await setFlagOverride("contest", "clear");
    }
    // Cleared → env wins again.
    await assert.rejects(requireFeatureEnabledRuntime("contest"), FeatureDisabledError);
  });
});

test("the thrown error carries the flag name so handleTeacherError can map it to a 404", async () => {
  await setFlagOverride("teacherRooms", "off");
  try {
    await requireFeatureEnabledRuntime("teacherRooms");
    assert.fail("expected a throw");
  } catch (error) {
    assert.ok(error instanceof FeatureDisabledError);
    assert.equal(error.flag, "teacherRooms");
  } finally {
    await setFlagOverride("teacherRooms", "clear");
  }
});
