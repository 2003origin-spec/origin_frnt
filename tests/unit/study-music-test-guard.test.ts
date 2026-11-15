/**
 * "Pause music for your test?" (V1/STUDY_MUSIC_PLAN.md §5, §11.1):
 *   - the decision: playing + setting on → prompt; setting off or not playing → nothing;
 *   - the real StudyMusicProvider + useTestMusicGuard in jsdom (stubbed fetch and
 *     media element): prompt with "Pause (recommended)" focused, "Keep playing",
 *     Pause holds and the music returns on submit / leave / unmount, no answer in
 *     10 s → Pause, manual play during the hold drops it, setting off → no prompt;
 *   - a source-text check that every test start / end site calls the guard, so a
 *     new test type can't forget it.
 * Nothing in the guard returns anything that could block a test from starting.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { JSDOM as JSDOMBase } from "jsdom";

// The bundled jsdom types only declare the html argument; the options are real.
const JSDOM = JSDOMBase as unknown as new (html: string, options: Record<string, unknown>) => JSDOMBase;

import { TEST_PROMPT_SECONDS, promptCountdownText, testStartAction } from "../../src/lib/study-music-player";

const root = new URL("../..", import.meta.url).pathname;

test("decision: prompt only when music is playing and the setting is on", () => {
  assert.equal(testStartAction({ playing: true, pauseDuringTests: true }), "prompt");
  assert.equal(testStartAction({ playing: true, pauseDuringTests: false }), "none", "setting off → keeps playing");
  assert.equal(testStartAction({ playing: false, pauseDuringTests: true }), "none", "not playing → nothing");
  assert.equal(testStartAction({ playing: false, pauseDuringTests: false }), "none");
  assert.equal(TEST_PROMPT_SECONDS, 10);
  assert.equal(promptCountdownText(10), "Pausing in 10 s");
  assert.equal(promptCountdownText(0.2), "Pausing in 1 s");
  assert.equal(promptCountdownText(-3), "Pausing in 0 s");
});

// ── The real provider + hook in jsdom ───────────────────────────────────────

const TRACK_ID = "00000000-0000-4000-8000-000000000001";
const requests: { method: string; url: string; body?: string }[] = [];
const pauseDuringTests = true;

function setupDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>", { url: "http://localhost:3017/tests/t1", pretendToBeVisual: true });
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  g.HTMLElement = dom.window.HTMLElement;
  g.Node = dom.window.Node;
  g.IS_REACT_ACT_ENVIRONMENT = true;
  // The media element: jsdom has no audio pipeline. play() "starts" at once.
  const proto = dom.window.HTMLMediaElement.prototype as unknown as Record<string, unknown>;
  Object.defineProperty(proto, "paused", { configurable: true, get() { return (this as { _paused?: boolean })._paused !== false; } });
  proto.play = function (this: HTMLMediaElement & { _paused?: boolean }) {
    this._paused = false;
    this.dispatchEvent(new dom.window.Event("playing"));
    return Promise.resolve();
  };
  proto.pause = function (this: HTMLMediaElement & { _paused?: boolean }) {
    if (this._paused === false) {
      this._paused = true;
      this.dispatchEvent(new dom.window.Event("pause"));
    }
  };
  proto.load = function () {};
  // Signed-in session cookie for mutateJson.
  dom.window.document.cookie = "origin_csrf=test";
  g.fetch = async (input: string, init: { method?: string; body?: string } = {}) => {
    const url = String(input);
    requests.push({ method: init.method ?? "GET", url, body: init.body });
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith("/api/music/tracks")) {
      return json({
        tracks: [{ id: TRACK_ID, title: "Rain", artist: "Origin", mood: "lofi", durationSeconds: 120, loopable: false,
          credit: { required: false, text: "Rain by Origin", licenceName: "Made by Origin", licenceUrl: "https://www.o3origin.com/", sourceUrl: "https://www.o3origin.com/" } }],
        prefs: { pauseDuringTests, defaultMood: "lofi" },
        today: { seconds: 0, focusSeconds: 0 },
      });
    }
    if (url.includes("/url")) return json({ url: "https://r2.example/music/tracks/x.m4a?sig=1", expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    return json({});
  };
  return dom;
}

test("provider + guard: the prompt, both answers, the 10 s default, resume on end and unmount", async (t) => {
  const dom = setupDom();
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { StudyMusicProvider, useStudyMusic } = await import("../../src/features/study-music/StudyMusicProvider");
  const { useTestMusicGuard } = await import("../../src/features/study-music/useTestMusicGuard");
  const h = React.createElement;

  // Handles the test drives the components with (filled in after each render).
  const handles: {
    music: ReturnType<typeof useStudyMusic>;
    setActive: (v: boolean) => void;
    setMounted: (v: boolean) => void;
  } = { music: null, setActive: () => undefined, setMounted: () => undefined };
  function TestPage() {
    const [active, set] = React.useState(false);
    React.useLayoutEffect(() => {
      handles.setActive = set;
    }, []);
    const guard = useTestMusicGuard(active);
    return h("div", { id: "test-surface" }, guard.prompt);
  }
  function Capture() {
    const music = useStudyMusic();
    const [mounted, set] = React.useState(true);
    React.useLayoutEffect(() => {
      handles.music = music;
      handles.setMounted = set;
    }, [music]);
    return mounted ? h(TestPage) : null;
  }
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  await act(async () => {
    root.render(h(StudyMusicProvider, { enabled: true, children: h(Capture) }));
  });
  await act(async () => new Promise((r) => setTimeout(r, 20)));
  assert.equal(handles.music!.status, "ready");

  const promptEl = () => dom.window.document.querySelector("[data-study-music-prompt]");
  const button = (text: string) =>
    [...dom.window.document.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement | undefined;
  const click = async (el: HTMLElement | undefined) => {
    assert.ok(el, "button exists");
    await act(async () => {
      el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    await act(async () => new Promise((r) => setTimeout(r, 10)));
  };
  const start = async () => act(async () => handles.setActive(true));
  const end = async () => act(async () => handles.setActive(false));
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));

  await t.test("not playing at start → nothing happens", async () => {
    await start();
    assert.equal(promptEl(), null);
    await end();
  });

  await act(async () => handles.music!.play());
  await settle();
  assert.equal(handles.music!.audible, true, "music is playing");

  await t.test("playing + setting on → prompt, default button focused, countdown as text", async () => {
    await start();
    assert.ok(promptEl(), "prompt shown");
    assert.equal(dom.window.document.activeElement?.textContent, "Pause (recommended)");
    assert.match(promptEl()!.textContent ?? "", /Pausing in 10 s/);
    assert.match(promptEl()!.textContent ?? "", /Music will start again after your test\./);
  });

  await t.test("Keep playing → no hold; music keeps playing", async () => {
    await click(button("Keep playing"));
    assert.equal(promptEl(), null);
    assert.equal(handles.music!.audible, true);
    assert.deepEqual(handles.music!.state.holds, []);
    await end();
  });

  await t.test("Pause → held for the test; submit / leave → music resumes", async () => {
    await start();
    await click(button("Pause (recommended)"));
    assert.equal(handles.music!.audible, false);
    assert.equal(handles.music!.held, true);
    await end();
    await settle();
    assert.equal(handles.music!.audible, true, "resumes when the test ends");
  });

  await t.test("manual play during the hold drops it; nothing auto-pauses or resumes later", async () => {
    await start();
    await click(button("Pause (recommended)"));
    assert.equal(handles.music!.audible, false);
    await act(async () => handles.music!.play());
    await settle();
    assert.equal(handles.music!.audible, true);
    assert.deepEqual(handles.music!.state.holds, []);
    await end();
    await settle();
    assert.equal(handles.music!.audible, true);
  });

  await t.test("unmount of the test screen releases the hold (back gesture, crash)", async () => {
    await start();
    await click(button("Pause (recommended)"));
    assert.equal(handles.music!.held, true);
    await act(async () => handles.setMounted(false));
    await settle();
    assert.equal(handles.music!.held, false);
    assert.equal(handles.music!.audible, true);
    await act(async () => handles.setMounted(true));
    await settle();
  });

  await t.test("no answer in 10 s → Pause is applied by itself", async () => {
    const realNow = Date.now;
    let offset = 0;
    Date.now = () => realNow() + offset;
    try {
      await start();
      assert.ok(promptEl());
      offset = (TEST_PROMPT_SECONDS + 1) * 1000;
      await act(async () => new Promise((r) => setTimeout(r, 300)));
      assert.equal(promptEl(), null, "prompt gone");
      assert.equal(handles.music!.held, true, "default applied: paused for the test");
      assert.equal(handles.music!.audible, false);
    } finally {
      Date.now = realNow;
      await end();
      await settle();
    }
    assert.equal(handles.music!.audible, true);
  });

  await t.test("setting off → no prompt, music keeps playing", async () => {
    await act(async () => handles.music!.setPauseDuringTests(false));
    await settle();
    assert.ok(requests.some((r) => r.method === "PUT" && r.url.endsWith("/api/music/prefs") && r.body === '{"pauseDuringTests":false}'));
    await start();
    assert.equal(promptEl(), null);
    assert.equal(handles.music!.audible, true);
    await end();
  });

  await t.test("a failed older prefs save never undoes a newer toggle", async () => {
    const realFetch = globalThis.fetch;
    let releaseFirst: (r: Response) => void = () => undefined;
    let calls = 0;
    (globalThis as Record<string, unknown>).fetch = async (input: string, init: { method?: string; body?: string } = {}) => {
      if (String(input).endsWith("/api/music/prefs")) {
        calls += 1;
        if (calls === 1) return new Promise<Response>((resolve) => (releaseFirst = resolve)); // slow, then fails
        return new Response(JSON.stringify({ prefs: { pauseDuringTests: true, defaultMood: "lofi" } }), { status: 200 });
      }
      return realFetch(input, init);
    };
    try {
      await act(async () => handles.music!.setPauseDuringTests(false)); // request 1 (slow)
      await act(async () => handles.music!.setPauseDuringTests(true)); // request 2 (ok)
      await settle();
      assert.equal(handles.music!.prefs.pauseDuringTests, true);
      await act(async () => releaseFirst(new Response("{}", { status: 500 })));
      await settle();
      assert.equal(handles.music!.prefs.pauseDuringTests, true, "the newer choice stays");
    } finally {
      (globalThis as Record<string, unknown>).fetch = realFetch;
    }
  });

  await t.test("sign-out forgets the saved place, so the next account on this tab starts clean", async () => {
    await act(async () => handles.music!.play());
    await settle();
    // Something is saved for this tab while playing.
    await act(async () => dom.window.dispatchEvent(new dom.window.Event("pagehide")));
    assert.ok(dom.window.sessionStorage.getItem("origin-study-music:v1"), "saved while signed in");
    await act(async () => {
      root.render(h(StudyMusicProvider, { enabled: false, children: h(Capture) }));
    });
    await settle();
    assert.equal(dom.window.sessionStorage.getItem("origin-study-music:v1"), null, "forgotten on sign-out");
    await act(async () => {
      root.render(h(StudyMusicProvider, { enabled: true, children: h(Capture) }));
    });
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    assert.equal(handles.music!.state.trackId, null, "nothing restored for the next account");
  });

  await act(async () => root.unmount());
});

// ── Every start / end site calls the guard ──────────────────────────────────

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

/** The body of `name = …` up to the next top-level const in the component. */
function body(src: string, marker: string): string {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `${marker} not found`);
  const next = src.indexOf("\n  const ", start + marker.length);
  return src.slice(start, next === -1 ? undefined : next);
}

test("source: every test start site calls the guard after starting, every end site releases it", () => {
  const ti = source("src/sections/TestInterface.tsx");
  assert.match(ti, /useTestMusicGuard\(isExamStarted\)/);
  assert.match(body(ti, "const startExam = () =>"), /setIsExamStarted\(true\)[\s\S]*music\.onTestStart\(\)/);
  assert.match(body(ti, "const resumeExpiredDraft = () =>"), /setIsExamStarted\(true\)[\s\S]*music\.onTestStart\(\)/);
  assert.match(body(ti, "const finalSubmit = async"), /music\.onTestEnd\(\)/);
  assert.match(ti, /\{music\.prompt\}/);
  assert.match(ti, /\{isExamStarted && music\.button\}/, "the 48 px button sits in the test header");
  // Every way out of a started test releases it before onExit().
  const exits = ti.match(/stopCamera\(\);\s*(music\.onTestEnd\(\);\s*)?onExit\(\)/g) ?? [];
  assert.ok(exits.length >= 2);
  for (const exit of exits) assert.match(exit, /music\.onTestEnd\(\)/, exit);

  // Study-room tests and teacher-assigned tests render the same TestInterface.
  assert.match(source("src/app/study-rooms/[id]/test/_client.tsx"), /<TestInterface/);

  const cbt = source("src/sections/cbt/CbtTestInterface.tsx");
  assert.match(cbt, /useTestMusicGuard\(phase === "running"\)/);
  assert.match(body(cbt, "const beginAttempt = useCallback"), /setPhase\("running"\)[\s\S]*musicTestStart\(\)/);
  assert.match(body(cbt, "const submit = useCallback"), /musicTestEnd\(\)/);
  assert.match(cbt, /<div ref=\{containerRef\}[^\n]*>\s*\{\/\*[^]*?\*\/\}\s*\{musicPrompt\}/, "prompt inside the fullscreen container");

  const contest = source("src/features/contest/useContestAttempt.ts");
  assert.match(contest, /useTestMusicGuard\(phase === 'running'\)/);
  assert.match(body(contest, "const begin = useCallback"), /setPhase\('running'\)[\s\S]*musicTestStart\(\)/);
  assert.match(body(contest, "const submit = useCallback"), /musicTestEnd\(\)/);
  assert.match(source("src/components/contest/ContestPlayer.tsx"), /\{musicPrompt\}/);
  assert.match(source("src/components/contest/ContestPlayer.tsx"), /\{musicButton\}/);
  assert.match(cbt, /\{musicButton\}/);
});

test("source: the guard never blocks — no await, no early return before the test starts", () => {
  const guard = source("src/features/study-music/useTestMusicGuard.tsx");
  assert.doesNotMatch(guard, /\bawait\b/);
  assert.match(guard, /catch \{[\s\S]*music must never break a test/);
  // Starts call the guard only AFTER the start itself.
  const ti = source("src/sections/TestInterface.tsx");
  const startExam = body(ti, "const startExam = () =>");
  assert.ok(startExam.indexOf("music.onTestStart()") > startExam.indexOf("setIsExamStarted(true)"));
});
