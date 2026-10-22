import test from "node:test";
import assert from "node:assert/strict";

import { purgeResidualPersonalData } from "../../src/server/account-deletion";
import { createPostgresPoolConfig } from "../../src/server/postgres-config";

type Query = { pool: "user" | "rooms"; text: string; values: unknown[] };
type G = Record<string, unknown>;
const g = globalThis as unknown as G;

function installFakePools(
  fail: Partial<Record<string, { code?: string; message: string }>> = {},
  challenges: { sent?: Array<[string, string]>; received?: Array<[string, string]> } = {},
) {
  const queries: Query[] = [];
  const make = (pool: Query["pool"]) => ({
    query: async (text: string, values: unknown[] = []) => {
      queries.push({ pool, text, values });
      for (const [needle, error] of Object.entries(fail)) {
        if (text.includes(needle) && error) throw Object.assign(new Error(error.message), { code: error.code });
      }
      if (/FROM ogcode_friend_challenges WHERE from_user_id/.test(text)) {
        return { rows: (challenges.sent ?? []).map(([other, question_id]) => ({ other, question_id })) };
      }
      if (/FROM ogcode_friend_challenges WHERE to_user_id/.test(text)) {
        return { rows: (challenges.received ?? []).map(([other, question_id]) => ({ other, question_id })) };
      }
      return { rows: [], rowCount: 0 };
    },
    end: async () => undefined,
  });
  const userUrl = "postgres://fake:fake@127.0.0.1:1/fake_deletion";
  process.env.USER_DATABASE_URL = userUrl;
  process.env.OGCODE_DATABASE_URL = "postgres://fake:fake@127.0.0.1:1/fake_deletion_og";
  g.__originUserPool = make("user");
  g.__originUserPoolConnectionString = createPostgresPoolConfig(userUrl, 25).connectionString;
  g.__originOgcodePool = make("rooms");
  return queries;
}

test("purgeResidualPersonalData anonymises room names, deletes chat + doubts, rewrites notifications", async () => {
  const queries = installFakePools();
  const warnings: string[] = [];
  await purgeResidualPersonalData("user-1", { name: "Asha Student", username: "asha" }, warnings);
  assert.deepEqual(warnings, []);

  const find = (pool: Query["pool"], re: RegExp) => queries.find((q) => q.pool === pool && re.test(q.text));
  const participants = find("rooms", /UPDATE rooms\.room_participants SET display_name = 'Deleted user'/);
  assert.deepEqual(participants?.values, ["user-1"]);
  assert.deepEqual(find("rooms", /DELETE FROM rooms\.room_messages WHERE user_id = \$1/)?.values, ["user-1"]);
  assert.deepEqual(find("user", /DELETE FROM app\.doubt_sessions WHERE user_id = \$1/)?.values, ["user-1"]);

  // Without challenge edges only the follow rewrites run, and never on the name alone.
  const notifs = queries.filter((q) => q.pool === "user" && /UPDATE app\.notifications/.test(q.text));
  assert.equal(notifs.length, 2);
  for (const q of notifs) {
    assert.match(q.text, /WHERE user_id <> \$1/, "only OTHER users' inboxes");
    assert.doesNotMatch(q.text, /LIKE|regexp/i, "no pattern matching on user-controlled text");
  }
  const byHandle = notifs.find((q) => /href = '\/u\/' \|\| \$2::text/.test(q.text));
  assert.deepEqual(byHandle?.values, ["user-1", "asha"]);
  const byName = notifs.find((q) => /social\.follows WHERE follower_id = \$1/.test(q.text));
  assert.ok(byName, "a by-name follow match is limited to people this user follows");
  assert.match(byName!.text, /message = \$2::text \|\| ' started following you'/);
});

test("L8: another user's notification that merely starts with the same name is never matched", async () => {
  const queries = installFakePools({}, {
    sent: [["friend-1", "q1"]],
    received: [["friend-2", "q2"]],
  });
  await purgeResidualPersonalData("user-1", { name: "Your", username: null }, []);
  const notifs = queries.filter((q) => q.pool === "user" && /UPDATE app\.notifications/.test(q.text));
  // No generic "message starts with <name> " rewrite exists any more: each
  // statement is pinned to a notification title AND to this user's edges.
  for (const q of notifs) {
    assert.match(q.text, /title = /, "pinned to an exact notification shape");
    assert.match(q.text, /social\.follows|unnest\(\$3::text\[\], \$4::text\[\]\)/, "pinned to this user's edges");
  }
  const fromChallenge = notifs.find((q) => /'OG Challenge from a deleted user'/.test(q.text));
  assert.deepEqual(fromChallenge?.values, ["user-1", "Your", ["friend-1"], ["/ogcode/q1"]]);
  const attempted = notifs.find((q) => /title = 'OG Challenge attempted'/.test(q.text));
  assert.deepEqual(attempted?.values, ["user-1", "Your", ["friend-2"], ["/ogcode/q2"]]);
});

test("purgeResidualPersonalData: a missing table is silent, other failures become warnings", async () => {
  installFakePools({
    "rooms.room_messages": { code: "42P01", message: 'relation "rooms.room_messages" does not exist' },
    "app.doubt_sessions": { code: "57014", message: "statement timeout" },
  });
  const warnings: string[] = [];
  await purgeResidualPersonalData("user-1", { name: "Asha", username: null }, warnings);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /doubt sessions/);
});

test("purgeResidualPersonalData skips the notification rewrite when there is no name or handle", async () => {
  const queries = installFakePools();
  await purgeResidualPersonalData("user-1", { name: "  ", username: null }, []);
  assert.equal(queries.some((q) => /app\.notifications/.test(q.text)), false);
});
