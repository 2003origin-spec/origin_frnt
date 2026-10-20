import test from "node:test";
import assert from "node:assert/strict";

import {
  bytesMatchMime,
  extensionMatchesType,
  fileTypeForMime,
  normaliseMime,
  safeDownloadName,
  sniffMagic,
} from "../../src/lib/notes/file-types";

const bytes = (...values: Array<number | string>) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? Array.from(v, (c) => c.charCodeAt(0)) : [v])));

test("real files are recognised by their first bytes", () => {
  assert.equal(sniffMagic(bytes("%PDF-1.7\n")), "pdf");
  assert.equal(sniffMagic(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a)), "png");
  assert.equal(sniffMagic(bytes(0xff, 0xd8, 0xff, 0xe0)), "jpeg");
  assert.equal(sniffMagic(bytes("RIFF", 0, 0, 0, 0, "WEBP")), "webp");
  assert.equal(sniffMagic(bytes("RIFF", 0, 0, 0, 0, "WAVE")), "wav");
  assert.equal(sniffMagic(bytes("PK", 3, 4)), "zip");
  assert.equal(sniffMagic(bytes(0x1a, 0x45, 0xdf, 0xa3)), "ebml");
  assert.equal(sniffMagic(bytes("OggS")), "ogg");
  assert.equal(sniffMagic(bytes(0, 0, 0, 0x20, "ftypisom")), "isobmff");
  assert.equal(sniffMagic(bytes("ID3", 4)), "mp3");
});

test("a PDF header after some junk bytes still counts (the spec allows 1024)", () => {
  const junk = new Uint8Array(300).fill(0x20);
  const withHeader = new Uint8Array([...junk, ...bytes("%PDF-1.4")]);
  assert.equal(bytesMatchMime(withHeader, "application/pdf"), true);
});

test("fakes are refused", () => {
  // A Windows program renamed to .pdf
  assert.equal(bytesMatchMime(bytes("MZ", 0x90, 0), "application/pdf"), false);
  // HTML pretending to be a photo
  assert.equal(bytesMatchMime(bytes("<!doctype html><script>"), "image/png"), false);
  // An SVG is not an accepted type at all
  assert.equal(fileTypeForMime("image/svg+xml"), null);
  assert.equal(bytesMatchMime(bytes("<svg"), "image/svg+xml"), false);
  // A PNG declared as a PDF
  assert.equal(bytesMatchMime(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a), "application/pdf"), false);
});

test("browser mime quirks are folded", () => {
  assert.equal(normaliseMime("audio/webm;codecs=opus"), "audio/webm");
  assert.equal(normaliseMime("IMAGE/JPG"), "image/jpeg");
  assert.equal(fileTypeForMime("image/jpg")?.ext, "jpg");
});

test("extension check and download names", () => {
  const jpeg = fileTypeForMime("image/jpeg")!;
  assert.equal(extensionMatchesType("photo.JPEG", jpeg), true);
  assert.equal(extensionMatchesType("photo.png", jpeg), false);
  const pdf = fileTypeForMime("application/pdf")!;
  assert.equal(safeDownloadName("Thermo / formulas <final>.pdf", pdf), "Thermo formulas final.pdf");
  assert.equal(safeDownloadName("", pdf), "notes.pdf");
  assert.equal(safeDownloadName("गति के नियम.pdf", pdf), "गति के नियम.pdf");
});
