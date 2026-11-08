import assert from "node:assert/strict";
import test from "node:test";

import { APP_ICONS, isAppIconId } from "@/lib/app-icons";

test("app icon ids: the default first, unique, and only known ids accepted", () => {
  assert.equal(APP_ICONS[0].id, "default");
  const ids = APP_ICONS.map((icon) => icon.id);
  assert.equal(new Set(ids).size, ids.length);
  // Same catalogue as the native app (origin-app assets/app-icons/icons.json).
  assert.deepEqual(ids, ["default", "diwali", "holi", "eid", "christmas", "ganesh", "navratri", "rakhi", "national", "harvest", "onam"]);
  for (const id of ids) assert.equal(isAppIconId(id), true);
  for (const bad of ["", "Diwali", "newyear", null, undefined, 3, {}]) assert.equal(isAppIconId(bad), false);
});
