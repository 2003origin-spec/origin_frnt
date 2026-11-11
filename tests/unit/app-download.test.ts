/** "Get the app": which device, and what the nav button does there (SEO_APP_DOWNLOAD_NOTES.md). */

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { appDownloadAction, detectAppDevice, PLAY_STORE_QR_ENCODED_URL, PLAY_STORE_QR_SRC, PLAY_STORE_URL } from "@/lib/app-download";

const UA = {
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  ipadOld: "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1",
  // iPadOS 13+ requests the desktop site and reports itself as a Mac.
  ipadOsAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  inAppShell: "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 OriginApp/20011 (android)",
};

test("Android phones and tablets → Play Store", () => {
  assert.equal(detectAppDevice({ userAgent: UA.androidChrome, maxTouchPoints: 5 }), "android");
  assert.equal(detectAppDevice({ userAgent: UA.androidTablet, maxTouchPoints: 10 }), "android");
  assert.equal(appDownloadAction("android"), "play_store");
});

test("iPhone (Safari or Chrome) and iPad → iOS coming soon", () => {
  assert.equal(detectAppDevice({ userAgent: UA.iphoneSafari, maxTouchPoints: 5 }), "ios");
  assert.equal(detectAppDevice({ userAgent: UA.iphoneChrome, maxTouchPoints: 5 }), "ios");
  assert.equal(detectAppDevice({ userAgent: UA.ipadOld, maxTouchPoints: 5 }), "ios");
  assert.equal(appDownloadAction("ios"), "ios_sheet");
});

test("iPadOS reporting as a Mac with touch → iOS; a real Mac → desktop", () => {
  assert.equal(detectAppDevice({ userAgent: UA.ipadOsAsMac, maxTouchPoints: 5 }), "ios");
  assert.equal(detectAppDevice({ userAgent: UA.macSafari, maxTouchPoints: 0 }), "desktop");
  assert.equal(detectAppDevice({ userAgent: UA.macSafari }), "desktop");
});

test("Windows, Linux and unknown → desktop dialog", () => {
  assert.equal(detectAppDevice({ userAgent: UA.windowsChrome, maxTouchPoints: 0 }), "desktop");
  assert.equal(detectAppDevice({ userAgent: UA.linuxFirefox }), "desktop");
  assert.equal(detectAppDevice({ userAgent: "" }), "desktop");
  // A touch Windows laptop is still a desktop.
  assert.equal(detectAppDevice({ userAgent: UA.windowsChrome, maxTouchPoints: 10 }), "desktop");
  assert.equal(appDownloadAction("desktop"), "desktop_sheet");
});

test("inside our Android app shell → hidden (UA marker or the bridge)", () => {
  assert.equal(detectAppDevice({ userAgent: UA.inAppShell, maxTouchPoints: 5 }), "in-app");
  assert.equal(detectAppDevice({ userAgent: UA.androidChrome, nativeShell: true }), "in-app");
  assert.equal(appDownloadAction("in-app"), "hidden");
});

test("the Play Store link is the live listing", () => {
  assert.equal(PLAY_STORE_URL, "https://play.google.com/store/apps/details?id=com.o3origin.app");
});

test("the static QR encodes PLAY_STORE_URL (regenerate the SVG if the link changes)", () => {
  // The SVG was generated once and decoded back with jsQR to exactly this URL
  // (SEO_APP_DOWNLOAD_NOTES.md). This fails if the link changes without a new QR.
  assert.equal(PLAY_STORE_QR_ENCODED_URL, PLAY_STORE_URL);
  const svg = readFileSync(join(new URL("../..", import.meta.url).pathname, "public", PLAY_STORE_QR_SRC), "utf8");
  assert.ok(svg.includes(`<!-- Encodes: ${PLAY_STORE_URL} |`), "the SVG says which URL it encodes");
  // Dark on a white square with a 4-module quiet zone: version 6 (41 modules) + 2 × 4.
  assert.match(svg, /viewBox="0 0 49 49"/);
  assert.match(svg, /<path fill="#ffffff" d="M0 0h49v49H0z"\/>/);
  assert.match(svg, /<path stroke="#000000" d="M4 4\.5h7/, "first dark module (finder pattern) starts after the quiet zone");
});
