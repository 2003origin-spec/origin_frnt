import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The app saves BoomBoom settings with PUT /api/mobile/music/prefs. The mobile catch-all
// route must export PUT, or Next answers 405 before the music handler runs (seen 15/11/2026).
test("mobile catch-all route exports PUT for /api/mobile/music/prefs", () => {
  const src = readFileSync("src/app/api/mobile/[...slug]/route.ts", "utf8");
  assert.match(src, /export async function PUT\(request: NextRequest, context: RouteContext\) \{\s*return dispatch\("PUT", request, context\);/);
  const music = readFileSync("src/server/music/student-api.ts", "utf8");
  assert.match(music, /method === "PUT" && slug\.length === 1 && head === "prefs"/);
});
