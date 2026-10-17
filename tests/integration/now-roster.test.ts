/**
 * Weekly roster (pilot readiness item 3) against a real Postgres, on fixed
 * days in January 2030 so other tests never share them: solvers tick their
 * evenings, the locks hold, and the admin sees cover and minutes online.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getMyRoster, getRosterForAdmin, setRosterSlot } from "@/server/now/roster-service";
import { setSetting } from "@/server/platform-settings";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, cleanupNowFixtures, helpersMade, seedHelper, setup } from "./_now";

test.after(async () => {
  if (!NOW_SKIP) {
    await rawPool().query(`DELETE FROM now.roster WHERE helper_id = ANY($1::text[])`, [helpersMade]);
    await rawPool().query(`DELETE FROM now.presence_minutes WHERE helper_id = ANY($1::text[])`, [helpersMade]);
  }
  await cleanupNowFixtures();
  await closePool();
});

const ist = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);
const rejectsWith = (code: string) => (error: { code?: string }) => error.code === code;

test("solvers tick evenings; the admin sees cover and who came online", { skip: NOW_SKIP }, async () => {
  await setup();
  // Every day, 6–10 pm IST.
  await setSetting("now_open_hours", JSON.stringify({ from: "18:00", to: "22:00", days: [0, 1, 2, 3, 4, 5, 6] }), null);
  try {
    const asha = await seedHelper("physics");
    const ravi = await seedHelper("physics");
    const sunil = await seedHelper("physics");
    await rawPool().query(`UPDATE now.helpers SET display_name = 'Asha' WHERE id = $1`, [asha.helperId]);
    await rawPool().query(`UPDATE now.helpers SET display_name = 'Sunil' WHERE id = $1`, [sunil.helperId]);
    const morning = ist("2030-01-07", "10:00"); // a Monday

    const mine = await getMyRoster(asha.userId, morning);
    assert.deepEqual(mine.subjects, ["physics"]);
    assert.equal(mine.days.length, 14);
    assert.equal(mine.days[0].day, "2030-01-07");

    await setRosterSlot(asha.userId, { day: "2030-01-07", subject: "physics", on: true }, morning);
    const again = await setRosterSlot(asha.userId, { day: "2030-01-07", subject: "physics", on: true }, morning);
    assert.deepEqual(again.days[0].subjects, ["physics"], "ticking twice keeps one slot");
    await setRosterSlot(asha.userId, { day: "2030-01-08", subject: "physics", on: true }, morning);
    await setRosterSlot(ravi.userId, { day: "2030-01-07", subject: "physics", on: true }, morning);
    await setRosterSlot(sunil.userId, { day: "2030-01-09", subject: "physics", on: true }, morning);

    await assert.rejects(setRosterSlot(asha.userId, { day: "2030-01-07", subject: "chemistry", on: true }, morning), rejectsWith("not_your_subject"));
    await assert.rejects(setRosterSlot(asha.userId, { day: "2030-01-06", subject: "physics", on: true }, morning), rejectsWith("roster_locked"));
    await assert.rejects(
      setRosterSlot(asha.userId, { day: "2030-01-07", subject: "physics", on: false }, ist("2030-01-07", "18:30")),
      rejectsWith("roster_locked"),
      "once the shift starts the evening is fixed",
    );

    // Sunil is restricted after rostering: still listed, not counted.
    await rawPool().query(`UPDATE now.helpers SET verification_status = 'restricted' WHERE id = $1`, [sunil.helperId]);
    await assert.rejects(setRosterSlot(sunil.userId, { day: "2030-01-10", subject: "physics", on: true }, morning), rejectsWith("restricted"));

    // Asha is online 18:00–18:29 on the 7th, plus 10 minutes after hours that must not count. Ravi never comes.
    for (let m = 0; m < 30; m += 1) {
      await rawPool().query(`INSERT INTO now.presence_minutes (helper_id, minute) VALUES ($1, $2)`, [asha.helperId, new Date(ist("2030-01-07", "18:00").getTime() + m * 60_000)]);
    }
    for (let m = 0; m < 10; m += 1) {
      await rawPool().query(`INSERT INTO now.presence_minutes (helper_id, minute) VALUES ($1, $2)`, [asha.helperId, new Date(ist("2030-01-07", "22:30").getTime() + m * 60_000)]);
    }

    const admin = await getRosterForAdmin(ist("2030-01-07", "23:00"));
    const day = (key: string) => admin.days.find((d) => d.day === key)!;
    assert.equal(admin.days[0].day, "2029-12-31", "7 evenings back");
    assert.equal(admin.days.at(-1)!.day, "2030-01-20", "today plus 13 ahead");

    const seventh = day("2030-01-07").subjects.physics;
    assert.equal(seventh.cover, "ok");
    assert.deepEqual(
      seventh.solvers.map((s) => [s.name, s.onlineMinutes]).sort(),
      [["Asha", 30], ["Ravi", 0]],
      "minutes inside 6–10 pm only; Ravi never came online",
    );
    assert.equal(day("2030-01-08").subjects.physics.cover, "thin");
    assert.equal(day("2030-01-08").subjects.physics.solvers[0].onlineMinutes, null, "future evenings have no minutes yet");
    const ninth = day("2030-01-09").subjects.physics;
    assert.equal(ninth.cover, "none", "a restricted solver does not count as cover");
    assert.deepEqual(ninth.solvers.map((s) => [s.name, s.restricted]), [["Sunil", true]]);
    assert.equal(day("2030-01-10").subjects.chemistry.cover, "none");
  } finally {
    await setup();
  }
});
