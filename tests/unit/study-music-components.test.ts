/**
 * Study Music components (V1/STUDY_MUSIC_PLAN.md §11.2): the Pomodoro card's
 * states and accessibility attributes rendered with react-dom/server, and one
 * jsdom interaction test of the "Pause music for your test?" prompt
 * (react-dom/client). No new dependency.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { JSDOM as JSDOMBase } from "jsdom";

// The bundled jsdom types only declare the html argument; the options are real.
const JSDOM = JSDOMBase as unknown as new (html: string, options: Record<string, unknown>) => JSDOMBase;

import { PauseForTestPromptView } from "../../src/features/study-music/PauseForTestPrompt";
import { StudyMusicCardView, type StudyMusicCardViewProps } from "../../src/features/study-music/StudyMusicCard";
import type { PlayerTrack } from "../../src/lib/study-music-player";

const t = (n: number, mood: PlayerTrack["mood"], required = false): PlayerTrack => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  title: `Track ${n}`,
  artist: `Artist ${n}`,
  mood,
  durationSeconds: 125,
  loopable: false,
  credit: { required, text: `‘Track ${n}’ by Artist ${n}, CC BY 4.0 <b>x</b>`, licenceName: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", sourceUrl: "https://example.org/track" },
});
const TRACKS = [t(1, "lofi", true), t(2, "lofi"), t(3, "nature")];
const noop = () => undefined;

function card(over: Partial<StudyMusicCardViewProps> = {}): string {
  const props: StudyMusicCardViewProps = {
    status: "ready",
    tracks: TRACKS,
    mood: "lofi",
    currentId: null,
    playing: false,
    held: false,
    error: null,
    prefs: { pauseDuringTests: true, defaultMood: "lofi" },
    focusSettings: { startWithFocus: false, stopAtBreaks: true },
    today: { seconds: 2520, focusSeconds: 1800 },
    sleep: null,
    now: 1_000_000,
    onSleep: noop,
    onToggle: noop,
    onNext: noop,
    onPrevious: noop,
    onSelect: noop,
    onMood: noop,
    onPauseDuringTests: noop,
    onFocusSettings: noop,
    ...over,
  };
  return renderToStaticMarkup(createElement(StudyMusicCardView, props));
}

test("card: loading, and nothing uploaded yet", () => {
  const loading = card({ status: "loading" });
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /Loading music/);
  assert.match(card({ status: "off" }), /No music yet/);
  assert.match(card({ tracks: [] }), /No music yet/);
});

test("card: ready — moods as a radio group, the mood's tracks, controls with names, 48 px targets", () => {
  const html = card();
  assert.match(html, /role="radiogroup"/);
  assert.equal((html.match(/role="radio"/g) ?? []).length, 2, "only moods that have tracks");
  assert.match(html, /role="radio" aria-checked="true"[^>]*>Lo-fi</);
  assert.match(html, /aria-label="Play music"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /aria-label="Next track"/);
  assert.match(html, /aria-label="Previous track"/);
  assert.match(html, /Track 1/);
  assert.match(html, /Track 2/);
  assert.doesNotMatch(html, /Track 3<\/span>/, "the nature track is not in the lofi list");
  assert.match(html, />2:05</);
  assert.match(html, /Pick a mood and press play/);
  // Every control is at least 48 px (h-12 / min-h-12).
  for (const b of html.match(/<button[^>]*>/g) ?? []) {
    if (b.includes('role="switch"')) continue; // the switch's row is min-h-12, the label is its target too
    assert.match(b, /\b(h-12|min-h-12)\b/, b);
  }
});

test("card: playing state, current track and its credit, Music today", () => {
  const html = card({ currentId: TRACKS[0].id, playing: true });
  assert.match(html, /aria-label="Pause music"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /Music today: 42 min · 30 min in focus/);
  // The credit is text: HTML in it is escaped, never rendered.
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});

test("card: held for a break / test, and the load error", () => {
  assert.match(card({ currentId: TRACKS[0].id, held: true }), /Artist 1 · paused for now/);
  assert.match(card({ currentId: TRACKS[0].id, error: "Couldn't load this track." }), /Couldn(&#x27;|')t load this track\./);
});

test("card: the three settings are labelled switches with their state", () => {
  const html = card({ focusSettings: { startWithFocus: true, stopAtBreaks: false }, prefs: { pauseDuringTests: false, defaultMood: "lofi" } });
  const switches = html.match(/<button[^>]*role="switch"[^>]*>/g) ?? [];
  assert.equal(switches.length, 3);
  assert.deepEqual(switches.map((s) => /aria-checked="(true|false)"/.exec(s)?.[1]), ["true", "false", "false"]);
  for (const label of ["Start music with focus", "Stop at breaks", "Pause music during tests"]) {
    const id = new RegExp(`<label for="([^"]+)"[^>]*>${label}</label>`).exec(html)?.[1];
    assert.ok(id, `${label} has a label`);
    assert.match(html, new RegExp(`id="${id}"[^>]*role="switch"`), `${label} label points at its switch`);
  }
});

test("card: credits list every track's credit with safe external links", () => {
  const html = card();
  assert.match(html, /<summary[^>]*>Music credits/);
  const links = html.match(/<a [^>]*>/g) ?? [];
  assert.ok(links.length >= 6);
  for (const a of links) {
    assert.match(a, /rel="noopener noreferrer"/);
    assert.match(a, /href="https:\/\//);
  }
});

test("card: sleep timer — the app's choices, the time left, and Off only while set", () => {
  const off = card();
  assert.match(off, /Sleep timer/);
  for (const m of [15, 30, 45, 60]) assert.match(off, new RegExp(`>${m} min</button>`));
  assert.match(off, /End of track/);
  assert.match(off, /aria-live="polite">Off</);
  assert.doesNotMatch(off, /Turn the sleep timer off/);
  const timed = card({ sleep: { kind: "at", endsAt: 1_000_000 + 14 * 60_000 + 1 } });
  assert.match(timed, /Stops in 15 min/);
  assert.match(timed, /aria-label="Turn the sleep timer off"/);
  const eot = card({ sleep: { kind: "endOfTrack" } });
  assert.match(eot, /Stops at the end of this track/);
  assert.match(eot, /aria-pressed="true"[^>]*>End of track/);
});

test("prompt: copy, dialog semantics and the written countdown", () => {
  const html = renderToStaticMarkup(createElement(PauseForTestPromptView, { secondsLeft: 7.2, onPause: noop, onKeep: noop }));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="false"/, "the test keeps running underneath");
  assert.match(html, /aria-labelledby="[^"]+-title"/);
  assert.match(html, />Pause music for your test\?</);
  assert.match(html, /Music will start again after your test\./);
  assert.match(html, /Pausing in 8 s/);
  assert.match(html, />Pause \(recommended\)</);
  assert.match(html, />Keep playing</);
  for (const b of html.match(/<button[^>]*>/g) ?? []) assert.match(b, /min-h-12/);
});

test("prompt (jsdom): the default button has focus and both buttons call back", async () => {
  const dom = new JSDOM("<!doctype html><body><div id=root></div></body>", { pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  g.HTMLElement = dom.window.HTMLElement;
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const calls: string[] = [];
  const root = createRoot(dom.window.document.getElementById("root")!);
  await act(async () => {
    root.render(createElement(PauseForTestPromptView, { secondsLeft: 10, onPause: () => calls.push("pause"), onKeep: () => calls.push("keep") }));
  });
  assert.equal(dom.window.document.activeElement?.textContent, "Pause (recommended)");
  const buttons = [...dom.window.document.querySelectorAll("button")];
  for (const b of buttons) {
    await act(async () => {
      b.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  }
  assert.deepEqual(calls, ["keep", "pause"]);
  // Keyboard: Enter on the focused default button.
  await act(async () => {
    (dom.window.document.activeElement as HTMLButtonElement).click();
  });
  assert.equal(calls.at(-1), "pause");
  await act(async () => root.unmount());
});
