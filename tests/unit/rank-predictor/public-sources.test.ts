/**
 * The "Sources" list under the Rank Predictor and the college finder: which
 * links are written out, how they are grouped and when the rest fold away.
 *
 *   npx tsx --test tests/unit/rank-predictor/public-sources.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

import { PUBLIC_DATA_ACK, SOURCE_LINKS_SHOWN, SOURCES_ANCHOR_ID, linksIn, sourceGroups, splitLinks } from "@/lib/rank-predictor/public-sources";

test("the note says the data is public, in plain words", () => {
  assert.equal(PUBLIC_DATA_ACK, "This data is collected and worked out from publicly available data.");
  assert.equal(SOURCES_ANCHOR_ID, "sources");
});

test("groups: same label merged, each link once, order kept", () => {
  const groups = sourceGroups([
    { key: "state_ka", label: "Karnataka state quota", links: [{ url: "https://kea.example/r1.pdf" }, { url: "https://kea.example/r2.pdf" }, { url: "https://kea.example/r1.pdf" }] },
    { key: "mcc_ug", label: "MCC", links: [{ url: "https://mcc.nic.in/" }] },
    { label: "Karnataka state quota", links: [{ url: " https://kea.example/r3.pdf " }, { url: "https://kea.example/r2.pdf" }] },
  ]);
  assert.deepEqual(groups.map((g) => g.label), ["Karnataka state quota", "MCC"]);
  assert.deepEqual(groups[0].links.map((l) => l.url), ["https://kea.example/r1.pdf", "https://kea.example/r2.pdf", "https://kea.example/r3.pdf"]);
  assert.equal(groups[0].key, "state_ka");
});

test("groups: only web links are ever written out; empty groups are dropped", () => {
  const groups = sourceGroups([
    { label: "Bad", links: [{ url: "javascript:alert(1)" }, { url: "" }, { url: "ftp://x/y" }, { url: "not a link" }] },
    { label: "  ", links: [{ url: "https://ok.example/" }] },
    { label: "Good", links: [{ url: "http://plain.example/a" }, { url: "https://ok.example/b c" }] },
  ]);
  assert.deepEqual(groups.map((g) => g.label), ["Good"]);
  assert.deepEqual(groups[0].links.map((l) => l.url), ["http://plain.example/a", "https://ok.example/b"]);
});

test("a source field can hold several links, or a link and a note: every link is written out, nothing else", () => {
  assert.deepEqual(linksIn("https://a.example/r1.pdf ; https://a.example/r2.pdf?v=1 ; https://a.example/r3.pdf"), [
    "https://a.example/r1.pdf",
    "https://a.example/r2.pdf?v=1",
    "https://a.example/r3.pdf",
  ]);
  assert.deepEqual(linksIn("https://upneet.example/result/list.aspx (Allotted Candidate List > Round 1 > Institute Wise)"), ["https://upneet.example/result/list.aspx"]);
  assert.deepEqual(linksIn("linked from https://csab.example/neut/ (see the page)."), ["https://csab.example/neut/"]);
  assert.deepEqual(linksIn("see (https://x.example/a.pdf)."), ["https://x.example/a.pdf"]);
  assert.deepEqual(linksIn("javascript:alert(1)"), []);
  assert.deepEqual(linksIn("https://nodot/"), []);
  assert.deepEqual(linksIn(null), []);
  const groups = sourceGroups([{ label: "Gujarat state quota", links: [{ url: "https://g.example/r1.pdf ; https://g.example/r2.pdf" }, { url: "https://g.example/r2.pdf" }] }]);
  assert.deepEqual(groups[0].links.map((l) => l.url), ["https://g.example/r1.pdf", "https://g.example/r2.pdf"]);
});

test("links: a few show at once, the rest fold; one left over is not folded", () => {
  const links = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://x.example/${i}` }));
  assert.equal(SOURCE_LINKS_SHOWN, 4);
  assert.deepEqual([splitLinks(links(1)).first.length, splitLinks(links(1)).rest.length], [1, 0]);
  assert.deepEqual([splitLinks(links(4)).first.length, splitLinks(links(4)).rest.length], [4, 0]);
  assert.deepEqual([splitLinks(links(5)).first.length, splitLinks(links(5)).rest.length], [5, 0]);
  assert.deepEqual([splitLinks(links(6)).first.length, splitLinks(links(6)).rest.length], [4, 2]);
  const fourteen = splitLinks(links(14));
  assert.deepEqual([fourteen.first.length, fourteen.rest.length], [4, 10]);
  assert.equal(fourteen.rest[0].url, "https://x.example/4");
});
