import test from "node:test";
import assert from "node:assert/strict";

import { isFeatureEnabled } from "../../src/lib/feature-flags";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("Notes ships dark: off in production, on in development, env var wins", () => {
  withEnv({ NODE_ENV: "production", TEACHER_LAUNCH_NOTES: undefined }, () => assert.equal(isFeatureEnabled("notes"), false));
  withEnv({ NODE_ENV: "development", TEACHER_LAUNCH_NOTES: undefined }, () => assert.equal(isFeatureEnabled("notes"), true));
  withEnv({ NODE_ENV: "production", TEACHER_LAUNCH_NOTES: "1" }, () => assert.equal(isFeatureEnabled("notes"), true));
  withEnv({ NODE_ENV: "development", TEACHER_LAUNCH_NOTES: "off" }, () => assert.equal(isFeatureEnabled("notes"), false));
});

test("My Notes ships dark on its own switch, so the library can launch first", () => {
  withEnv({ NODE_ENV: "production", TEACHER_LAUNCH_NOTES_UPLOADS: undefined }, () => assert.equal(isFeatureEnabled("notesUploads"), false));
  withEnv({ NODE_ENV: "development", TEACHER_LAUNCH_NOTES_UPLOADS: undefined }, () => assert.equal(isFeatureEnabled("notesUploads"), true));
  withEnv({ NODE_ENV: "production", TEACHER_LAUNCH_NOTES_UPLOADS: "1" }, () => assert.equal(isFeatureEnabled("notesUploads"), true));
});

test("Sharing with friends ships dark on its own switch", () => {
  withEnv({ NODE_ENV: "production", TEACHER_LAUNCH_NOTES_SHARING: undefined }, () => assert.equal(isFeatureEnabled("notesSharing"), false));
  withEnv({ NODE_ENV: "development", TEACHER_LAUNCH_NOTES_SHARING: undefined }, () => assert.equal(isFeatureEnabled("notesSharing"), true));
  withEnv({ NODE_ENV: "production", TEACHER_LAUNCH_NOTES_SHARING: "1" }, () => assert.equal(isFeatureEnabled("notesSharing"), true));
});
