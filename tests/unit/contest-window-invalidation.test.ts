/**
 * Round-2 review F9: an admin ending/cancelling a contest early must clear
 * every cached copy of its window.
 *
 * - Every write to contest.contests that touches the window (status, start_at,
 *   end_at, reg_open, reg_close) in the contest services or admin routes is
 *   followed, in the same function, by invalidateContestWindow.
 * - invalidateContestWindow also clears registered derived caches.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../src/", import.meta.url));

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/** The body of the function enclosing `index` (from the nearest preceding `function `). */
function enclosingFunction(src: string, index: number): string {
  const start = src.lastIndexOf("function ", index);
  const next = src.indexOf("\nexport ", index);
  return src.slice(start, next === -1 ? undefined : next);
}

const WINDOW_COLUMNS = /\b(status|start_at|end_at|reg_open|reg_close)\s*=|\$\{sets\.join/;

test("every window write in the contest services and admin routes invalidates the window cache", () => {
  const files = [
    ...tsFiles(join(root, "server/contest")),
    ...tsFiles(join(root, "app/api/admin/contest")),
    ...tsFiles(join(root, "app/api/internal/contest")),
  ];
  let writes = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const re = /UPDATE contest\.contests\s+SET([\s\S]*?)WHERE/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      if (!WINDOW_COLUMNS.test(m[1])) continue;
      writes += 1;
      const fn = enclosingFunction(src, m.index);
      const after = fn.slice(fn.indexOf(m[0]));
      assert.match(after, /invalidateContestWindow\(/, `${file.slice(root.length)}: window write without invalidation`);
    }
  }
  // update, publish, reschedule, cancel, extend, results x2, archive
  assert.ok(writes >= 8, `expected the known window writes, found ${writes}`);
});

test("invalidateContestWindow clears registered derived caches, even past a throwing listener", async () => {
  const wc = await import("@/server/contest/contest-window-cache");
  wc.__setWindowCacheRedisForTests(null);
  const seen: string[] = [];
  const offBad = wc.onContestWindowInvalidated(() => {
    throw new Error("boom");
  });
  const off = wc.onContestWindowInvalidated((id) => seen.push(id));
  await wc.invalidateContestWindow("c_1");
  assert.deepEqual(seen, ["c_1"]);
  off();
  offBad();
  await wc.invalidateContestWindow("c_2");
  assert.deepEqual(seen, ["c_1"], "unsubscribed listeners are not called");
});
