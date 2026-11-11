/**
 * College finder against a real database holding the imported counselling
 * data (`npm run counselling:import -- --dir … --all`). Checks the SQL path
 * (pre-filter, windows, joins, LIKE escaping, paging) with the T9 golden cells
 * on the full data. Skips when no database or no counselling data.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, rawPool } from "./_db";
import { searchCounselling, resetCounsellingCache, getCounsellingMeta } from "@/server/counselling/service";
import { validateSearchInput } from "@/lib/counselling/validate";
import type { CounsellingSearchInput } from "@/lib/counselling/types";

async function hasData(): Promise<boolean> {
  if (!dbConfigured()) return false;
  const res = await rawPool().query("SELECT to_regclass('counselling.cutoffs') IS NOT NULL AS ok");
  if (!res.rows[0]?.ok) return false;
  const n = await rawPool().query("SELECT count(*)::int AS n FROM counselling.datasets WHERE body = 'josaa' AND year = 2026");
  return n.rows[0].n > 0;
}

function input(body: Record<string, unknown>): CounsellingSearchInput {
  const res = validateSearchInput({ category: "general", pwd: false, gender: "male", homeState: "", filters: {}, page: 1, pageSize: 50, ...body });
  if (!res.ok) throw new Error(JSON.stringify(res.error));
  return res.value;
}

test("college finder on the imported data", async (t) => {
  if (!(await hasData())) {
    t.skip("no counselling data in this database");
    return;
  }
  resetCounsellingCache();

  await t.test("T9.1 IIT Bombay CSE for CRL 60 is Likely (2026, all rounds)", async () => {
    const res = await searchCounselling(input({ exam: "jee", ranks: { jeeAdvCrl: 60 }, filters: { bodies: ["josaa"], branchQuery: "Computer Science and Engineering", instituteTypes: ["IIT"] } }));
    const row = res.rows.find((r) => r.institute === "Indian Institute of Technology Bombay" && r.program === "Computer Science and Engineering" && !r.femaleOnly);
    assert.ok(row, "IIT Bombay CSE row");
    assert.equal(row.finalClosing, 67);
    assert.equal(row.band, "likely");
    assert.equal(row.rounds.length, 5);
    assert.equal(res.searched[0].year, 2026);
  });

  await t.test("T9.3 / T9.4 NIT Trichy CSE HS for Tamil Nadu, OS for Kerala", async () => {
    const base = { exam: "jee", ranks: { jeeMainCrl: 1300 }, filters: { bodies: ["josaa"], branchQuery: "Computer Science and Engineering" } };
    const tn = await searchCounselling(input({ ...base, homeState: "Tamil Nadu", filters: { ...base.filters, branchQuery: "Tiruchirappalli" } }));
    const trichyTn = tn.rows.filter((r) => /Tiruchirappalli/.test(r.institute) && r.institute.startsWith("National") && r.program === "Computer Science and Engineering" && !r.femaleOnly);
    assert.deepEqual(trichyTn.map((r) => [r.quota, r.band, r.finalClosing]), [["HS", "safe", 4015]]);
    const kl = await searchCounselling(input({ ...base, homeState: "Kerala", filters: { ...base.filters, branchQuery: "Tiruchirappalli" } }));
    const trichyKl = kl.rows.filter((r) => /Tiruchirappalli/.test(r.institute) && r.institute.startsWith("National") && r.program === "Computer Science and Engineering" && !r.femaleOnly);
    assert.deepEqual(trichyKl.map((r) => [r.quota, r.band, r.finalClosing]), [["OS", "likely", 1373]]);
  });

  await t.test("T9.7 NEET AIR 1,300 → Bangalore Medical College MBBS AIQ is Likely (2025)", async () => {
    const res = await searchCounselling(input({ exam: "neet", ranks: { neetAir: 1300 }, filters: { bodies: ["mcc_ug"], years: [2025], branchQuery: "Bangalore Medical" } }));
    const bmc = res.rows.find((r) => r.program === "MBBS" && r.quota === "All India" && r.seatType === "Open");
    assert.ok(bmc);
    assert.equal(bmc.band, "likely");
    assert.equal(bmc.rounds[0].closing, 1338);
  });

  await t.test("T9.11 paging and the 50-row cap on a broad search", async () => {
    const p1 = await searchCounselling(input({ exam: "jee", ranks: { jeeMainCrl: 20000 }, homeState: "Kerala" }));
    assert.ok(p1.total > 50);
    assert.equal(p1.rows.length, 50);
    const p2 = await searchCounselling(input({ exam: "jee", ranks: { jeeMainCrl: 20000 }, homeState: "Kerala", page: 2 }));
    assert.ok(p2.rows.every((r) => !p1.rows.some((x) => x.key === r.key)));
    const narrow = await searchCounselling(input({ exam: "jee", ranks: { jeeMainCrl: 20000 }, homeState: "Kerala", filters: { instituteTypes: ["NIT"], branchQuery: "Electrical" } }));
    assert.ok(narrow.total > 0 && narrow.total < p1.total);
  });

  await t.test("T9.12 injection text in branchQuery is just text", async () => {
    for (const q of ["'; DROP TABLE counselling.cutoffs; --", "%", "_", "\\\\", "' OR '1'='1"]) {
      const res = await searchCounselling(input({ exam: "jee", ranks: { jeeMainCrl: 20000 }, filters: { branchQuery: q } }));
      assert.ok(res.total >= 0);
    }
    const still = await rawPool().query("SELECT count(*)::int AS n FROM counselling.cutoffs");
    assert.ok(still.rows[0].n > 300000);
  });

  await t.test("trend line appears for cells with 3+ years", async () => {
    const res = await searchCounselling(input({ exam: "jee", ranks: { jeeMainCrl: 5000 }, homeState: "Kerala", filters: { bodies: ["josaa"], instituteTypes: ["NIT"] } }));
    assert.ok(res.rows.some((r) => r.trend), "some NIT cell rose or fell 2+ years in a row");
  });

  await t.test("a female OBC-NCL PwD student with a tiny PwD rank stays under the row cap", async () => {
    const t0 = Date.now();
    const res = await searchCounselling(
      input({ exam: "jee", ranks: { jeeMainCrl: 9000, jeeMainCategory: 2000, jeeMainPwdCrl: 40, jeeAdvCrl: 3000 }, category: "obc-ncl", pwd: true, gender: "female", homeState: "Bihar" }),
    );
    assert.equal(res.truncated, false);
    assert.ok(res.total > 0);
    assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0} ms`);
  });

  await t.test("meta for both exams", async () => {
    const jee = await getCounsellingMeta("jee");
    assert.deepEqual(jee.bodies.map((b) => b.body), ["josaa", "csab_special", "csab_neut"]);
    assert.match(jee.checkedOn ?? "", /^\d{2}\/\d{2}\/\d{4}$/);
    const neet = await getCounsellingMeta("neet");
    assert.equal(neet.bodies.length, 10);
    assert.ok(neet.bodies.find((b) => b.body === "state_ka")?.note);
  });

  await rawPool().end();
});
