import test from "node:test";
import assert from "node:assert/strict";

import { notesHref } from "../../src/sections/notes/notes-client";
import { SHARED_REPORT_REASONS } from "../../src/lib/notes/types";

test("Shared with me links keep only the share keys", () => {
  assert.equal(notesHref({ tab: "shared" }), "/notes?tab=shared");
  assert.equal(notesHref({ tab: "shared", share: "nshr_1" }), "/notes?tab=shared&share=nshr_1");
  assert.equal(notesHref({ tab: "shared", share: "nshr_1", sharedFolder: "nmfo_2" }), "/notes?tab=shared&share=nshr_1&sf=nmfo_2");
  assert.equal(notesHref({ tab: "shared", share: "nshr_1", sharedFile: "nmfi_3", sharedFolder: "nmfo_2" }), "/notes?tab=shared&share=nshr_1&sfile=nmfi_3");
  // A folder or file without a share means nothing, so it is dropped.
  assert.equal(notesHref({ tab: "shared", sharedFile: "nmfi_3" }), "/notes?tab=shared");
  // Odd ids are escaped, never spliced into the query.
  assert.equal(notesHref({ tab: "shared", share: "a&tab=mine" }), "/notes?tab=shared&share=a%26tab%3Dmine");
});

test("shared files have their own report reasons (not the library's 'mistake')", () => {
  assert.deepEqual([...SHARED_REPORT_REASONS], ["inappropriate", "copyright", "spam", "other"]);
});
