/**
 * Compiles src/sw/sw.ts → public/sw.js (ANDROID_HYBRID_APP_PLAN.md §6.1).
 *
 * Runs as the `prebuild`/`predev` npm hook. Deliberately esbuild, not the
 * Next bundler: the app builds with Turbopack, and the worker must be a
 * standalone root-scope script — no framework plugin in the loop.
 *
 * The injected build id makes the emitted file's content change on every
 * deploy, which is what triggers the browser's service-worker update check;
 * it also versions the precache entries.
 */

import { build } from "esbuild";

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.SW_BUILD_ID ??
  `local-${Date.now().toString(36)}`;

await build({
  entryPoints: ["src/sw/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  // WebView/Chrome 111 is the app's hard floor (plan ledger #20).
  target: ["chrome111"],
  define: {
    __ORIGIN_SW_BUILD_ID__: JSON.stringify(buildId),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  logLevel: "warning",
});

console.log(`[build-sw] public/sw.js written (build ${buildId})`);
