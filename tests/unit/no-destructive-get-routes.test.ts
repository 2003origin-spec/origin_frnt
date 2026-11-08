/**
 * Guards against the `GET /api/assessments/ogcode/seed-temp` class of bug: a
 * leftover dev route that let any signed-in student (or a cross-site link,
 * since GET carries the SameSite=Lax session cookie) wipe the whole OG Code
 * question bank. No route handler under src/app/api may issue a bulk
 * DELETE/TRUNCATE on the question bank, and the seed-temp path must not exist.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const API_ROOT = path.resolve(process.cwd(), "src/app/api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (/^route\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test("no API route references the removed seed-temp endpoint", () => {
  for (const file of routeFiles(API_ROOT)) {
    assert.equal(readFileSync(file, "utf8").includes("seed-temp"), false, `${file} still mentions seed-temp`);
  }
});

test("no API route bulk-deletes or truncates the OG Code question bank", () => {
  const bulkWipe = /(DELETE\s+FROM\s+ogcode_questions\s*["'`;)]|TRUNCATE\s+(TABLE\s+)?ogcode_questions)/i;
  for (const file of routeFiles(API_ROOT)) {
    assert.equal(bulkWipe.test(readFileSync(file, "utf8")), false, `${file} wipes ogcode_questions`);
  }
});
